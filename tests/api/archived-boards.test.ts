import { utimes } from 'node:fs/promises'
import { join } from 'node:path'
import sharp from 'sharp'
import { beforeAll, expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { CRON_SECRET, IMAGE_DIR, storedImages } from './server-env'
import { backdateDeletion } from './time-travel'

// Archived Boards (#337; CONTEXT.md: Archived Board). The Owner deleting a
// Board (DELETE /api/boards/:id) archives it for 30 days: it keeps its
// Members, Columns and Dishes, but is left out of everything, and its
// Address and Invite Link answer "not found". GET /api/boards/archived lists
// the Owner's Archived Boards; they restore one with its Members
// (POST /api/boards/:id/restore) or delete it for good sooner
// (POST /api/boards/:id/purge), with its images. Kwolek owns the Boards made
// here, Jemison joins them, Ride is the outsider; all three are used by this
// file only.

interface Member { id: string, name: string, isOwner: boolean }
interface Dish { id: string, title: string }
interface Column { id: string, dishes: Dish[] }
interface Board { id: string, slug: string, name: string, inviteToken: string, members: Member[], columns: Column[] }
interface ArchivedBoard { id: string, name: string, emoji: string, archivedAt: string, purgesAt: string }
interface Uploaded { url: string, ticket: string }

const owner = () => signIn(ALLOWLISTED[85])
const member = () => signIn(ALLOWLISTED[86])
const outsider = () => signIn(ALLOWLISTED[87])

beforeAll(async () => {
  await Promise.all([owner(), member(), outsider()])
})

const DAY_MS = 24 * 60 * 60 * 1000

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

async function getBoard(caller: Caller, id: string): Promise<Board> {
  const res = await caller.fetch(`/api/boards/${id}`)
  expect(res.status).toBe(200)
  return res.json()
}

// A new Board of Kwolek's, with Jemison joined through its Invite Link.
async function sharedBoard(name: string): Promise<{ board: Board, kwolek: Caller, jemison: Caller }> {
  const [kwolek, jemison] = await Promise.all([owner(), member()])
  const res = await post(kwolek, '/api/boards', { name, emoji: '🧺' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  expect((await post(jemison, `/api/invites/${(await getBoard(kwolek, id)).inviteToken}/join`)).status).toBe(200)
  return { board: await getBoard(kwolek, id), kwolek, jemison }
}

const archiveBoard = (caller: Caller, boardId: string) => caller.fetch(`/api/boards/${boardId}`, { method: 'DELETE' })
const restoreBoard = (caller: Caller, boardId: string) => post(caller, `/api/boards/${boardId}/restore`)
const purgeBoard = (caller: Caller, boardId: string) => post(caller, `/api/boards/${boardId}/purge`)

async function archivedBoards(caller: Caller): Promise<ArchivedBoard[]> {
  const res = await caller.fetch('/api/boards/archived')
  expect(res.status).toBe(200)
  return res.json()
}

async function boardIds(caller: Caller): Promise<string[]> {
  return ((await (await caller.fetch('/api/boards')).json()) as { id: string }[]).map(b => b.id)
}

async function uploadPhoto(caller: Caller, boardId: string): Promise<Uploaded> {
  const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#a47' } }).jpeg().toBuffer()
  const res = await caller.fetch(`/api/boards/${boardId}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
  expect(res.status).toBe(201)
  return res.json()
}

const fileOf = (url: string) => url.split('/').pop()!

// Makes a stored image older, so the daily sweep may take it once nothing
// refers to it.
async function backdateImage(url: string, hours: number): Promise<void> {
  const at = new Date(Date.now() - hours * 60 * 60 * 1000)
  await utimes(join(IMAGE_DIR, 'dishes', fileOf(url)), at, at)
}

const runCleanup = () => anonymous().fetch('/api/cron/cleanup', { headers: { authorization: `Bearer ${CRON_SECRET}` } })

test('an archived Board is gone for every Member: its Address and Invite Link answer "not found"', async () => {
  const { board, kwolek, jemison } = await sharedBoard('Weggeräumt')
  const ride = await outsider()
  expect((await postDish(jemison, board.id, { title: 'Linsen', placeholder: 'bowl' })).status).toBe(201)

  expect((await archiveBoard(kwolek, board.id)).status).toBe(204)

  for (const caller of [kwolek, jemison]) {
    expect(await boardIds(caller)).not.toContain(board.id)
    expect((await caller.fetch(`/api/boards/${board.id}`)).status).toBe(404)
    expect((await caller.fetch(`/api/addresses/${board.slug}`)).status).toBe(404)
    expect((await postDish(caller, board.id, { title: 'Noch eins', placeholder: 'bowl' })).status).toBe(404)
    expect((await caller.fetch('/api/boards/landing').then(r => r.json()) as { boardId: string }).boardId).not.toBe(board.id)
  }
  expect((await anonymous().fetch(`/api/invites/${board.inviteToken}`)).status).toBe(404)
  expect((await post(ride, `/api/invites/${board.inviteToken}/join`)).status).toBe(404)
  // Only the Owner can delete it, so once archived there is nothing left to.
  expect((await archiveBoard(kwolek, board.id)).status).toBe(404)
})

test('the Owner finds their Archived Boards, the newest first, with when they go for good; nobody else does', async () => {
  const first = await sharedBoard('Erstes Archiv')
  const second = await sharedBoard('Zweites Archiv')
  const before = Date.now()
  for (const { board, kwolek } of [first, second]) expect((await archiveBoard(kwolek, board.id)).status).toBe(204)

  const listed = (await archivedBoards(first.kwolek)).filter(b => [first.board.id, second.board.id].includes(b.id))
  expect(listed.map(b => b.name)).toEqual(['Zweites Archiv', 'Erstes Archiv'])
  const [newest] = listed as [ArchivedBoard]
  expect(newest).toMatchObject({ id: second.board.id, emoji: '🧺' })
  const archivedAt = new Date(newest.archivedAt).getTime()
  expect(archivedAt).toBeGreaterThanOrEqual(before - 5000)
  expect(Math.abs(new Date(newest.purgesAt).getTime() - archivedAt - 30 * DAY_MS)).toBeLessThanOrEqual(60 * 60 * 1000)

  expect((await archivedBoards(first.jemison)).map(b => b.id)).not.toContain(first.board.id)
  expect((await anonymous().fetch('/api/boards/archived')).status).toBe(401)
})

test('restoring brings the Board back as it was, with its Members, Dishes, Address and Invite Link', async () => {
  const { board, kwolek, jemison } = await sharedBoard('Wieder da')
  const added = await (await postDish(jemison, board.id, { title: 'Kürbissuppe', placeholder: 'bowl' })).json() as Dish
  await archiveBoard(kwolek, board.id)

  const res = await restoreBoard(kwolek, board.id)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ id: board.id, slug: board.slug, name: 'Wieder da', isOwner: true })
  expect((await archivedBoards(kwolek)).map(b => b.id)).not.toContain(board.id)
  for (const caller of [kwolek, jemison]) {
    expect(await boardIds(caller)).toContain(board.id)
    const restored = await getBoard(caller, board.id)
    expect(restored.members.map(m => [m.id, m.isOwner])).toEqual(board.members.map(m => [m.id, m.isOwner]))
    expect(restored.columns[0]!.dishes.map(d => d.id)).toEqual([added.id])
    expect((await caller.fetch(`/api/addresses/${board.slug}`)).status).toBe(200)
  }
  expect((await anonymous().fetch(`/api/invites/${board.inviteToken}`)).status).toBe(200)
})

test('only the Owner restores or deletes for good, and only an Archived Board', async () => {
  const { board, kwolek, jemison } = await sharedBoard('Nur Besitz')
  const ride = await outsider()

  // A Board still in use is no Archived Board.
  expect((await restoreBoard(kwolek, board.id)).status).toBe(404)
  expect((await purgeBoard(kwolek, board.id)).status).toBe(404)
  await archiveBoard(kwolek, board.id)

  for (const caller of [jemison, ride]) {
    expect((await restoreBoard(caller, board.id)).status).toBe(404)
    expect((await purgeBoard(caller, board.id)).status).toBe(404)
  }
  expect((await restoreBoard(anonymous(), board.id)).status).toBe(401)
  expect((await restoreBoard(kwolek, 'not-a-board')).status).toBe(404)
  expect((await archivedBoards(kwolek)).map(b => b.id)).toContain(board.id)
})

test('the Owner deletes an Archived Board for good, with its images, at once', async () => {
  const { board, kwolek, jemison } = await sharedBoard('Ganz weg')
  const photo = await uploadPhoto(jemison, board.id)
  expect((await postDish(jemison, board.id, { title: 'Mit Foto', placeholder: 'bowl', photo })).status).toBe(201)
  expect(await storedImages()).toContain(fileOf(photo.url))
  await archiveBoard(kwolek, board.id)

  expect((await purgeBoard(kwolek, board.id)).status).toBe(204)

  expect(await storedImages()).not.toContain(fileOf(photo.url))
  expect((await archivedBoards(kwolek)).map(b => b.id)).not.toContain(board.id)
  expect((await restoreBoard(kwolek, board.id)).status).toBe(404)
  expect((await purgeBoard(kwolek, board.id)).status).toBe(404)
})

test('an Archived Board keeps its images until the cleanup purges it after 30 days', async () => {
  const kept = await sharedBoard('Noch 1 Tag')
  const purged = await sharedBoard('Abgelaufen')
  const photos: Uploaded[] = []
  for (const { board, kwolek } of [kept, purged]) {
    const photo = await uploadPhoto(kwolek, board.id)
    expect((await postDish(kwolek, board.id, { title: 'Foto', placeholder: 'bowl', photo })).status).toBe(201)
    await backdateImage(photo.url, 48)
    photos.push(photo)
    await archiveBoard(kwolek, board.id)
  }
  const [keptPhoto, purgedPhoto] = photos as [Uploaded, Uploaded]
  await backdateDeletion('board', kept.board.id, 29)
  await backdateDeletion('board', purged.board.id, 31)

  expect((await runCleanup()).status).toBe(200)

  const left = (await archivedBoards(kept.kwolek)).map(b => b.id)
  expect(left).toContain(kept.board.id)
  expect(left).not.toContain(purged.board.id)
  const images = await storedImages()
  expect(images).toContain(fileOf(keptPhoto.url))
  expect(images).not.toContain(fileOf(purgedPhoto.url))
  expect((await restoreBoard(kept.kwolek, purged.board.id)).status).toBe(404)
})

test('archiving, restoring and deleting a Board for good are each recorded', async () => {
  const { board, kwolek, jemison } = await sharedBoard('Mitgeschrieben')
  const kwolekId = await idOf(kwolek)
  const events = await watchEvents()

  // Refused, so not recorded.
  expect((await archiveBoard(jemison, board.id)).status).toBe(403)
  await archiveBoard(kwolek, board.id)
  await restoreBoard(kwolek, board.id)
  await archiveBoard(kwolek, board.id)
  await purgeBoard(kwolek, board.id)
  await purgeBoard(kwolek, board.id)

  expect(await events.recorded()).toEqual([
    { kind: 'board_archived', boardId: board.id, dishId: null, userId: kwolekId, details: null },
    { kind: 'board_restored', boardId: board.id, dishId: null, userId: kwolekId, details: null },
    { kind: 'board_archived', boardId: board.id, dishId: null, userId: kwolekId, details: null },
    { kind: 'board_deleted', boardId: board.id, dishId: null, userId: kwolekId, details: null },
  ])
})
