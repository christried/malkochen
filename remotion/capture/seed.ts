import type { APIRequestContext } from '@playwright/test'
import pg from 'pg'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceKind } from '../../server/source-lookup'

// The Board the video shows: made-up Members and Dishes on the capture
// server's throwaway database. Nothing here is anyone's real data; the
// Dishes use the drawn Placeholder Images, not images from the posts.

export const MEMBERS = [
  { email: 'ada@example.com', name: 'Mia' },
  { email: 'grace@example.com', name: 'Jonas' },
  { email: 'linus@example.com', name: 'Lea' },
] as const

export const BOARD = { name: 'Kochclub', emoji: '🍝' }

interface SeedDish {
  title: string
  placeholder: Placeholder
  kind: SourceKind
  link: string
  creator: string
  by: number
  cooked?: number
}

// Per Column, top first: Ideen, Diese Woche, Gekocht.
export const COLUMNS: SeedDish[][] = [
  [
    { title: 'Pasta alla Norma', placeholder: 'pasta', kind: 'blog', link: 'https://www.example-kitchen.de/pasta-alla-norma', creator: 'Kitchen Notes', by: 1 },
    { title: 'Smash Burger', placeholder: 'burger', kind: 'youtube-short', link: 'https://www.youtube.com/shorts/aB3dE5fG7hI', creator: 'Plant Grill', by: 2 },
    { title: 'Gyoza', placeholder: 'dumplings', kind: 'pinterest-pin', link: 'https://www.pinterest.com/pin/123456789012345678/', creator: 'Dumpling Diary', by: 0 },
    { title: 'Jackfruit Tacos', placeholder: 'tacos', kind: 'tiktok', link: 'https://www.tiktok.com/@tacotuesday/video/7301234567890123001', creator: 'Taco Tuesday', by: 1 },
    { title: 'Erdnuss-Nudeln', placeholder: 'wok', kind: 'instagram-reel', link: 'https://www.instagram.com/reel/C1x2y3z4w5v/', creator: 'Wok Hei Club', by: 2 },
  ],
  [
    { title: 'Ramen', placeholder: 'ramen', kind: 'tiktok', link: 'https://www.tiktok.com/@noodlenight/video/7301234567890123002', creator: 'Noodle Night', by: 2 },
    { title: 'Omas Linsensuppe', placeholder: 'eintopf', kind: 'blog', link: 'https://www.example-kitchen.de/linsensuppe', creator: 'Kitchen Notes', by: 0 },
  ],
  [
    { title: 'Bananenbrot', placeholder: 'bread', kind: 'instagram-reel', link: 'https://www.instagram.com/reel/C9a8b7c6d5e/', creator: 'Bake Club', by: 1, cooked: 4 },
    { title: 'Schoko-Kuchen', placeholder: 'cake', kind: 'pinterest-pin', link: 'https://www.pinterest.com/pin/876543210987654321/', creator: 'Sweet Tooth', by: 0, cooked: 2 },
  ],
]

// What the share brings in (capture.ts answers the Source Lookup with it).
export const SHARED = {
  kind: 'tiktok',
  canonicalLink: 'https://www.tiktok.com/@veganfoodclub/video/7301234567890123456',
  suggestedTitle: 'Crispy Tofu Bowl',
  creator: 'Vegan Food Club',
  imageUrl: null,
  imageTicket: null,
}

// Signs every Member in once (which makes them users with a Username from
// their name), then gives the first one's Board its name, the others as
// Members, and the Dishes. Returns the Board's address.
export async function seed(request: APIRequestContext, origin: string, databaseUrl: string): Promise<string> {
  for (const { email, name } of MEMBERS) {
    const res = await request.post(`${origin}/api/auth/dev/sign-in`, { data: { email, name }, headers: { origin } })
    if (!res.ok()) throw new Error(`sign-in as ${email} failed: ${res.status()} ${await res.text()}`)
    // A new user's Board is made when they first land.
    await request.get(`${origin}/api/boards/landing`)
  }
  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await client.query('begin')
    const users: string[] = []
    for (const { email } of MEMBERS) {
      users.push((await client.query<{ id: string }>('select id from "user" where email = $1', [email])).rows[0]!.id)
    }
    await client.query('update "user" set tour_seen = 1 where id = any($1)', [users])
    const { rows: [board] } = await client.query<{ id: string }>(
      'select board_id as id from membership where user_id = $1 and is_owner', [users[0]])
    await client.query('update board set name = $2, emoji = $3 where id = $1', [board!.id, BOARD.name, BOARD.emoji])
    for (const user of users.slice(1)) {
      await client.query('insert into membership (board_id, user_id, last_opened_at, seen_at) values ($1, $2, now(), now()) on conflict do nothing', [board!.id, user])
    }
    // Again on the next capture: from the same Dishes, not those it left.
    await client.query('delete from dish where board_id = $1', [board!.id])
    const { rows: columns } = await client.query<{ id: string }>(
      'select id from board_column where board_id = $1 order by position', [board!.id])
    for (const [c, dishes] of COLUMNS.entries()) {
      for (const [position, dish] of dishes.entries()) {
        const { rows: [row] } = await client.query<{ id: string }>(
          `insert into dish (board_id, column_id, position, title, placeholder, source_link, source_kind, added_by, creator, created_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now() - make_interval(days => $10))
           returning id`,
          [board!.id, columns[c]!.id, position, dish.title, dish.placeholder, dish.link, dish.kind, users[dish.by], dish.creator, 3 + c * 5 + position],
        )
        if (dish.cooked) {
          await client.query(
            `insert into cooking (dish_id, cooked_at) select $1, now() - make_interval(days => n * 6) from generate_series(1, $2::int) n`,
            [row!.id, dish.cooked],
          )
        }
      }
    }
    await client.query('commit')
  }
  finally {
    await client.end()
  }
  // The first Member is who the video watches.
  const res = await request.post(`${origin}/api/auth/dev/sign-in`, { data: { email: MEMBERS[0].email }, headers: { origin } })
  if (!res.ok()) throw new Error(`sign-in failed: ${res.status()}`)
  const { slug } = await (await request.get(`${origin}/api/boards/landing`)).json() as { slug: string }
  return `/b/${slug}`
}
