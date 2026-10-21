import sharp from 'sharp'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { startResendService, type ResendService } from '../support/resend-service'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'

// Account deletion (#346, PRD #321 stories 14–21): DELETE /api/me
// { username }, with the user's Username typed to confirm. Boards they own
// with others pass to the longest-standing Member, Boards only they are on
// are deleted with their images, and what they added to shared Boards stays
// as "Gelöschtes Konto" (null). The users below are used by this file only.

const SALK = ALLOWLISTED[118]
const CORI = ALLOWLISTED[119]
const JENNER = ALLOWLISTED[120]
const LISTER = ALLOWLISTED[121]
const FLEMING = ALLOWLISTED[122]
const PASTEUR = ALLOWLISTED[123]
const HARVEY = ALLOWLISTED[124]
const SNOW = ALLOWLISTED[125]

interface Person { id: string, name: string }
interface Dish { id: string, addedBy: Person | null, cookings: { recordedBy: Person | null }[], votes: { voter: Person | null, up: boolean }[] }
interface Board { id: string, inviteToken: string, members: (Person & { isOwner: boolean })[], columns: { dishes: Dish[] }[] }
interface Entry { kind: string, comment?: { author: Person | null, text: string } }

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

const deleteAccount = (caller: Caller, username: string) => caller.fetch('/api/me', { method: 'DELETE', ...json({ username }) })

// The caller's Username, as the dev sign-in made it (another file may have
// taken the one from their address first).
const usernameOf = async (caller: Caller): Promise<string> => ((await (await caller.fetch('/api/me')).json()) as { name: string }).name

// Deletes the caller's account the way the app does, with their Username.
const deleteOwn = async (caller: Caller) => deleteAccount(caller, await usernameOf(caller))

const getBoard = async (caller: Caller, id: string): Promise<Board> => (await caller.fetch(`/api/boards/${id}`)).json()
const dishesOf = (board: Board) => board.columns.flatMap(c => c.dishes)

// A new Board of the owner's, with `joiners` joined through its Invite Link
// one after the other.
async function boardOf(owner: Caller, name: string, ...joiners: Caller[]): Promise<Board> {
  const res = await post(owner, '/api/boards', { name, emoji: '🧫' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(owner, id)
  for (const joiner of joiners) expect((await post(joiner, `/api/invites/${inviteToken}/join`)).status).toBe(200)
  return getBoard(owner, id)
}

async function addDish(caller: Caller, boardId: string, body: Record<string, unknown> = {}): Promise<Dish> {
  const res = await postDish(caller, boardId, { title: 'Penicillin-Brot', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  return res.json()
}

async function uploadPhoto(caller: Caller, boardId: string): Promise<{ url: string, ticket: string }> {
  const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#4a7' } }).jpeg().toBuffer()
  const res = await caller.fetch(`/api/boards/${boardId}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
  expect(res.status).toBe(201)
  return res.json()
}

const vote = (caller: Caller, dishId: string, up: boolean) => caller.fetch(`/api/dishes/${dishId}/vote`, { method: 'PUT', ...json({ up }) })

let resend: ResendService

beforeAll(async () => {
  resend = await startResendService()
})

afterAll(() => resend.close())

test('the wrong Username refuses, and the account stays', async () => {
  const salk = await signIn(SALK)

  const res = await deleteAccount(salk, `${await usernameOf(salk)}x`)

  expect(res.status).toBe(400)
  expect((await res.json()).data.message).toBe('Das ist nicht dein Name.')
  expect((await salk.fetch('/api/me')).status).toBe(200)
})

test('the right Username, whatever the case, deletes the account, every session of it ends, and a confirmation email goes out', async () => {
  const phone = await signIn(CORI)
  const laptop = await signIn(CORI)

  expect((await deleteAccount(phone, (await usernameOf(phone)).toUpperCase())).status).toBe(204)

  expect((await phone.fetch('/api/me')).status).toBe(401)
  expect((await laptop.fetch('/api/me')).status).toBe(401)
  const sent = resend.sent.filter(e => e.to.includes(CORI))
  expect(sent.map(e => e.subject)).toEqual(['Dein malkochen-Konto ist gelöscht'])
})

test('a Board owned with others passes to the Member who joined first, and keeps what the deleted account added, by nobody', async () => {
  const jenner = await signIn(JENNER)
  const lister = await signIn(LISTER)
  const fleming = await signIn(FLEMING)
  const snow = await signIn(SNOW)
  const board = await boardOf(jenner, 'Labor', lister, fleming, snow)
  const dish = await addDish(jenner, board.id)
  expect((await post(jenner, `/api/dishes/${dish.id}/cook`)).status).toBe(200)
  expect((await post(jenner, `/api/dishes/${dish.id}/comments`, { text: 'Schimmelt gut.' })).status).toBe(201)
  expect((await vote(jenner, dish.id, true)).status).toBe(200)
  // Another deleted account's Vote on the same Dish doesn't clash with it.
  expect((await vote(snow, dish.id, false)).status).toBe(200)
  expect((await deleteOwn(snow)).status).toBe(204)

  expect((await deleteOwn(jenner)).status).toBe(204)

  const after = await getBoard(lister, board.id)
  expect(after.members.map(m => [m.name, m.isOwner])).toEqual([[await usernameOf(lister), true], [await usernameOf(fleming), false]])
  const [kept] = dishesOf(after)
  expect(kept).toMatchObject({ id: dish.id, addedBy: null, cookings: [{ recordedBy: null }] })
  expect(kept!.votes.map(v => [v.voter, v.up])).toEqual([[null, true], [null, false]])
  const history = await (await post(lister, `/api/dishes/${dish.id}/open`)).json() as { entries: Entry[] }
  expect(history.entries.filter(e => e.kind === 'comment').map(e => e.comment)).toEqual([expect.objectContaining({ author: null, text: 'Schimmelt gut.' })])
})

test('a Board only they are on is deleted for good, with its images', async () => {
  const pasteur = await signIn(PASTEUR)
  const board = await boardOf(pasteur, 'Nur meins')
  const photo = await uploadPhoto(pasteur, board.id)
  await addDish(pasteur, board.id, { photo })
  expect((await anonymous().fetch(photo.url)).status).toBe(200)

  expect((await deleteOwn(pasteur)).status).toBe(204)

  expect((await anonymous().fetch(`/api/invites/${board.inviteToken}`)).status).toBe(404)
  expect((await anonymous().fetch(photo.url)).status).toBe(404)
})

test('an Archived Board they own with others passes on too, for the new Owner to restore', async () => {
  const harvey = await signIn(HARVEY)
  const fleming = await signIn(FLEMING)
  const board = await boardOf(harvey, 'Kreislauf', fleming)
  expect((await harvey.fetch(`/api/boards/${board.id}`, { method: 'DELETE' })).status).toBe(204)

  expect((await deleteOwn(harvey)).status).toBe(204)

  const archived = await (await fleming.fetch('/api/boards/archived')).json() as { id: string }[]
  expect(archived.map(b => b.id)).toContain(board.id)
  expect((await post(fleming, `/api/boards/${board.id}/restore`)).status).toBe(200)
})

test('signing up again afterwards makes a new user', async () => {
  const salk = await signIn(SALK)
  const before = await (await salk.fetch('/api/me')).json() as { id: string }
  expect((await deleteOwn(salk)).status).toBe(204)

  const again = await (await (await signIn(SALK)).fetch('/api/me')).json() as { id: string }

  expect(again.id).not.toBe(before.id)
})
