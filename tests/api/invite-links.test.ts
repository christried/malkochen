import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { ALLOWLISTED, anonymous, browser, signIn, type Caller } from './client'

// Invite Links (PRD stories 4, 5, 63–66, 72): joining through the link, the
// invite remembered across a refused sign-in, and the Owner resetting it.
// A link is /invite/<Board slug>-<secret> (issue #128); only the secret
// counts. Lookups of a secret no Board has are limited per client.
// Ida owns the Boards made here. Radia and Joan sign in for the first time in
// this file, through an invite; nothing else may sign them in before. Evelyn,
// the Member who joins by link, is used by this file only.

interface Board {
  id: string
  slug: string
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
  expect(await res.json()).toEqual({ boardId: board.id, slug: board.slug })
  expect(await (await member.fetch(`/api/boards/${board.id}`)).json()).toMatchObject({ id: board.id, isOwner: false })

  // A Member (and the Owner) opening the link just lands on the Board.
  for (const caller of [member, await ida()]) {
    const again = await join(caller, board.inviteToken)
    expect(again.status).toBe(200)
    expect(await again.json()).toEqual({ boardId: board.id, slug: board.slug })
  }
  const listed = await (await member.fetch('/api/boards')).json() as { id: string, members: unknown[] }[]
  expect(listed.find(b => b.id === board.id)?.members).toHaveLength(2)
})

test('joining needs a signed-in user and a link that exists', async () => {
  const board = await idasBoard('Nur mit Link')
  const member = await evelyn()

  expect((await join(anonymous(), board.inviteToken)).status).toBe(401)
  for (const token of ['0123456789abcdef0123456789abcdef', 'nur-mit-link-23456789abcdefghj', 'nope']) {
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
  expect(await (await radia.fetch('/api/boards/landing')).json()).toEqual({ boardId: board.id, slug: board.slug })
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

  expect(await (await again.fetch('/api/boards/landing')).json()).toEqual({ boardId: board.id, slug: board.slug })
})

// What follows /invite/ in the link Board settings shows.
const linkOf = (board: Board) => `${board.slug}-${board.inviteToken}`

test('a new Board’s secret is 17 characters without look-alikes, and so is a reset one', async () => {
  const board = await idasBoard('Geheimrezept')
  expect(board.inviteToken).toMatch(/^[2-9a-hjkmnp-z]{17}$/)

  const res = await reset(await ida(), board.id)
  const { inviteToken } = await res.json() as { inviteToken: string }
  expect(inviteToken).toMatch(/^[2-9a-hjkmnp-z]{17}$/)
  expect(inviteToken).not.toBe(board.inviteToken)
})

test('the link with the Board’s slug in front lands, remembers and joins', async () => {
  const board = await idasBoard('Lesbarer Link')
  expect(linkOf(board)).toMatch(/^lesbarer-link-[2-9a-hjkmnp-z]{17}$/)

  expect(await (await anonymous().fetch(`/api/invites/${linkOf(board)}`)).json()).toMatchObject({ board: { name: 'Lesbarer Link' } })
  expect((await remember(browser(), linkOf(board))).status).toBe(204)
  const res = await join(await evelyn(), linkOf(board))
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ boardId: board.id, slug: board.slug })
})

test('only the secret counts: a renamed Board’s old link still works', async () => {
  const board = await idasBoard('Einladung vorher')
  const before = linkOf(board)
  const owner = await ida()
  const renamed = await owner.fetch(`/api/boards/${board.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Einladung nachher' }),
  })
  expect(await renamed.json()).toMatchObject({ slug: 'einladung-nachher' })

  expect(await (await anonymous().fetch(`/api/invites/${before}`)).json()).toMatchObject({ board: { name: 'Einladung nachher' } })
  expect((await anonymous().fetch(`/api/invites/irgendwas-${board.inviteToken}`)).status).toBe(200)
  expect((await join(await evelyn(), before)).status).toBe(200)
})

test('a reset link stops working, slug or not', async () => {
  const board = await idasBoard('Neu gemischt')
  await reset(await ida(), board.id)

  expect((await anonymous().fetch(`/api/invites/${linkOf(board)}`)).status).toBe(404)
  expect((await join(await evelyn(), linkOf(board))).status).toBe(404)
})

// A client of its own, told apart by the address Vercel puts in
// x-forwarded-for: new each run, so a rerun against the same server starts
// with no misses.
function client(): Caller {
  const address = `2001:db8::${randomBytes(4).toString('hex').replace(/(....)(....)/, '$1:$2')}`
  return {
    fetch: (path, init) => anonymous().fetch(path, { ...init, headers: { ...init?.headers, 'x-forwarded-for': address } }),
  }
}

// A secret no Board has.
const wrongSecret = (n: number) => `${'23456789abcdefghjkmnpqrstuvwxyz'[n % 31]}${'23456789abcdefghjkmnpqrstuvwxyz'[Math.floor(n / 31) % 31]}${'b'.repeat(15)}`

test('after too many links no Board has, a client gets no answer for a while, not even for a working link', async () => {
  const board = await idasBoard('Ratespiel')
  const guesser = client()

  // Working links in between are no misses.
  for (let guess = 0; guess < 30; guess++) {
    expect((await guesser.fetch(`/api/invites/ratespiel-${wrongSecret(guess)}`)).status).toBe(404)
    if (guess % 10 === 0) expect((await guesser.fetch(`/api/invites/${linkOf(board)}`)).status).toBe(200)
  }

  expect((await guesser.fetch(`/api/invites/${linkOf(board)}`)).status).toBe(429)
  expect((await remember(guesser, linkOf(board))).status).toBe(429)
  // Anyone else still gets in.
  expect((await client().fetch(`/api/invites/${linkOf(board)}`)).status).toBe(200)
})

test('guesses sent all at once don’t slip past the limit', async () => {
  const guesser = client()

  const answers = await Promise.all(Array.from({ length: 45 }, (_, n) => guesser.fetch(`/api/invites/${wrongSecret(n)}`)))

  const statuses = answers.map(a => a.status)
  expect(statuses.filter(s => s === 404)).toHaveLength(30)
  expect(statuses.filter(s => s === 429)).toHaveLength(15)
})

test('Boards from before readable Invite Links keep their token; new ones get a secret', async () => {
  const before = await migrationsBefore('0014_readable_invite_links')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    const { rows: [old] } = await client.query<{ invite_token: string }>(`insert into board (name, emoji) values ('Alt', '🍲') returning invite_token`)
    expect(old!.invite_token).toMatch(/^[0-9a-f]{32}$/)

    await migrateDatabase(database.url)

    const { rows } = await client.query<{ name: string, invite_token: string }>('select name, invite_token from board')
    expect(rows).toEqual([{ name: 'Alt', invite_token: old!.invite_token }])
    const { rows: [fresh] } = await client.query<{ invite_token: string }>(`insert into board (name, emoji) values ('Neu', '🍲') returning invite_token`)
    expect(fresh!.invite_token).toMatch(/^[2-9a-hjkmnp-z]{17}$/)
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
