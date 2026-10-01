import { expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'

// Members and Owner rules (PRD stories 62, 67–71): the Members list, leaving,
// removing, handing over ownership and deleting the Board. Frances owns the
// Boards made here and Sophie joins them; both are used by this file only.
// Linus joins only to be removed again: joining makes a Board the one he
// lands on, and other files expect his first landing to create his own.

interface Member {
  id: string
  name: string
  isOwner: boolean
  isYou: boolean
}

interface Board {
  id: string
  name: string
  isOwner: boolean
  inviteToken: string
  members: Member[]
  columns: { dishes: { title: string, addedBy: { name: string } | null }[] }[]
}

const frances = () => signIn(ALLOWLISTED[12])
const sophie = () => signIn(ALLOWLISTED[13])
const linus = () => signIn(ALLOWLISTED[2])

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

// A new Board of Frances's, with `joiners` joined through its Invite Link.
async function francesBoard(name: string, ...joiners: Caller[]): Promise<Board> {
  const owner = await frances()
  const res = await owner.fetch('/api/boards', { method: 'POST', ...json({ name, emoji: '🥘' }) })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const board = await getBoard(owner, id)
  for (const joiner of joiners) {
    expect((await joiner.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  }
  return getBoard(owner, id)
}

const memberId = (board: Board, name: string) => board.members.find(m => m.name === name)!.id

test('the Board lists its Members, the Owner first and marked, and who is you', async () => {
  const board = await francesBoard('Mittagstisch', await sophie())

  expect((await getBoard(await sophie(), board.id)).members).toEqual([
    expect.objectContaining({ name: 'frances', isOwner: true, isYou: false }),
    expect.objectContaining({ name: 'sophie', isOwner: false, isYou: true }),
  ])
})

// DELETE /api/boards/:id/members/:userId, answered as is.
const removeMember = (caller: Caller, boardId: string, userId: string) =>
  caller.fetch(`/api/boards/${boardId}/members/${userId}`, { method: 'DELETE' })

async function boardIds(caller: Caller): Promise<string[]> {
  const boards = await (await caller.fetch('/api/boards')).json() as { id: string }[]
  return boards.map(b => b.id)
}

test('a Member leaves; the Board is gone for them and the Dishes they added stay, with their name', async () => {
  const member = await sophie()
  const board = await francesBoard('Resteessen', member)
  const added = await postDish(member, board.id, { title: 'Sophies Shakshuka', placeholder: 'curry' })
  expect(added.status).toBe(201)

  const res = await removeMember(member, board.id, memberId(board, 'sophie'))

  expect(res.status).toBe(204)
  expect(await boardIds(member)).not.toContain(board.id)
  expect((await member.fetch(`/api/boards/${board.id}`)).status).toBe(404)
  const left = await getBoard(await frances(), board.id)
  expect(left.members.map(m => m.name)).toEqual(['frances'])
  expect(left.columns.flatMap(c => c.dishes)).toEqual([expect.objectContaining({ title: 'Sophies Shakshuka', addedBy: expect.objectContaining({ name: 'sophie' }) })])
})

test('only the Owner removes a Member, who then loses the Board', async () => {
  const member = await sophie()
  const other = await linus()
  const board = await francesBoard('Wokabend', member, other)

  expect((await removeMember(member, board.id, memberId(board, 'linus'))).status).toBe(403)
  expect((await removeMember(member, board.id, memberId(board, 'frances'))).status).toBe(403)
  expect((await removeMember(anonymous(), board.id, memberId(board, 'linus'))).status).toBe(401)
  expect((await getBoard(await frances(), board.id)).members).toHaveLength(3)

  expect((await removeMember(await frances(), board.id, memberId(board, 'linus'))).status).toBe(204)

  expect(await boardIds(other)).not.toContain(board.id)
  expect((await getBoard(await frances(), board.id)).members.map(m => m.name)).toEqual(['frances', 'sophie'])
  // Gone already, or never on it: nobody to remove.
  expect((await removeMember(await frances(), board.id, memberId(board, 'linus'))).status).toBe(404)
  expect((await removeMember(await frances(), board.id, 'nobody')).status).toBe(404)
})

test('a removed Member can rejoin with the Invite Link until the Owner resets it', async () => {
  const member = await sophie()
  const board = await francesBoard('Wiedersehen', member)
  await removeMember(await frances(), board.id, memberId(board, 'sophie'))

  expect((await member.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  expect(await boardIds(member)).toContain(board.id)

  await removeMember(await frances(), board.id, memberId(board, 'sophie'))
  await (await frances()).fetch(`/api/boards/${board.id}/invite/reset`, { method: 'POST' })
  expect((await member.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(404)
})

test('the Owner can’t leave, and nobody off the Board can remove anyone', async () => {
  const member = await sophie()
  const board = await francesBoard('Nudelrunde', member)

  expect((await removeMember(await frances(), board.id, memberId(board, 'frances'))).status).toBe(409)
  expect((await removeMember(await linus(), board.id, memberId(board, 'sophie'))).status).toBe(404)
  expect((await removeMember(await linus(), board.id, memberId(board, 'frances'))).status).toBe(404)
  expect((await getBoard(await frances(), board.id)).members).toHaveLength(2)
})

// DELETE /api/boards/:id, answered as is.
const deleteBoard = (caller: Caller, boardId: string) => caller.fetch(`/api/boards/${boardId}`, { method: 'DELETE' })

// POST /api/boards/:id/owner, answered as is.
const handOver = (caller: Caller, boardId: string, userId: string) =>
  caller.fetch(`/api/boards/${boardId}/owner`, { method: 'POST', ...json({ userId }) })

const owners = (board: Board) => board.members.filter(m => m.isOwner).map(m => m.name)

test('the Owner hands ownership to a Member, and can then leave', async () => {
  const member = await sophie()
  const board = await francesBoard('Suppenküche', member)

  const res = await handOver(await frances(), board.id, memberId(board, 'sophie'))

  expect(res.status).toBe(204)
  const handed = await getBoard(member, board.id)
  expect(handed).toMatchObject({ isOwner: true })
  expect(owners(handed)).toEqual(['sophie'])
  expect(await getBoard(await frances(), board.id)).toMatchObject({ isOwner: false })
  // The new Owner has the Owner's say, the old one no longer; they leave like any Member.
  expect((await member.fetch(`/api/boards/${board.id}/invite/reset`, { method: 'POST' })).status).toBe(200)
  expect((await removeMember(await frances(), board.id, memberId(board, 'sophie'))).status).toBe(403)
  expect((await handOver(await frances(), board.id, memberId(board, 'frances'))).status).toBe(403)
  expect((await deleteBoard(await frances(), board.id)).status).toBe(403)
  expect((await removeMember(await frances(), board.id, memberId(board, 'frances'))).status).toBe(204)
  expect(owners(await getBoard(member, board.id))).toEqual(['sophie'])
})

test('only the Owner hands over, and only to another Member; there is always exactly one Owner', async () => {
  const member = await sophie()
  const board = await francesBoard('Tapasabend', member)
  const owner = await frances()

  expect((await handOver(member, board.id, memberId(board, 'sophie'))).status).toBe(403)
  expect((await handOver(await linus(), board.id, memberId(board, 'sophie'))).status).toBe(404)
  expect((await handOver(anonymous(), board.id, memberId(board, 'sophie'))).status).toBe(401)
  expect((await handOver(owner, board.id, 'nobody')).status).toBe(404)
  expect((await handOver(owner, board.id, memberId(board, 'frances'))).status).toBe(400)
  const bad = await owner.fetch(`/api/boards/${board.id}/owner`, { method: 'POST', ...json({ user: 'x' }) })
  expect(bad.status).toBe(400)

  expect(owners(await getBoard(owner, board.id))).toEqual(['frances'])
})

test('only the Owner deletes the Board, with its Dishes, for every Member', async () => {
  const member = await sophie()
  const board = await francesBoard('Alte Rezepte', member)
  expect((await postDish(member, board.id, { title: 'Linseneintopf', placeholder: 'eintopf' })).status).toBe(201)

  expect((await deleteBoard(member, board.id)).status).toBe(403)
  expect((await deleteBoard(await linus(), board.id)).status).toBe(404)
  expect((await deleteBoard(anonymous(), board.id)).status).toBe(401)
  expect(await boardIds(member)).toContain(board.id)

  expect((await deleteBoard(await frances(), board.id)).status).toBe(204)

  for (const caller of [await frances(), member]) {
    expect(await boardIds(caller)).not.toContain(board.id)
    expect((await caller.fetch(`/api/boards/${board.id}`)).status).toBe(404)
  }
  expect((await anonymous().fetch(`/api/invites/${board.inviteToken}`)).status).toBe(404)
  expect((await deleteBoard(await frances(), board.id)).status).toBe(404)
})
