import { expect, test } from 'vitest'
import sharp from 'sharp'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { everyEventAsText, watchEvents } from './event-log'

// The event log (#331): what happens on Boards is recorded, one event per
// write, in the same transaction, so the Operator's Admin Page (#321) has
// history to count. Each event says when, what kind, which Board, Dish and
// user, and a few details that are never content. A write that is refused
// records nothing. Teitelbaum owns the Boards made here, Wexler joins them,
// Sinclair is the outsider; all three are used by this file only.

interface Cooking { id: string }
interface Dish {
  id: string
  cooking?: Cooking
}
interface Column {
  id: string
  isGekocht: boolean
  dishes: Dish[]
}
interface Board {
  id: string
  inviteToken: string
  columns: Column[]
}

const owner = () => signIn(ALLOWLISTED[82])
const member = () => signIn(ALLOWLISTED[83])
const outsider = () => signIn(ALLOWLISTED[84])

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

async function createBoard(caller: Caller, name: string): Promise<Board> {
  const res = await post(caller, '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  return getBoard(caller, (await res.json() as { id: string }).id)
}

// The Board's Columns by role: the first two and the Gekocht Column.
function columnsOf(board: Board) {
  return { ideen: board.columns[0]!, dieseWoche: board.columns[1]!, gekocht: board.columns.find(c => c.isGekocht)! }
}

async function addDish(caller: Caller, boardId: string, title: string, extra: Record<string, unknown> = {}): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl', ...extra })
  expect(res.status).toBe(201)
  return res.json()
}

const moveDish = (caller: Caller, dishId: string, columnId: string, index?: number) =>
  post(caller, `/api/dishes/${dishId}/move`, { columnId, index })
const bulk = (caller: Caller, body: unknown) => post(caller, '/api/dishes/bulk', body)
const join = (caller: Caller, board: Board) => post(caller, `/api/invites/${board.inviteToken}/join`)
const removeMember = (caller: Caller, boardId: string, userId: string) =>
  caller.fetch(`/api/boards/${boardId}/members/${userId}`, { method: 'DELETE' })

test('a first landing creates the starter Board, and records it as a starter', async () => {
  const log = await watchEvents()
  const sinclair = await outsider()

  const { boardId } = await (await sinclair.fetch('/api/boards/landing')).json() as { boardId: string }

  expect(await log.recorded()).toEqual([
    { kind: 'board_created', boardId, dishId: null, userId: await idOf(sinclair), details: { starter: true } },
  ])
})

test('creating a Board records it, by whoever created it', async () => {
  const teitelbaum = await owner()
  const log = await watchEvents()

  const board = await createBoard(teitelbaum, 'Sonntagsessen')

  expect(await log.recorded()).toEqual([
    { kind: 'board_created', boardId: board.id, dishId: null, userId: await idOf(teitelbaum), details: null },
  ])
})

test('adding a Dish records it with the kind of its Source, and none for a Dish without one', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Vorrat')
  const log = await watchEvents()

  const linked = await addDish(teitelbaum, board.id, 'Shakshuka', { source: { link: 'https://www.tiktok.com/@koch/video/7300000000000000001' } })
  const unlinked = await addDish(teitelbaum, board.id, 'Omas Linsensuppe')
  const toured = await addDish(teitelbaum, board.id, 'Rundgang-Suppe', { tour: true })

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'dish_added', boardId: board.id, dishId: linked.id, userId, details: { source: 'tiktok' } },
    { kind: 'dish_added', boardId: board.id, dishId: unlinked.id, userId, details: { source: null } },
    { kind: 'dish_added', boardId: board.id, dishId: toured.id, userId, details: { source: null, tour: true } },
  ])
})

test('a Dish added to a Board the user isn\'t a Member of records nothing', async () => {
  const board = await createBoard(await owner(), 'Geheimrezepte')
  const log = await watchEvents()

  expect((await postDish(await outsider(), board.id, { title: 'Eindringling', placeholder: 'bowl' })).status).toBe(404)

  expect(await log.recorded()).toEqual([])
})

test('moving a Dish records from which Column to which; one already on top of that Column records nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Wochenplan')
  const { ideen, dieseWoche } = columnsOf(board)
  const dish = await addDish(teitelbaum, board.id, 'Ratatouille')
  await addDish(teitelbaum, board.id, 'Kartoffelsalat')
  const log = await watchEvents()

  expect((await moveDish(teitelbaum, dish.id, dieseWoche.id)).status).toBe(200)
  expect((await moveDish(teitelbaum, dish.id, dieseWoche.id)).status).toBe(200)
  // A drop is a move, also within its own Column.
  expect((await moveDish(teitelbaum, dish.id, ideen.id, 1)).status).toBe(200)
  expect((await moveDish(teitelbaum, dish.id, ideen.id, 0)).status).toBe(200)

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'dish_moved', boardId: board.id, dishId: dish.id, userId, details: { from: ideen.id, to: dieseWoche.id } },
    { kind: 'dish_moved', boardId: board.id, dishId: dish.id, userId, details: { from: dieseWoche.id, to: ideen.id } },
    { kind: 'dish_moved', boardId: board.id, dishId: dish.id, userId, details: { from: ideen.id, to: ideen.id } },
  ])
})

test('a Dish moved to another Board is recorded on that Board, naming the one it came from', async () => {
  const teitelbaum = await owner()
  const from = await createBoard(teitelbaum, 'Alt')
  const to = await createBoard(teitelbaum, 'Neu')
  const dish = await addDish(teitelbaum, from.id, 'Wanderndes Curry')
  const log = await watchEvents()

  expect((await moveDish(teitelbaum, dish.id, to.columns[0]!.id)).status).toBe(200)

  expect(await log.recorded()).toEqual([{
    kind: 'dish_moved',
    boardId: to.id,
    dishId: dish.id,
    userId: await idOf(teitelbaum),
    details: { from: from.columns[0]!.id, to: to.columns[0]!.id, fromBoard: from.id },
  }])
})

test('a move the user may not make records nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Privat')
  const foreign = await createBoard(await outsider(), 'Fremd')
  const dish = await addDish(teitelbaum, board.id, 'Bleibt hier')
  const log = await watchEvents()

  expect((await moveDish(await outsider(), dish.id, foreign.columns[0]!.id)).status).toBe(404)
  expect((await moveDish(teitelbaum, dish.id, foreign.columns[0]!.id)).status).toBe(400)

  expect(await log.recorded()).toEqual([])
})

test('moving a Dish into Gekocht records the move and the Cooking; "Gekocht ✓" on one already there only the Cooking', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Küche')
  const { ideen, gekocht } = columnsOf(board)
  const dish = await addDish(teitelbaum, board.id, 'Pad Thai')
  const log = await watchEvents()

  const first = (await (await moveDish(teitelbaum, dish.id, gekocht.id)).json() as Dish).cooking!
  const second = (await (await post(teitelbaum, `/api/dishes/${dish.id}/cook`)).json() as Dish).cooking!

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'dish_moved', boardId: board.id, dishId: dish.id, userId, details: { from: ideen.id, to: gekocht.id } },
    { kind: 'cooking_recorded', boardId: board.id, dishId: dish.id, userId, details: { cooking: first.id } },
    { kind: 'cooking_recorded', boardId: board.id, dishId: dish.id, userId, details: { cooking: second.id } },
  ])
})

test('"Rückgängig" after cooking records the Cooking deleted and the Dish moved back, both as undone', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Abendbrot')
  const { ideen, gekocht } = columnsOf(board)
  const dish = await addDish(teitelbaum, board.id, 'Gnocchi')
  const cooking = (await (await moveDish(teitelbaum, dish.id, gekocht.id)).json() as Dish).cooking!
  const log = await watchEvents()

  expect((await post(teitelbaum, `/api/cookings/${cooking.id}/undo`, { columnId: ideen.id, index: 0 })).status).toBe(200)
  // Undone already: nothing more to record.
  expect((await post(teitelbaum, `/api/cookings/${cooking.id}/undo`, { columnId: ideen.id, index: 0 })).status).toBe(404)

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'cooking_deleted', boardId: board.id, dishId: dish.id, userId, details: { cooking: cooking.id, undo: true } },
    { kind: 'dish_moved', boardId: board.id, dishId: dish.id, userId, details: { from: gekocht.id, to: ideen.id, undo: true } },
  ])
})

test('deleting a Cooking records it, and restoring it records that; a Cooking not deleted restores without an event', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Verlauf')
  const { gekocht } = columnsOf(board)
  const dish = await addDish(teitelbaum, board.id, 'Ramen')
  const cooking = (await (await moveDish(teitelbaum, dish.id, gekocht.id)).json() as Dish).cooking!
  const log = await watchEvents()

  expect((await teitelbaum.fetch(`/api/cookings/${cooking.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await teitelbaum.fetch(`/api/cookings/${cooking.id}`, { method: 'DELETE' })).status).toBe(404)
  expect((await post(teitelbaum, `/api/cookings/${cooking.id}/restore`)).status).toBe(200)
  expect((await post(teitelbaum, `/api/cookings/${cooking.id}/restore`)).status).toBe(200)
  expect((await (await outsider()).fetch(`/api/cookings/${cooking.id}`, { method: 'DELETE' })).status).toBe(404)

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'cooking_deleted', boardId: board.id, dishId: dish.id, userId, details: { cooking: cooking.id } },
    { kind: 'cooking_restored', boardId: board.id, dishId: dish.id, userId, details: { cooking: cooking.id } },
  ])
})

test('deleting a Dish records it archived, and undo records it restored; repeating either records nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Archivprobe')
  const dish = await addDish(teitelbaum, board.id, 'Apfelkuchen')
  const log = await watchEvents()

  expect((await (await outsider()).fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(404)
  expect((await teitelbaum.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await teitelbaum.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(404)
  expect((await post(teitelbaum, `/api/dishes/${dish.id}/restore`)).status).toBe(200)
  expect((await post(teitelbaum, `/api/dishes/${dish.id}/restore`)).status).toBe(200)

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'dish_archived', boardId: board.id, dishId: dish.id, userId, details: null },
    { kind: 'dish_restored', boardId: board.id, dishId: dish.id, userId, details: null },
  ])
})

test('several Dishes moved, put back, deleted and restored at once record an event each', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Stapel')
  const { ideen, dieseWoche } = columnsOf(board)
  const a = await addDish(teitelbaum, board.id, 'Tacos')
  const b = await addDish(teitelbaum, board.id, 'Burritos')
  const there = await addDish(teitelbaum, board.id, 'Schon dort')
  await moveDish(teitelbaum, there.id, dieseWoche.id)
  const log = await watchEvents()

  expect((await bulk(teitelbaum, { action: 'move', dishIds: [a.id, b.id, there.id], columnId: dieseWoche.id })).status).toBe(200)
  expect((await bulk(teitelbaum, { action: 'place', places: [
    { dishId: a.id, columnId: ideen.id, index: 0 },
    { dishId: b.id, columnId: ideen.id, index: 1 },
    { dishId: there.id, columnId: dieseWoche.id, index: 0 },
  ] })).status).toBe(200)
  expect((await bulk(teitelbaum, { action: 'delete', dishIds: [a.id, b.id] })).status).toBe(204)
  expect((await bulk(teitelbaum, { action: 'restore', dishIds: [a.id, b.id] })).status).toBe(200)

  const userId = await idOf(teitelbaum)
  const recorded = await log.recorded()
  const event = (kind: string, dishId: string, details: Record<string, unknown> | null = null) => ({ kind, boardId: board.id, dishId, userId, details })
  expect(recorded).toHaveLength(8)
  expect(recorded.slice(0, 2)).toEqual(expect.arrayContaining([
    event('dish_moved', a.id, { from: ideen.id, to: dieseWoche.id }),
    event('dish_moved', b.id, { from: ideen.id, to: dieseWoche.id }),
  ]))
  expect(recorded.slice(2, 4)).toEqual(expect.arrayContaining([
    event('dish_moved', a.id, { from: dieseWoche.id, to: ideen.id, undo: true }),
    event('dish_moved', b.id, { from: dieseWoche.id, to: ideen.id, undo: true }),
  ]))
  expect(recorded.slice(4, 6)).toEqual(expect.arrayContaining([event('dish_archived', a.id), event('dish_archived', b.id)]))
  expect(recorded.slice(6)).toEqual(expect.arrayContaining([event('dish_restored', a.id), event('dish_restored', b.id)]))
})

test('several Dishes refused at once, for one the user may not touch, record nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Gemischt')
  const foreign = await createBoard(await outsider(), 'Nicht meins')
  const mine = await addDish(teitelbaum, board.id, 'Meins')
  const theirs = await addDish(await outsider(), foreign.id, 'Deins')
  const log = await watchEvents()

  expect((await bulk(teitelbaum, { action: 'move', dishIds: [mine.id, theirs.id], columnId: board.columns[1]!.id })).status).toBe(404)
  expect((await bulk(teitelbaum, { action: 'delete', dishIds: [mine.id, theirs.id] })).status).toBe(404)
  expect((await bulk(teitelbaum, { action: 'restore', dishIds: [mine.id, theirs.id] })).status).toBe(404)

  expect(await log.recorded()).toEqual([])
})

test('joining through the Invite Link records it once; leaving and being removed are recorded too', async () => {
  const teitelbaum = await owner()
  const wexler = await member()
  const board = await createBoard(teitelbaum, 'Tischrunde')
  const [ownerId, memberId] = [await idOf(teitelbaum), await idOf(wexler)]
  const log = await watchEvents()

  expect((await join(wexler, board)).status).toBe(200)
  // Following it again opens the Board; it is no second join.
  expect((await join(wexler, board)).status).toBe(200)
  expect((await removeMember(wexler, board.id, memberId)).status).toBe(204)
  expect((await join(wexler, board)).status).toBe(200)
  expect((await removeMember(teitelbaum, board.id, memberId)).status).toBe(204)

  const event = (kind: string, userId: string, details: Record<string, unknown> | null = null) => ({ kind, boardId: board.id, dishId: null, userId, details })
  expect(await log.recorded()).toEqual([
    event('member_joined', memberId),
    event('member_left', memberId),
    event('member_joined', memberId),
    event('member_removed', ownerId, { member: memberId }),
  ])
})

test('the Owner leaving, a Member removing someone, or removing nobody records nothing', async () => {
  const teitelbaum = await owner()
  const wexler = await member()
  const board = await createBoard(teitelbaum, 'Stammtisch')
  await join(wexler, board)
  const [ownerId, memberId] = [await idOf(teitelbaum), await idOf(wexler)]
  const log = await watchEvents()

  expect((await removeMember(teitelbaum, board.id, ownerId)).status).not.toBe(204)
  expect((await removeMember(wexler, board.id, ownerId)).status).not.toBe(204)
  expect((await removeMember(teitelbaum, board.id, await idOf(await outsider()))).status).not.toBe(204)

  expect(await log.recorded()).toEqual([])
  expect((await removeMember(wexler, board.id, memberId)).status).toBe(204)
})

test('deleting (archiving) a Board records it; only its Owner\'s delete does', async () => {
  const teitelbaum = await owner()
  const wexler = await member()
  const board = await createBoard(teitelbaum, 'Abriss')
  await join(wexler, board)
  const log = await watchEvents()

  expect((await wexler.fetch(`/api/boards/${board.id}`, { method: 'DELETE' })).status).toBe(403)
  expect((await teitelbaum.fetch(`/api/boards/${board.id}`, { method: 'DELETE' })).status).toBe(204)

  expect(await log.recorded()).toEqual([
    { kind: 'board_archived', boardId: board.id, dishId: null, userId: await idOf(teitelbaum), details: null },
  ])
})

test('a Comment written, edited, deleted and restored records each, by whoever did it; what changes nothing records nothing', async () => {
  const teitelbaum = await owner()
  const wexler = await member()
  const board = await createBoard(teitelbaum, 'Gesprächsrunde')
  await join(wexler, board)
  const dish = await addDish(teitelbaum, board.id, 'Dal')
  const log = await watchEvents()

  const res = await post(wexler, `/api/dishes/${dish.id}/comments`, { text: 'Mehr Kreuzkümmel' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const edit = (caller: Caller, text: string) => caller.fetch(`/api/comments/${id}`, { method: 'PATCH', ...json({ text }) })
  expect((await edit(wexler, 'Viel mehr Kreuzkümmel')).status).toBe(200)
  // The same text again is no edit.
  expect((await edit(wexler, 'Viel mehr Kreuzkümmel')).status).toBe(200)
  expect((await teitelbaum.fetch(`/api/comments/${id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await post(teitelbaum, `/api/comments/${id}/restore`)).status).toBe(200)
  expect((await post(teitelbaum, `/api/comments/${id}/restore`)).status).toBe(200)

  const [ownerId, memberId] = [await idOf(teitelbaum), await idOf(wexler)]
  const event = (kind: string, userId: string) => ({ kind, boardId: board.id, dishId: dish.id, userId, details: { comment: id } })
  expect(await log.recorded()).toEqual([
    event('comment_written', memberId),
    event('comment_edited', memberId),
    event('comment_deleted', ownerId),
    event('comment_restored', ownerId),
  ])
})

test('a Comment refused records nothing: empty, by an outsider, edited or deleted by someone who may not', async () => {
  const teitelbaum = await owner()
  const wexler = await member()
  const board = await createBoard(teitelbaum, 'Abgelehnt')
  await join(wexler, board)
  const dish = await addDish(teitelbaum, board.id, 'Dal')
  const { id } = await (await post(teitelbaum, `/api/dishes/${dish.id}/comments`, { text: 'Vom Owner' })).json() as { id: string }
  const log = await watchEvents()

  expect((await post(wexler, `/api/dishes/${dish.id}/comments`, { text: '  ' })).status).toBe(400)
  expect((await post(await outsider(), `/api/dishes/${dish.id}/comments`, { text: 'Hallo' })).status).toBe(404)
  expect((await wexler.fetch(`/api/comments/${id}`, { method: 'PATCH', ...json({ text: 'Fremd' }) })).status).toBe(403)
  expect((await wexler.fetch(`/api/comments/${id}`, { method: 'DELETE' })).status).toBe(403)
  expect((await post(wexler, `/api/comments/${id}/restore`)).status).toBe(403)

  expect(await log.recorded()).toEqual([])
})

test('adding, renaming, subtitling, reordering and deleting Columns each record an event; what changes nothing records nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Spalten')
  const log = await watchEvents()

  const added = await post(teitelbaum, `/api/boards/${board.id}/columns`, { name: 'Vielleicht' })
  expect(added.status).toBe(201)
  const column = await added.json() as { id: string }
  const patch = (body: unknown) => teitelbaum.fetch(`/api/columns/${column.id}`, { method: 'PATCH', ...json(body) })
  expect((await patch({ name: 'Irgendwann' })).status).toBe(200)
  // The same name again is no rename.
  expect((await patch({ name: 'Irgendwann' })).status).toBe(200)
  expect((await patch({ subtitle: 'Für Gäste' })).status).toBe(200)
  expect((await patch({ subtitle: 'Für Gäste' })).status).toBe(200)
  expect((await patch({ name: 'Bald', subtitle: null })).status).toBe(200)

  const columns = (await getBoard(teitelbaum, board.id)).columns
  const reordered = [columns[1]!, columns[0]!, ...columns.slice(2)]
  expect((await teitelbaum.fetch(`/api/boards/${board.id}/columns`, { method: 'PUT', ...json({ columnIds: reordered.map(c => c.id) }) })).status).toBe(200)
  expect((await teitelbaum.fetch(`/api/columns/${column.id}`, { method: 'DELETE' })).status).toBe(204)

  const userId = await idOf(teitelbaum)
  const event = (kind: string, details: Record<string, unknown> | null = null) => ({ kind, boardId: board.id, dishId: null, userId, details })
  expect(await log.recorded()).toEqual([
    event('column_added', { column: column.id }),
    event('column_renamed', { column: column.id }),
    event('column_subtitle_changed', { column: column.id, on: true }),
    event('column_renamed', { column: column.id }),
    event('column_subtitle_changed', { column: column.id, on: false }),
    event('column_reordered'),
    event('column_deleted', { column: column.id }),
  ])
})

test('renaming a Board and changing its emoji each record an event; the same name or emoji records nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Alt')
  const log = await watchEvents()
  const patch = (body: unknown) => teitelbaum.fetch(`/api/boards/${board.id}`, { method: 'PATCH', ...json(body) })

  expect((await patch({ name: 'Neu' })).status).toBe(200)
  expect((await patch({ name: 'Neu' })).status).toBe(200)
  expect((await patch({ emoji: '🍲' })).status).toBe(200)
  expect((await patch({ name: 'Neu', emoji: '🍲' })).status).toBe(200)

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'board_renamed', boardId: board.id, dishId: null, userId, details: null },
    { kind: 'board_emoji_changed', boardId: board.id, dishId: null, userId, details: null },
  ])
})

test('resetting the Invite Link records it, by the Owner', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Einladung')
  const log = await watchEvents()

  expect((await post(teitelbaum, `/api/boards/${board.id}/invite/reset`)).status).toBe(200)
  expect((await post(teitelbaum, `/api/boards/${board.id}/invite/reset`)).status).toBe(200)

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'invite_link_reset', boardId: board.id, dishId: null, userId, details: null },
    { kind: 'invite_link_reset', boardId: board.id, dishId: null, userId, details: null },
  ])
})

test('handing ownership over records it, with the Member it went to', async () => {
  const teitelbaum = await owner()
  const wexler = await member()
  const board = await createBoard(teitelbaum, 'Staffel')
  await join(wexler, board)
  const [ownerId, memberId] = [await idOf(teitelbaum), await idOf(wexler)]
  const log = await watchEvents()

  expect((await post(teitelbaum, `/api/boards/${board.id}/owner`, { userId: memberId })).ok).toBe(true)

  expect(await log.recorded()).toEqual([
    { kind: 'ownership_handed_over', boardId: board.id, dishId: null, userId: ownerId, details: { member: memberId } },
  ])
})

test('a Member\'s Permission switched records which and whether it is on; the same setting records nothing', async () => {
  const teitelbaum = await owner()
  const wexler = await member()
  const board = await createBoard(teitelbaum, 'Rechte')
  await join(wexler, board)
  const memberId = await idOf(wexler)
  const setPermissions = (body: unknown) => teitelbaum.fetch(`/api/boards/${board.id}/members/${memberId}/permissions`, { method: 'PATCH', ...json(body) })
  expect((await setPermissions({ addDishes: false, editDishes: false })).status).toBe(200)
  const log = await watchEvents()

  expect((await setPermissions({ addDishes: true, editDishes: false })).status).toBe(200)
  expect((await setPermissions({ addDishes: true })).status).toBe(200)
  expect((await setPermissions({ editDishes: true })).status).toBe(200)

  const userId = await idOf(teitelbaum)
  expect(await log.recorded()).toEqual([
    { kind: 'permission_changed', boardId: board.id, dishId: null, userId, details: { member: memberId, permission: 'addDishes', on: true } },
    { kind: 'permission_changed', boardId: board.id, dishId: null, userId, details: { member: memberId, permission: 'editDishes', on: true } },
  ])
})

test('the Board\'s Default Permissions switched record which and whether it is on; the same setting records nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Vorgabe')
  const setDefaults = (body: unknown) => teitelbaum.fetch(`/api/boards/${board.id}/default-permissions`, { method: 'PATCH', ...json(body) })
  expect((await setDefaults({ editDishes: false })).status).toBe(200)
  const log = await watchEvents()

  expect((await setDefaults({ editDishes: true })).status).toBe(200)
  expect((await setDefaults({ editDishes: true })).status).toBe(200)

  expect(await log.recorded()).toEqual([
    { kind: 'default_permission_changed', boardId: board.id, dishId: null, userId: await idOf(teitelbaum), details: { permission: 'editDishes', on: true } },
  ])
})

test('editing a Dish records which of its fields changed, never their values; an edit that changes nothing records nothing', async () => {
  const teitelbaum = await owner()
  const board = await createBoard(teitelbaum, 'Bearbeitet')
  const bytes = await sharp({ create: { width: 900, height: 1600, channels: 3, background: '#7a4' } }).jpeg().toBuffer()
  const uploadRes = await teitelbaum.fetch(`/api/boards/${board.id}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
  const photo = await uploadRes.json() as { url: string, ticket: string }
  const dish = await addDish(teitelbaum, board.id, 'Shakshuka', { source: { link: 'https://www.tiktok.com/@koch/video/7300000000000000001' }, photo })
  const log = await watchEvents()
  const edit = (body: unknown) => teitelbaum.fetch(`/api/dishes/${dish.id}`, { method: 'PATCH', ...json(body) })

  expect((await edit({ title: 'Shakshuka mit Ei' })).status).toBe(200)
  expect((await edit({ title: 'Shakshuka mit Ei' })).status).toBe(200)
  expect((await edit({ creator: 'Mara' })).status).toBe(200)
  expect((await edit({ source: { link: 'https://www.tiktok.com/@koch/video/7300000000000000002' } })).status).toBe(200)
  expect((await edit({ imageFocus: { x: 10, y: 20 } })).status).toBe(200)
  expect((await edit({ title: 'Shakshuka, scharf', creator: 'Tom' })).status).toBe(200)

  const userId = await idOf(teitelbaum)
  const event = (fields: string[]) => ({ kind: 'dish_edited', boardId: board.id, dishId: dish.id, userId, details: { fields } })
  expect(await log.recorded()).toEqual([
    event(['title']),
    event(['creator']),
    event(['source']),
    event(['focus']),
    event(['title', 'creator']),
  ])
})

test('the log holds no content: no titles, Comments, Board names, Usernames or emails', async () => {
  const text = await everyEventAsText()

  expect(text).not.toBe('')
  for (const content of ['Shakshuka', 'Linsensuppe', 'tiktok.com', 'Sonntagsessen', 'Tischrunde', 'Kreuzkümmel', 'Vom Owner', 'teitelbaum', 'wexler', 'sinclair', 'example.com', 'Mara', 'Für Gäste', 'Vielleicht', 'Irgendwann']) {
    expect(text).not.toContain(content)
  }
})
