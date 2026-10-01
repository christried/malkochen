import { expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// New Dishes (PRD story 37): Dishes another Member added since you last
// opened a Board are marked "Neu" until you open it again. Alan owns the
// Boards made here and Dorothy joins them; among the API tests, both are
// used by this file only (tests/e2e/sync.spec.ts has its own database).

interface Board {
  id: string
  inviteToken: string
  newDishIds: string[]
}

const alan = () => signIn(ALLOWLISTED[15])
const dorothy = () => signIn(ALLOWLISTED[16])

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

function getBoard(caller: Caller, id: string): Promise<Board> {
  return caller.fetch(`/api/boards/${id}`).then(res => res.json())
}

async function open(caller: Caller, id: string) {
  expect((await caller.fetch(`/api/boards/${id}/open`, { method: 'POST' })).status).toBe(204)
}

// What the open Board asks every few seconds: the Board, recording it as seen.
async function poll(caller: Caller, id: string): Promise<Board> {
  const res = await caller.fetch(`/api/boards/${id}/seen`, { method: 'POST' })
  expect(res.status).toBe(200)
  return res.json()
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<string> {
  const res = await postDish(caller, boardId, { title, placeholder: 'curry' })
  expect(res.status).toBe(201)
  return (await res.json() as { id: string }).id
}

// A new Board of Alan's that Dorothy has joined, both having opened it once.
async function sharedBoard(name: string) {
  const owner = await alan()
  const member = await dorothy()
  const res = await owner.fetch('/api/boards', { method: 'POST', ...json({ name, emoji: '🥘' }) })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(owner, id)
  expect((await member.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  await open(owner, id)
  await open(member, id)
  return { id, owner, member }
}

test('a Dish another Member added since I last opened the Board is New; my own is not', async () => {
  const { id, owner, member } = await sharedBoard('Kochclub')
  const theirs = await addDish(member, id, 'Dorothys Dal')
  await addDish(owner, id, 'Alans Auflauf')

  await open(owner, id)

  expect((await getBoard(owner, id)).newDishIds).toEqual([theirs])
})

test('New Dishes stay New while the Board is open, Dishes added meanwhile too; once seen, the next open clears them', async () => {
  const { id, owner, member } = await sharedBoard('Pastaabend')
  const before = await addDish(member, id, 'Pesto')
  await open(owner, id)
  const meanwhile = await addDish(member, id, 'Carbonara')

  // Two polls while the Board is open: both see the same New Dishes.
  for (const _ of [1, 2]) {
    expect((await poll(owner, id)).newDishIds.toSorted()).toEqual([before, meanwhile].toSorted())
  }
  // Added after the last poll: not yet seen.
  const unseen = await addDish(member, id, 'Arrabbiata')

  await open(owner, id)
  expect((await getBoard(owner, id)).newDishIds).toEqual([unseen])
})

test('Dishes that were on a Board before I joined it are not New', async () => {
  const owner = await alan()
  const res = await owner.fetch('/api/boards', { method: 'POST', ...json({ name: 'Brunch', emoji: '🥞' }) })
  const { id } = await res.json() as { id: string }
  await addDish(owner, id, 'Pancakes')
  const { inviteToken } = await getBoard(owner, id)

  const member = await dorothy()
  expect((await member.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  await open(member, id)

  expect((await getBoard(member, id)).newDishIds).toEqual([])
})

test('on my first open of a Board, Dishes others added since I joined are New, and so are ones added while it is open', async () => {
  const owner = await alan()
  const member = await dorothy()
  const res = await owner.fetch('/api/boards', { method: 'POST', ...json({ name: 'Grillfest', emoji: '🌽' }) })
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(owner, id)
  expect((await member.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  const before = await addDish(member, id, 'Maiskolben')

  await open(owner, id)
  const meanwhile = await addDish(member, id, 'Halloumi')

  expect((await getBoard(owner, id)).newDishIds.toSorted()).toEqual([before, meanwhile].toSorted())
})
