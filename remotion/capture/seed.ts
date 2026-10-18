import type { APIRequestContext } from '@playwright/test'
import pg from 'pg'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceKind } from '../../server/source-lookup'

// The Board the video shows, on the capture server's throwaway database:
// made up (MADE_UP), or one read from production (prod-board.ts).

export interface BoardDish {
  title: string
  placeholder: Placeholder
  kind: SourceKind | null
  link: string | null
  creator: string | null
  // Served by the capture server (/images/…), or none: the Placeholder.
  image: string | null
  focus: [number, number]
  // Who added it: an index into `members`, or nobody.
  by: number | null
  cooked: number
}

export interface BoardContent {
  name: string
  emoji: string
  // The first is who the video watches, and the Board's Owner.
  members: string[]
  // In order; the Gekocht Column is the last unless one says otherwise.
  columns: { name: string, subtitle: string | null, gekocht?: boolean, dishes: BoardDish[] }[]
}

const dish = (title: string, placeholder: Placeholder, kind: SourceKind, link: string, creator: string, by: number, cooked = 0): BoardDish =>
  ({ title, placeholder, kind, link, creator, image: null, focus: [50, 50], by, cooked })

// Nothing here is anyone's real data; the Dishes use the drawn Placeholder
// Images, not images from the posts.
export const MADE_UP: BoardContent = {
  name: 'Kochclub',
  emoji: '🍝',
  members: ['Mia', 'Jonas', 'Lea'],
  columns: [
    { name: 'Ideen', subtitle: 'Worauf hast du Lust?', dishes: [
      dish('Pasta alla Norma', 'pasta', 'blog', 'https://www.example-kitchen.de/pasta-alla-norma', 'Kitchen Notes', 1),
      dish('Smash Burger', 'burger', 'youtube-short', 'https://www.youtube.com/shorts/aB3dE5fG7hI', 'Plant Grill', 2),
      dish('Gyoza', 'dumplings', 'pinterest-pin', 'https://www.pinterest.com/pin/123456789012345678/', 'Dumpling Diary', 0),
      dish('Jackfruit Tacos', 'tacos', 'tiktok', 'https://www.tiktok.com/@tacotuesday/video/7301234567890123001', 'Taco Tuesday', 1),
      dish('Erdnuss-Nudeln', 'wok', 'instagram-reel', 'https://www.instagram.com/reel/C1x2y3z4w5v/', 'Wok Hei Club', 2),
    ] },
    { name: 'Diese Woche', subtitle: 'Das steht an.', dishes: [
      dish('Ramen', 'ramen', 'tiktok', 'https://www.tiktok.com/@noodlenight/video/7301234567890123002', 'Noodle Night', 2),
      dish('Omas Linsensuppe', 'eintopf', 'blog', 'https://www.example-kitchen.de/linsensuppe', 'Kitchen Notes', 0),
    ] },
    { name: 'Gekocht', subtitle: null, dishes: [
      dish('Bananenbrot', 'bread', 'instagram-reel', 'https://www.instagram.com/reel/C9a8b7c6d5e/', 'Bake Club', 1, 4),
      dish('Schoko-Kuchen', 'cake', 'pinterest-pin', 'https://www.pinterest.com/pin/876543210987654321/', 'Sweet Tooth', 0, 2),
    ] },
  ],
}

// Made-up names for the other Members of a Board read from production.
export const STAND_INS = ['Mia', 'Jonas', 'Lea', 'Ben', 'Noa', 'Emil', 'Ida', 'Paul']

// What the share brings in (capture.ts answers the Source Lookup with it).
export const SHARED = {
  kind: 'tiktok',
  canonicalLink: 'https://www.tiktok.com/@veganfoodclub/video/7301234567890123456',
  suggestedTitle: 'Crispy Tofu Bowl',
  creator: 'Vegan Food Club',
  imageUrl: null,
  imageTicket: null,
}

// The test Allowlist's emails the Members sign in with, per Board: a
// different set for each, so their Usernames come from these names.
const EMAILS = {
  madeUp: ['ada@example.com', 'grace@example.com', 'linus@example.com'],
  other: ['radia@example.com', 'frances@example.com', 'sophie@example.com', 'evelyn@example.com', 'alan@example.com', 'dorothy@example.com', 'ruth@example.com', 'jean@example.com', 'emmy@example.com'],
}

// Signs every Member in once (which makes them users with a Username from
// their name), then gives the first one's Board the content: its name and
// emoji, the others as Members, its Columns and Dishes. Again on the next
// capture, from the same content, not what the last one left (the Column
// it adds among it). Returns the Board's address and its Columns' names.
export async function seed(request: APIRequestContext, origin: string, databaseUrl: string, content: BoardContent): Promise<{ path: string, columns: string[] }> {
  const emails = (content === MADE_UP ? EMAILS.madeUp : EMAILS.other).slice(0, content.members.length)
  if (emails.length < content.members.length) throw new Error(`at most ${EMAILS.other.length} Members`)
  for (const [i, email] of emails.entries()) {
    const res = await request.post(`${origin}/api/auth/dev/sign-in`, { data: { email, name: content.members[i] }, headers: { origin } })
    if (!res.ok()) throw new Error(`sign-in as ${email} failed: ${res.status()} ${await res.text()}`)
    // A new user's Board is made when they first land.
    await request.get(`${origin}/api/boards/landing`)
  }
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query('begin')
    const users: string[] = []
    for (const email of emails) {
      users.push((await client.query<{ id: string }>('select id from "user" where email = $1', [email])).rows[0]!.id)
    }
    await client.query('update "user" set tour_seen = 1 where id = any($1)', [users])
    const { rows: [board] } = await client.query<{ id: string }>(
      'select board_id as id from membership where user_id = $1 and is_owner', [users[0]])
    await client.query('update board set name = $2, emoji = $3 where id = $1', [board!.id, content.name, content.emoji])
    for (const user of users.slice(1)) {
      await client.query('insert into membership (board_id, user_id, last_opened_at, seen_at) values ($1, $2, now(), now()) on conflict do nothing', [board!.id, user])
    }
    await client.query('delete from dish where board_id = $1', [board!.id])
    await client.query('delete from board_column where board_id = $1', [board!.id])
    for (const [position, column] of content.columns.entries()) {
      const { rows: [{ id: columnId }] } = await client.query<{ id: string }>(
        'insert into board_column (board_id, name, subtitle, position, is_gekocht) values ($1, $2, $3, $4, $5) returning id',
        [board!.id, column.name, column.subtitle, position, column.gekocht ?? position === content.columns.length - 1],
      )
      for (const [order, d] of column.dishes.entries()) {
        const { rows: [row] } = await client.query<{ id: string }>(
          `insert into dish (board_id, column_id, position, title, placeholder, image_url, image_focus_x, image_focus_y, source_link, source_kind, added_by, creator, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now() - make_interval(days => $13))
           returning id`,
          [board!.id, columnId, order, d.title, d.placeholder, d.image, d.focus[0], d.focus[1], d.link, d.kind, d.by === null ? null : users[d.by], d.creator, 3 + position * 5 + order],
        )
        if (d.cooked) {
          await client.query(
            `insert into cooking (dish_id, cooked_at) select $1, now() - make_interval(days => n * 6) from generate_series(1, $2::int) n`,
            [row!.id, d.cooked],
          )
        }
      }
    }
    await client.query('commit')
  }
  finally {
    await client.end()
  }
  const res = await request.post(`${origin}/api/auth/dev/sign-in`, { data: { email: emails[0] }, headers: { origin } })
  if (!res.ok()) throw new Error(`sign-in failed: ${res.status()}`)
  const { slug } = await (await request.get(`${origin}/api/boards/landing`)).json() as { slug: string }
  return { path: `/b/${slug}`, columns: content.columns.map(c => c.name) }
}
