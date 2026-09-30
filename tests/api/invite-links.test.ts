import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, browser, signIn, type Caller } from './client'

// Invite Links (PRD stories 4, 5, 63–66, 72): joining through the link, the
// invite remembered across a refused sign-in, and the Owner resetting it.
// Ida owns the Boards made here. Radia and Joan sign in for the first time in
// this file, through an invite; nothing else may sign them in before. Evelyn,
// the Member who joins by link, is used by this file only.

interface Board {
  id: string
  name: string
  emoji: string
  isOwner: boolean
  inviteToken: string
}

const ida = () => signIn(ALLOWLISTED[8])
const evelyn = () => signIn(ALLOWLISTED[14])
const linus = () => signIn(ALLOWLISTED[2])

// A new Board of Ida's, as Board settings shows it (with its Invite Link).
async function idasBoard(name: string, emoji = '🍜'): Promise<Board> {
  const owner = await ida()
  const res = await owner.fetch('/api/boards', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, emoji }),
  })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return (await owner.fetch(`/api/boards/${id}`)).json()
}

const post = (caller: Caller, path: string) => caller.fetch(path, { method: 'POST' })
const join = (caller: Caller, token: string) => post(caller, `/api/invites/${token}/join`)
const remember = (caller: Caller, token: string) => post(caller, `/api/invites/${token}/remember`)
const reset = (caller: Caller, boardId: string) => post(caller, `/api/boards/${boardId}/invite/reset`)

async function boardNames(caller: Caller): Promise<string[]> {
  const boards = await (await caller.fetch('/api/boards')).json() as { name: string }[]
  return boards.map(b => b.name)
}

test('the invite landing shows the Board and who invited you, to anyone with the link', async () => {
  const board = await idasBoard('Kochclub')

  const res = await anonymous().fetch(`/api/invites/${board.inviteToken}`)

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({
    board: { name: 'Kochclub', emoji: '🍜' },
    owner: { name: 'ida' },
    members: [{ name: 'ida' }],
  })
})

test('an Allowlisted user joins through the link, and opening it again changes nothing', async () => {
  const board = await idasBoard('Suppenrunde')
  const member = await evelyn()

  const res = await join(member, board.inviteToken)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ boardId: board.id })
  expect(await (await member.fetch(`/api/boards/${board.id}`)).json()).toMatchObject({ id: board.id, isOwner: false })

  // A Member (and the Owner) opening the link just lands on the Board.
  for (const caller of [member, await ida()]) {
    const again = await join(caller, board.inviteToken)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ boardId: board.id })
  }
  const listed = await (await member.fetch('/api/boards')).json() as { id: string, members: unknown[] }[]
  expect(listed.find(b => b.id === board.id)?.members).toHaveLength(2)
})

test('joining needs a signed-in user and a link that exists', async () => {
  const board = await idasBoard('Nur mit Link')
  const member = await evelyn()

  expect((await join(anonymous(), board.inviteToken)).status).toBe(401)
  for (const token of ['0123456789abcdef0123456789abcdef', 'nope']) {
    expect((await join(member, token)).status).toBe(404)
    expect((await anonymous().fetch(`/api/invites/${token}`)).status).toBe(404)
    expect((await remember(anonymous(), token)).status).toBe(404)
  }
})

test('an invite remembered before a first sign-in joins right at sign-in, and no "Meine Küche" is made', async () => {
  const board = await idasBoard('Pastaabend')
  const radia = browser()
  expect((await remember(radia, board.inviteToken)).status).toBe(204)

  expect((await radia.signIn(ALLOWLISTED[11])).status).toBe(200)

  expect(await boardNames(radia)).toEqual(['Pastaabend'])
  expect(await (await radia.fetch('/api/boards/landing')).json()).toEqual({ boardId: board.id })
  expect(await boardNames(radia)).toEqual(['Pastaabend'])
  // Used up: it no longer shows as remembered.
  expect((await radia.fetch('/api/invites/pending')).status).toBe(404)
})

test('a refused sign-in keeps the invite and names the Owner; an Allowlisted account then joins with it', async () => {
  const board = await idasBoard('Grillclub', '🔥')
  const visitor = browser()
  await remember(visitor, board.inviteToken)

  expect((await visitor.signIn('stranger@example.com')).status).toBe(403)

  const pending = await visitor.fetch('/api/invites/pending')
  expect(pending.status).toBe(200)
  expect(await pending.json()).toMatchObject({ board: { name: 'Grillclub', emoji: '🔥' }, owner: { name: 'ida' } })

  // Once let in (here: another account of theirs that is), the same browser joins.
  expect((await visitor.signIn(ALLOWLISTED[10])).status).toBe(200)
  expect(await boardNames(visitor)).toEqual(['Grillclub'])
  expect((await visitor.fetch('/api/invites/pending')).status).toBe(404)
})

test('nothing is remembered without an invite', async () => {
  expect((await anonymous().fetch('/api/invites/pending')).status).toBe(404)
})

test('only the Owner resets the link, and the old one stops working', async () => {
  const board = await idasBoard('Brunch')
  const owner = await ida()
  const member = await evelyn()
  await join(member, board.inviteToken)

  expect((await reset(member, board.id)).status).toBe(403)
  expect((await reset(await linus(), board.id)).status).toBe(404)
  expect((await reset(anonymous(), board.id)).status).toBe(401)

  const res = await reset(owner, board.id)
  expect(res.status).toBe(200)
  const { inviteToken } = await res.json() as { inviteToken: string }
  expect(inviteToken).not.toBe(board.inviteToken)
  expect(await (await member.fetch(`/api/boards/${board.id}`)).json()).toMatchObject({ inviteToken })

  expect((await anonymous().fetch(`/api/invites/${board.inviteToken}`)).status).toBe(404)
  expect((await join(await linus(), board.inviteToken)).status).toBe(404)
  expect((await anonymous().fetch(`/api/invites/${inviteToken}`)).status).toBe(200)
  expect(await boardNames(await linus())).not.toContain('Brunch')
})

test('a remembered link that was reset meanwhile joins nothing and is forgotten', async () => {
  const board = await idasBoard('Kuchenrunde')
  const visitor = browser()
  await remember(visitor, board.inviteToken)
  await reset(await ida(), board.id)

  expect((await visitor.fetch('/api/invites/pending')).status).toBe(404)
  expect((await visitor.signIn(ALLOWLISTED[2])).status).toBe(200)
  expect(await boardNames(visitor)).not.toContain('Kuchenrunde')
})

test('a Member signing in with a remembered invite lands on that Board, not the one used last', async () => {
  const board = await idasBoard('Stammtisch')
  const member = await evelyn()
  await join(member, board.inviteToken)
  const other = await idasBoard('Anderswo')
  await join(member, other.inviteToken)
  const again = browser()
  await remember(again, board.inviteToken)

  expect((await again.signIn(ALLOWLISTED[14])).status).toBe(200)

  expect(await (await again.fetch('/api/boards/landing')).json()).toEqual({ boardId: board.id })
})
