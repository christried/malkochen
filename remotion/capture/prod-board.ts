import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import pg from 'pg'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceKind } from '../../server/source-lookup'
import { type BoardContent, servedImage, STAND_INS } from './seed'

// One real Board, read from production (`url`) in a read-only
// transaction, for the video to show: its name and emoji, its Columns and
// Dishes, their images and creators. Production is never written to. The
// video watches the Member named `me` (by default its Owner); the others
// keep their Usernames with `keepNames` (for a video its Members have
// agreed to), else get STAND_INS. Nobody's picture is taken. The images are
// copied to where the capture server serves stored images from
// (servedImage), so the capture never waits on the network.

// Stored images are JPEGs (the Image Store's preparePhoto).
async function copyImage(url: string): Promise<string | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  const { path, file } = servedImage(url, 'jpg')
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, Buffer.from(await res.arrayBuffer()))
  return path
}

export async function readProdBoard(url: string, boardName: string, { me, keepNames = false }: { me?: string, keepNames?: boolean } = {}): Promise<BoardContent> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    await client.query('begin transaction read only')
    const { rows: boards } = await client.query<{ id: string, name: string, emoji: string }>(
      'select id, name, emoji from board where lower(name) = lower($1)', [boardName])
    if (boards.length !== 1) throw new Error(`${boards.length} Boards are called "${boardName}"`)
    const board = boards[0]!
    const { rows: members } = await client.query<{ id: string, username: string | null, is_owner: boolean }>(
      `select u.id, u.username, m.is_owner from membership m join "user" u on u.id = m.user_id
       where m.board_id = $1 order by m.is_owner desc, u.created_at`, [board.id])
    // Members are ordered Owner first, so without `me` it is the Owner.
    const mine = me ? members.findIndex(m => m.username?.toLowerCase() === me.toLowerCase()) : 0
    if (mine === -1) throw new Error(`"${me}" is not a Member of "${boardName}"`)
    const order = [members[mine]!, ...members.filter((_, i) => i !== mine)]
    const { rows: columns } = await client.query<{ id: string, name: string, subtitle: string | null, is_gekocht: boolean }>(
      'select id, name, subtitle, is_gekocht from board_column where board_id = $1 order by position', [board.id])
    const { rows: dishes } = await client.query<{
      column_id: string, title: string, placeholder: Placeholder, image_url: string | null, image_focus_x: number, image_focus_y: number,
      source_link: string | null, source_kind: SourceKind | null, creator: string | null, added_by: string | null, cooked: number
    }>(
      `select d.column_id, d.title, d.placeholder, d.image_url, d.image_focus_x, d.image_focus_y, d.source_link, d.source_kind, d.creator, d.added_by,
              (select count(*)::int from cooking c where c.dish_id = d.id and c.deleted_at is null) as cooked
       from dish d where d.board_id = $1 and d.deleted_at is null order by d.position`, [board.id])
    await client.query('commit')
    const content: BoardContent = {
      name: board.name,
      emoji: board.emoji,
      members: order.map((m, i) => (i === 0 || keepNames) && m.username ? m.username : STAND_INS[(i - 1) % STAND_INS.length]!),
      columns: [],
    }
    for (const column of columns) {
      const own = dishes.filter(d => d.column_id === column.id)
      content.columns.push({
        name: column.name,
        subtitle: column.subtitle,
        gekocht: column.is_gekocht,
        dishes: await Promise.all(own.map(async d => ({
          title: d.title,
          placeholder: d.placeholder,
          kind: d.source_kind,
          link: d.source_link,
          creator: d.creator,
          image: d.image_url?.startsWith('http') ? await copyImage(d.image_url) : null,
          focus: [d.image_focus_x, d.image_focus_y] as [number, number],
          by: d.added_by ? order.findIndex(m => m.id === d.added_by) : null,
          cooked: d.cooked,
        }))),
      })
    }
    return content
  }
  finally {
    await client.end()
  }
}
