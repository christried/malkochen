import { expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { CRON_SECRET } from './server-env'
import { backdateDeletion } from './time-travel'

// Comments and the Dish History (#332; PRD #318 stories 1–13): a Member
// writes a Comment on a Dish, its author edits it (then "bearbeitet") or
// deletes it (and "Rückgängig" brings it back), and the Owner deletes any.
// The Dish History is built on the server: when the Dish was added, its
// Cookings and its Comments, oldest first. Lamarr owns the Boards made here,
// Mirzakhani joins them, Goeppert is the outsider; all three are used by this
// file only.

interface Person { id: string, name: string, image: string | null }
interface Comment {
  id: string
  text: string
  createdAt: string
  editedAt: string | null
  author: Person | null
}
interface Cooking { id: string, cookedAt: string, recordedBy: Person | null }
type Entry =
  | { kind: 'added', at: string, by: Person | null }
  | { kind: 'cooking', at: string, cooking: Cooking }
  | { kind: 'comment', at: string, comment: Comment }
interface History { dishId: string, entries: Entry[] }
interface Dish { id: string, createdAt: string, cooking?: Cooking }
interface Board {
  id: string
  inviteToken: string
  columns: { id: string, isGekocht: boolean }[]
}

const owner = () => signIn(ALLOWLISTED[88])
const member = () => signIn(ALLOWLISTED[89])
const outsider = () => signIn(ALLOWLISTED[90])
const MISSING = '00000000-0000-4000-8000-000000000000'

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

const writeComment = (caller: Caller, dishId: string, text: unknown) => post(caller, `/api/dishes/${dishId}/comments`, { text })
const editComment = (caller: Caller, commentId: string, text: unknown) =>
  caller.fetch(`/api/comments/${commentId}`, { method: 'PATCH', ...json({ text }) })
const deleteComment = (caller: Caller, commentId: string) => caller.fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
const restoreComment = (caller: Caller, commentId: string) => post(caller, `/api/comments/${commentId}/restore`)
const historyOf = (caller: Caller, dishId: string) => caller.fetch(`/api/dishes/${dishId}/open`, { method: 'POST' })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

// A new Board of the owner's that the member has joined.
async function sharedBoard(name: string): Promise<{ board: Board, lamarr: Caller, mirzakhani: Caller }> {
  const lamarr = await owner()
  const res = await post(lamarr, '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const board = await (await lamarr.fetch(`/api/boards/${id}`)).json() as Board
  const mirzakhani = await member()
  expect((await post(mirzakhani, `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return { board, lamarr, mirzakhani }
}

async function addDish(caller: Caller, boardId: string, title = 'Linsensuppe'): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

async function written(caller: Caller, dishId: string, text: string): Promise<Comment> {
  const res = await writeComment(caller, dishId, text)
  expect(res.status).toBe(201)
  return res.json()
}

async function history(caller: Caller, dishId: string): Promise<Entry[]> {
  const res = await historyOf(caller, dishId)
  expect(res.status).toBe(200)
  return (await res.json() as History).entries
}

const commentsIn = (entries: Entry[]) => entries.flatMap(e => e.kind === 'comment' ? [e.comment] : [])

test('a Member writes a Comment: trimmed, by them, unedited, and in the Dish History', async () => {
  const { board, lamarr, mirzakhani } = await sharedBoard('Kommentare')
  const dish = await addDish(lamarr, board.id)
  const before = Date.now()

  const comment = await written(mirzakhani, dish.id, '  Hab statt Sahne Hafercuisine genommen.\n')

  expect(comment).toMatchObject({
    text: 'Hab statt Sahne Hafercuisine genommen.',
    editedAt: null,
    author: { id: await idOf(mirzakhani), name: expect.any(String) },
  })
  expect(Date.parse(comment.createdAt)).toBeGreaterThanOrEqual(before - 5000)
  expect(commentsIn(await history(lamarr, dish.id))).toEqual([comment])
})

test.each([
  ['empty', ''],
  ['only spaces', '   \n '],
  ['longer than 1000 characters', 'x'.repeat(1001)],
  ['not text', 42],
])('a Comment that is %s is refused', async (_, text) => {
  const { board, lamarr } = await sharedBoard('Leer')
  const dish = await addDish(lamarr, board.id)

  expect((await writeComment(lamarr, dish.id, text)).status).toBe(400)
  expect(commentsIn(await history(lamarr, dish.id))).toEqual([])
})

test('a Comment of exactly 1000 characters is taken', async () => {
  const { board, lamarr } = await sharedBoard('Lang')
  const dish = await addDish(lamarr, board.id)

  expect((await written(lamarr, dish.id, 'x'.repeat(1000))).text).toHaveLength(1000)
})

test('nobody comments on a Dish of a Board they are not a Member of, a missing Dish or an Archived Dish', async () => {
  const { board, lamarr } = await sharedBoard('Fremd')
  const dish = await addDish(lamarr, board.id)
  const archived = await addDish(lamarr, board.id, 'Archiviert')
  expect((await lamarr.fetch(`/api/dishes/${archived.id}`, { method: 'DELETE' })).status).toBe(204)

  expect((await writeComment(await outsider(), dish.id, 'Hallo')).status).toBe(404)
  expect((await writeComment(lamarr, MISSING, 'Hallo')).status).toBe(404)
  expect((await writeComment(lamarr, 'not-a-uuid', 'Hallo')).status).toBe(404)
  expect((await writeComment(lamarr, archived.id, 'Hallo')).status).toBe(404)
})

test('its author edits a Comment, which is then marked as edited; the same text again changes nothing', async () => {
  const { board, lamarr, mirzakhani } = await sharedBoard('Bearbeiten')
  const dish = await addDish(lamarr, board.id)
  const comment = await written(mirzakhani, dish.id, 'Zu salzig')

  const unchanged = await editComment(mirzakhani, comment.id, ' Zu salzig ')
  expect(unchanged.status).toBe(200)
  expect((await unchanged.json() as Comment).editedAt).toBeNull()

  const res = await editComment(mirzakhani, comment.id, '  Etwas zu salzig  ')
  expect(res.status).toBe(200)
  const edited = await res.json() as Comment
  expect(edited).toMatchObject({ id: comment.id, text: 'Etwas zu salzig', createdAt: comment.createdAt, author: comment.author })
  expect(edited.editedAt).not.toBeNull()
  expect(commentsIn(await history(lamarr, dish.id))).toEqual([edited])
})

test('editing to an empty or too long text is refused, and the Comment stays as it was', async () => {
  const { board, lamarr } = await sharedBoard('Leer bearbeiten')
  const dish = await addDish(lamarr, board.id)
  const comment = await written(lamarr, dish.id, 'Lecker')

  expect((await editComment(lamarr, comment.id, '  ')).status).toBe(400)
  expect((await editComment(lamarr, comment.id, 'x'.repeat(1001))).status).toBe(400)
  expect(commentsIn(await history(lamarr, dish.id))).toEqual([comment])
})

test('only its author edits a Comment: not another Member, not the Owner, not an outsider', async () => {
  const { board, lamarr, mirzakhani } = await sharedBoard('Fremde Kommentare')
  const dish = await addDish(lamarr, board.id)
  const mine = await written(mirzakhani, dish.id, 'Meiner')
  const owners = await written(lamarr, dish.id, 'Vom Owner')

  expect((await editComment(lamarr, mine.id, 'Geändert')).status).toBe(403)
  expect((await editComment(mirzakhani, owners.id, 'Geändert')).status).toBe(403)
  expect((await editComment(await outsider(), mine.id, 'Geändert')).status).toBe(404)
  expect((await editComment(lamarr, MISSING, 'Geändert')).status).toBe(404)
  expect(commentsIn(await history(lamarr, dish.id))).toEqual([mine, owners])
})

test('its author deletes their own Comment, and "Rückgängig" brings it back as it was', async () => {
  const { board, lamarr, mirzakhani } = await sharedBoard('Löschen')
  const dish = await addDish(lamarr, board.id)
  const comment = await written(mirzakhani, dish.id, 'Doch nicht')

  expect((await deleteComment(mirzakhani, comment.id)).status).toBe(204)
  expect(commentsIn(await history(lamarr, dish.id))).toEqual([])
  expect((await deleteComment(mirzakhani, comment.id)).status).toBe(404)
  expect((await editComment(mirzakhani, comment.id, 'Und doch')).status).toBe(404)

  const res = await restoreComment(mirzakhani, comment.id)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual(comment)
  expect(commentsIn(await history(lamarr, dish.id))).toEqual([comment])
  // Restoring one that isn't deleted changes nothing.
  expect((await restoreComment(mirzakhani, comment.id)).status).toBe(200)
})

test('the Owner deletes any Comment and may bring it back; another Member deletes only their own', async () => {
  const { board, lamarr, mirzakhani } = await sharedBoard('Owner löscht')
  const dish = await addDish(lamarr, board.id)
  const members = await written(mirzakhani, dish.id, 'Gehört hier nicht hin')
  const owners = await written(lamarr, dish.id, 'Vom Owner')

  expect((await deleteComment(mirzakhani, owners.id)).status).toBe(403)
  expect((await deleteComment(await outsider(), members.id)).status).toBe(404)
  expect((await deleteComment(lamarr, members.id)).status).toBe(204)
  expect(commentsIn(await history(mirzakhani, dish.id))).toEqual([owners])

  expect((await restoreComment(lamarr, members.id)).status).toBe(200)
  expect(commentsIn(await history(mirzakhani, dish.id))).toEqual([members, owners])
})

test('the Dish History begins with who added the Dish, then its Cookings and Comments oldest first; deleted ones and moves are left out', async () => {
  const { board, lamarr, mirzakhani } = await sharedBoard('Verlauf')
  const gekocht = board.columns.find(c => c.isGekocht)!
  const dish = await addDish(lamarr, board.id)
  const first = await written(mirzakhani, dish.id, 'Machen wir Freitag?')
  const cooked = (await (await post(lamarr, `/api/dishes/${dish.id}/move`, { columnId: gekocht.id })).json() as Dish).cooking!
  const second = await written(lamarr, dish.id, 'Hat allen geschmeckt')
  const gone = await written(lamarr, dish.id, 'Vertippt')
  expect((await deleteComment(lamarr, gone.id)).status).toBe(204)
  const deletedCooking = (await (await post(mirzakhani, `/api/dishes/${dish.id}/cook`)).json() as Dish).cooking!
  expect((await mirzakhani.fetch(`/api/cookings/${deletedCooking.id}`, { method: 'DELETE' })).status).toBe(204)
  // A move out of the Gekocht Column isn't part of it.
  expect((await post(lamarr, `/api/dishes/${dish.id}/move`, { columnId: board.columns[0]!.id })).status).toBe(200)

  const res = await historyOf(mirzakhani, dish.id)
  expect(res.status).toBe(200)
  const answer = await res.json() as History
  expect(answer.dishId).toBe(dish.id)
  expect(answer.entries).toEqual([
    { kind: 'added', at: dish.createdAt, by: expect.objectContaining({ id: await idOf(lamarr) }) },
    { kind: 'comment', at: first.createdAt, comment: first },
    { kind: 'cooking', at: cooked.cookedAt, cooking: expect.objectContaining({ id: cooked.id, recordedBy: expect.objectContaining({ id: await idOf(lamarr) }) }) },
    { kind: 'comment', at: second.createdAt, comment: second },
  ])
})

test('the Dish History is only for Members, and not of an Archived Dish', async () => {
  const { board, lamarr } = await sharedBoard('Nur Mitglieder')
  const dish = await addDish(lamarr, board.id)

  expect((await historyOf(await outsider(), dish.id)).status).toBe(404)
  expect((await historyOf(lamarr, MISSING)).status).toBe(404)
  expect((await lamarr.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await historyOf(lamarr, dish.id)).status).toBe(404)
})

test('an Archived Dish keeps its Comments, and brings them back when restored', async () => {
  const { board, lamarr } = await sharedBoard('Archiv')
  const dish = await addDish(lamarr, board.id)
  const comment = await written(lamarr, dish.id, 'Bleibt')
  expect((await lamarr.fetch(`/api/dishes/${dish.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await editComment(lamarr, comment.id, 'Archiviert')).status).toBe(404)
  expect((await deleteComment(lamarr, comment.id)).status).toBe(404)

  expect((await post(lamarr, `/api/dishes/${dish.id}/restore`)).status).toBe(200)

  expect(commentsIn(await history(lamarr, dish.id))).toEqual([comment])
})

test('a Comment deleted more than 30 days ago is purged by the cleanup; one deleted less long ago can still be restored', async () => {
  const { board, lamarr } = await sharedBoard('Aufräumen')
  const dish = await addDish(lamarr, board.id)
  const purged = await written(lamarr, dish.id, 'Weg')
  const kept = await written(lamarr, dish.id, 'Noch da')
  for (const { id } of [purged, kept]) expect((await deleteComment(lamarr, id)).status).toBe(204)
  await backdateDeletion('comment', purged.id, 31)
  await backdateDeletion('comment', kept.id, 29)

  expect((await anonymous().fetch('/api/cron/cleanup', { headers: { authorization: `Bearer ${CRON_SECRET}` } })).status).toBe(200)

  expect((await restoreComment(lamarr, purged.id)).status).toBe(404)
  expect((await restoreComment(lamarr, kept.id)).status).toBe(200)
})
