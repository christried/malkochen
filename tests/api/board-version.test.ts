import pg from 'pg'
import { expect, inject, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// The Board Version and the cheap check (#338, ADR 0008): every change to
// what a Board's Members see on it moves its version on, and an open Board
// asks GET /api/boards/:id/version, which answers only the version, writes
// nothing, and says "not found" to anyone but its Members. Reading,
// opening and polling the Board leave the version where it is. Rubin owns
// the Boards made here, Carson joins them, Cannon is the outsider; all
// three are used by this file only.

interface Column { id: string, isGekocht: boolean, dishes: { id: string }[] }
interface Board { id: string, inviteToken: string, version: number, columns: Column[] }

const owner = () => signIn(ALLOWLISTED[97])
const member = () => signIn(ALLOWLISTED[98])
const outsider = () => signIn(ALLOWLISTED[99])
const MISSING = '00000000-0000-4000-8000-000000000000'

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

async function versionOf(caller: Caller, boardId: string): Promise<number> {
  const res = await caller.fetch(`/api/boards/${boardId}/version`)
  expect(res.status).toBe(200)
  const body = await res.json()
  // The version and nothing else.
  expect(Object.keys(body)).toEqual(['version'])
  return body.version
}

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

// A new Board of the owner's that the member has joined.
async function sharedBoard(name: string): Promise<{ board: Board, rubin: Caller, carson: Caller }> {
  const rubin = await owner()
  const res = await send(rubin, 'POST', '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const carson = await member()
  expect((await send(carson, 'POST', `/api/invites/${(await getBoard(rubin, id)).inviteToken}/join`)).status).toBe(200)
  return { board: await getBoard(rubin, id), rubin, carson }
}

async function addDish(caller: Caller, boardId: string, title = 'Shakshuka'): Promise<{ id: string }> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

// Asserts that `change` answers `status` and moves the Board's version on,
// as both the check and the whole Board see it.
async function expectMoves(caller: Caller, boardId: string, change: () => Promise<Response>, status = 200) {
  const before = await versionOf(caller, boardId)
  const res = await change()
  expect(res.status, await res.clone().text()).toBe(status)
  const after = await versionOf(caller, boardId)
  expect(after).toBeGreaterThan(before)
  expect((await getBoard(caller, boardId)).version).toBe(after)
}

// The rows a read of the Board could write to: the Board's own, and its
// memberships (seen_at and the like). Their xmin is the transaction that
// last wrote each, so an unchanged list means nothing wrote them.
async function rowVersions(boardId: string): Promise<string[]> {
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    const { rows } = await client.query<{ written: string }>(
      `select xmin::text as written from board where id = $1
       union all select xmin::text from membership where board_id = $1
       union all select count(*)::text from event_log where board_id = $1`,
      [boardId],
    )
    return rows.map(r => r.written)
  }
  finally {
    await client.end()
  }
}

test('the check answers the version the whole Board has, to its Members only', async () => {
  const { board, rubin, carson } = await sharedBoard('Versionsküche')
  expect(board.version).toEqual(expect.any(Number))
  expect(await versionOf(rubin, board.id)).toBe(board.version)
  expect(await versionOf(carson, board.id)).toBe(board.version)

  const cannon = await outsider()
  expect((await cannon.fetch(`/api/boards/${board.id}/version`)).status).toBe(404)
  expect((await rubin.fetch(`/api/boards/${MISSING}/version`)).status).toBe(404)
  expect((await rubin.fetch('/api/boards/not-a-board/version')).status).toBe(404)
})

test('the check writes nothing', async () => {
  const { board, rubin } = await sharedBoard('Stille Küche')
  const before = await rowVersions(board.id)
  for (let i = 0; i < 3; i++) await versionOf(rubin, board.id)
  expect(await rowVersions(board.id)).toEqual(before)
})

test('reading, opening and polling the Board leave its version where it is', async () => {
  const { board, rubin, carson } = await sharedBoard('Lesestube')
  const dish = await addDish(carson, board.id)
  const version = await versionOf(rubin, board.id)

  expect((await send(rubin, 'POST', `/api/boards/${board.id}/open`)).status).toBe(204)
  expect((await send(rubin, 'POST', `/api/boards/${board.id}/seen`)).status).toBe(200)
  expect((await send(rubin, 'POST', `/api/dishes/${dish.id}/open`)).status).toBe(200)
  await getBoard(rubin, board.id)
  expect((await rubin.fetch('/api/boards')).status).toBe(200)

  expect(await versionOf(rubin, board.id)).toBe(version)
})

test('every change to the Board\'s Dishes moves its version on', async () => {
  const { board, rubin, carson } = await sharedBoard('Dishküche')
  const [ideas, , gekocht] = board.columns as [Column, Column, Column]
  let dish!: { id: string }
  await expectMoves(carson, board.id, async () => {
    const res = await postDish(carson, board.id, { title: 'Ramen', placeholder: 'bowl' })
    dish = await res.clone().json()
    return res
  }, 201)
  await expectMoves(rubin, board.id, () => send(rubin, 'PATCH', `/api/dishes/${dish.id}`, { title: 'Miso-Ramen' }))
  await expectMoves(rubin, board.id, () => send(rubin, 'POST', `/api/dishes/${dish.id}/move`, { columnId: ideas.id, index: 0 }))

  // Cooked: a Cooking, then a Vote, changed and taken back.
  let cookingId!: string
  await expectMoves(rubin, board.id, async () => {
    const res = await send(rubin, 'POST', `/api/dishes/${dish.id}/move`, { columnId: gekocht.id })
    cookingId = (await res.clone().json()).cooking.id
    return res
  })
  await expectMoves(carson, board.id, () => send(carson, 'PUT', `/api/dishes/${dish.id}/vote`, { up: true }))
  await expectMoves(carson, board.id, () => send(carson, 'PUT', `/api/dishes/${dish.id}/vote`, { up: false }))
  await expectMoves(carson, board.id, () => send(carson, 'DELETE', `/api/dishes/${dish.id}/vote`), 204)
  await expectMoves(rubin, board.id, () => send(rubin, 'DELETE', `/api/cookings/${cookingId}`), 204)
  await expectMoves(rubin, board.id, () => send(rubin, 'POST', `/api/cookings/${cookingId}/restore`))

  // Comments: written, edited, deleted, brought back.
  let commentId!: string
  await expectMoves(carson, board.id, async () => {
    const res = await send(carson, 'POST', `/api/dishes/${dish.id}/comments`, { text: 'Mehr Ingwer!' })
    commentId = (await res.clone().json()).id
    return res
  }, 201)
  await expectMoves(carson, board.id, () => send(carson, 'PATCH', `/api/comments/${commentId}`, { text: 'Viel mehr Ingwer!' }))
  await expectMoves(carson, board.id, () => send(carson, 'DELETE', `/api/comments/${commentId}`), 204)
  await expectMoves(carson, board.id, () => send(carson, 'POST', `/api/comments/${commentId}/restore`))

  // Archived, restored, and archived again and purged: a hard delete.
  await expectMoves(rubin, board.id, () => send(rubin, 'DELETE', `/api/dishes/${dish.id}`), 204)
  await expectMoves(rubin, board.id, () => send(rubin, 'POST', `/api/dishes/${dish.id}/restore`))
  expect((await send(rubin, 'DELETE', `/api/dishes/${dish.id}`)).status).toBe(204)
  await expectMoves(rubin, board.id, () => send(rubin, 'POST', `/api/dishes/${dish.id}/purge`), 204)
})

test('a Dish moved to another Board moves both Boards\' versions on', async () => {
  const { board, rubin } = await sharedBoard('Abgabeküche')
  const other = (await (await send(rubin, 'POST', '/api/boards', { name: 'Annahmeküche', emoji: '🍜' })).json()) as { id: string }
  const target = await getBoard(rubin, other.id)
  const dish = await addDish(rubin, board.id)
  const [fromBefore, toBefore] = [await versionOf(rubin, board.id), await versionOf(rubin, other.id)]

  expect((await send(rubin, 'POST', `/api/dishes/${dish.id}/move`, { columnId: target.columns[0]!.id })).status).toBe(200)

  expect(await versionOf(rubin, board.id)).toBeGreaterThan(fromBefore)
  expect(await versionOf(rubin, other.id)).toBeGreaterThan(toBefore)
})

test('every change to the Board\'s Columns, Members, name, emoji and Invite Link moves its version on', async () => {
  const { board, rubin, carson } = await sharedBoard('Spaltenküche')
  let columnId!: string
  await expectMoves(rubin, board.id, async () => {
    const res = await send(rubin, 'POST', `/api/boards/${board.id}/columns`, { name: 'Bald' })
    columnId = (await res.clone().json()).id
    return res
  }, 201)
  await expectMoves(rubin, board.id, () => send(rubin, 'PATCH', `/api/columns/${columnId}`, { subtitle: 'Am Wochenende' }))
  const ids = [columnId, ...board.columns.map(c => c.id)]
  await expectMoves(rubin, board.id, () => send(rubin, 'PUT', `/api/boards/${board.id}/columns`, { columnIds: ids }))
  await expectMoves(rubin, board.id, () => send(rubin, 'DELETE', `/api/columns/${columnId}`), 204)

  await expectMoves(rubin, board.id, () => send(rubin, 'PATCH', `/api/boards/${board.id}`, { name: 'Neue Spaltenküche' }))
  await expectMoves(rubin, board.id, () => send(rubin, 'PATCH', `/api/boards/${board.id}`, { emoji: '🍕' }))
  await expectMoves(rubin, board.id, () => send(rubin, 'POST', `/api/boards/${board.id}/invite/reset`))

  // A Member changes how they show on it, gets ownership, leaves, comes back.
  await expectMoves(carson, board.id, () => send(carson, 'PUT', '/api/me/username', { username: 'Carsonia' }))
  const carsonId = await idOf(carson)
  await expectMoves(rubin, board.id, () => send(rubin, 'POST', `/api/boards/${board.id}/owner`, { userId: carsonId }), 204)
  const rubinId = await idOf(rubin)
  await expectMoves(carson, board.id, () => send(carson, 'POST', `/api/boards/${board.id}/owner`, { userId: rubinId }), 204)
  await expectMoves(rubin, board.id, () => send(rubin, 'DELETE', `/api/boards/${board.id}/members/${carsonId}`), 204)
  const { inviteToken } = await getBoard(rubin, board.id)
  await expectMoves(rubin, board.id, () => send(carson, 'POST', `/api/invites/${inviteToken}/join`))
})

test('archiving the Board and restoring it moves its version on', async () => {
  const { board, rubin } = await sharedBoard('Archivküche')
  const before = await versionOf(rubin, board.id)
  expect((await send(rubin, 'DELETE', `/api/boards/${board.id}`)).status).toBe(204)
  // Archived, it is no Member's: the check says "not found" like the Board.
  expect((await rubin.fetch(`/api/boards/${board.id}/version`)).status).toBe(404)
  expect((await send(rubin, 'POST', `/api/boards/${board.id}/restore`)).status).toBe(200)
  expect(await versionOf(rubin, board.id)).toBeGreaterThan(before)
})
