import { expect, test } from 'vitest'
import type { Permissions } from '../../shared/permissions'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// The last four Permissions (#342, CONTEXT.md): "edit Columns", "share the
// Invite Link", "comment and vote" and "Board name and emoji", each refused
// without it and allowed with it, through the real endpoints. The Owner may
// always. Earle owns the Boards made here, Pickering joins them; both are
// used by this file only.

interface Column { id: string, name: string, isGekocht: boolean }
interface Board {
  id: string
  inviteToken: string | null
  members: { id: string, name: string }[]
  columns: Column[]
}

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

// A new Board of Earle's that Pickering has joined, with a Cooked Dish of
// Earle's, and Pickering's Permissions switched as `permissions` says.
async function sharedBoard(name: string, permissions: Partial<Permissions>) {
  const earle = await signIn(ALLOWLISTED[105])
  const pickering = await signIn(ALLOWLISTED[106])
  const created = await send(earle, 'POST', '/api/boards', { name, emoji: '🍲' })
  expect(created.status).toBe(201)
  const { id } = await created.json() as { id: string }
  const { inviteToken } = await getBoard(earle, id)
  expect((await send(pickering, 'POST', `/api/invites/${inviteToken}/join`)).status).toBe(200)
  const added = await postDish(earle, id, { title: `${name}: Gericht`, placeholder: 'bowl' })
  expect(added.status).toBe(201)
  const dish = await added.json() as { id: string }
  expect((await send(earle, 'POST', `/api/dishes/${dish.id}/cook`)).status).toBe(200)
  const board = await getBoard(earle, id)
  const pickeringId = board.members.find(m => m.name === 'pickering')!.id
  if (Object.keys(permissions).length > 0) {
    expect((await send(earle, 'PATCH', `/api/boards/${id}/members/${pickeringId}/permissions`, permissions)).status).toBe(200)
  }
  return { board, earle, pickering, dish }
}

async function expectRefused(res: Response, permission: string) {
  expect(res.status).toBe(403)
  expect((await res.json()).data).toEqual({ permission })
}

const firstColumn = (board: Board) => board.columns.find(c => !c.isGekocht)!

const addColumn = (caller: Caller, board: Board, name: string) => send(caller, 'POST', `/api/boards/${board.id}/columns`, { name })
const renameColumn = (caller: Caller, column: Column, name: string) => send(caller, 'PATCH', `/api/columns/${column.id}`, { name })
const reorderColumns = (caller: Caller, board: Board) => send(caller, 'PUT', `/api/boards/${board.id}/columns`, { columnIds: [...board.columns].reverse().map(c => c.id) })
const deleteColumn = (caller: Caller, column: Column) => send(caller, 'DELETE', `/api/columns/${column.id}`)
const editBoard = (caller: Caller, board: Board, changes: { name?: string, emoji?: string }) => send(caller, 'PATCH', `/api/boards/${board.id}`, changes)
const comment = (caller: Caller, dish: { id: string }, text: string) => send(caller, 'POST', `/api/dishes/${dish.id}/comments`, { text })
const vote = (caller: Caller, dish: { id: string }, up: boolean) => send(caller, 'PUT', `/api/dishes/${dish.id}/vote`, { up })
const takeBackVote = (caller: Caller, dish: { id: string }) => send(caller, 'DELETE', `/api/dishes/${dish.id}/vote`)

test('without "edit Columns" a Member adds, renames, reorders and deletes none; the Owner still does', async () => {
  const { board, earle, pickering } = await sharedBoard('Gerüst', { editColumns: false })

  await expectRefused(await addColumn(pickering, board, 'Neu'), 'editColumns')
  await expectRefused(await renameColumn(pickering, firstColumn(board), 'Umbenannt'), 'editColumns')
  await expectRefused(await reorderColumns(pickering, board), 'editColumns')
  const added = await addColumn(earle, board, 'Leer')
  expect(added.status).toBe(201)
  const empty = await added.json() as Column
  await expectRefused(await deleteColumn(pickering, empty), 'editColumns')

  expect((await getBoard(earle, board.id)).columns.map(c => c.name)).toEqual([...board.columns.map(c => c.name), 'Leer'])
  expect((await renameColumn(earle, firstColumn(board), 'Vom Owner')).status).toBe(200)
  expect((await deleteColumn(earle, empty)).status).toBe(204)
})

test('with "edit Columns" a Member edits the Columns', async () => {
  const { board, pickering } = await sharedBoard('Bauplan', {})

  expect((await reorderColumns(pickering, board)).status).toBe(200)
  const added = await addColumn(pickering, board, 'Neu')
  expect(added.status).toBe(201)
  expect((await renameColumn(pickering, firstColumn(board), 'Umbenannt')).status).toBe(200)
  expect((await deleteColumn(pickering, await added.json() as Column)).status).toBe(204)
})

test('a Column of a Board the user isn\'t on stays "not found", whatever their Permissions', async () => {
  const { board } = await sharedBoard('Fremd', {})
  const stranger = await signIn(ALLOWLISTED[104])

  expect((await renameColumn(stranger, firstColumn(board), 'Nein')).status).toBe(404)
  expect((await deleteColumn(stranger, firstColumn(board))).status).toBe(404)
  expect((await addColumn(stranger, board, 'Nein')).status).toBe(404)
})

test('without "share the Invite Link" the Board answer has no Invite Link; with it again, the same one', async () => {
  const { board, earle, pickering } = await sharedBoard('Geheimnis', { shareInvite: false })

  expect((await getBoard(pickering, board.id)).inviteToken).toBeNull()
  expect((await getBoard(earle, board.id)).inviteToken).toBe(board.inviteToken)

  const pickeringId = board.members.find(m => m.name === 'pickering')!.id
  expect((await send(earle, 'PATCH', `/api/boards/${board.id}/members/${pickeringId}/permissions`, { shareInvite: true })).status).toBe(200)
  expect((await getBoard(pickering, board.id)).inviteToken).toBe(board.inviteToken)
})

test('without "comment and vote" a Member writes and edits no Comment and gives or takes back no Vote', async () => {
  const { board, earle, pickering, dish } = await sharedBoard('Stille', {})
  const written = await comment(pickering, dish, 'Lecker')
  expect(written.status).toBe(201)
  const own = await written.json() as { id: string }
  expect((await vote(pickering, dish, true)).status).toBe(200)
  const pickeringId = board.members.find(m => m.name === 'pickering')!.id
  expect((await send(earle, 'PATCH', `/api/boards/${board.id}/members/${pickeringId}/permissions`, { commentAndVote: false })).status).toBe(200)

  await expectRefused(await comment(pickering, dish, 'Noch was'), 'commentAndVote')
  await expectRefused(await send(pickering, 'PATCH', `/api/comments/${own.id}`, { text: 'Geändert' }), 'commentAndVote')
  await expectRefused(await vote(pickering, dish, false), 'commentAndVote')
  await expectRefused(await takeBackVote(pickering, dish), 'commentAndVote')

  // Reading stays: the Dish History still shows the Comment, and the
  // Member may still take their own Comment down.
  const history = await pickering.fetch(`/api/dishes/${dish.id}/open`, { method: 'POST' })
  expect(history.status).toBe(200)
  expect(JSON.stringify(await history.json())).toContain('Lecker')
  expect((await send(pickering, 'DELETE', `/api/comments/${own.id}`)).status).toBe(204)

  expect((await comment(earle, dish, 'Vom Owner')).status).toBe(201)
  expect((await vote(earle, dish, true)).status).toBe(200)
})

test('with "comment and vote" a Member comments and votes', async () => {
  const { pickering, dish } = await sharedBoard('Gespräch', {})

  expect((await comment(pickering, dish, 'Gut')).status).toBe(201)
  expect((await vote(pickering, dish, false)).status).toBe(200)
  expect((await takeBackVote(pickering, dish)).status).toBe(204)
})

test('without "Board name and emoji" a Member renames nothing; the Owner still does', async () => {
  const { board, earle, pickering } = await sharedBoard('Schild', { editBoard: false })

  await expectRefused(await editBoard(pickering, board, { name: 'Umbenannt' }), 'editBoard')
  await expectRefused(await editBoard(pickering, board, { emoji: '🥗' }), 'editBoard')
  expect((await editBoard(earle, board, { name: 'Schild vom Owner', emoji: '🥗' })).status).toBe(200)
})

test('with "Board name and emoji" a Member renames the Board', async () => {
  const { board, pickering } = await sharedBoard('Etikett', {})

  expect((await editBoard(pickering, board, { name: 'Neues Etikett', emoji: '🥗' })).status).toBe(200)
})
