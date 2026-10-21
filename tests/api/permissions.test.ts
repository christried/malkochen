import pg from 'pg'
import { expect, inject, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { ALL_PERMISSIONS, type Permissions } from '../../shared/permissions'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Permissions (#340, CONTEXT.md): the Owner switches each Member's on or
// off; the server refuses what a Member may not do, and the Owner may
// always do everything. Here "add Dishes"; the others in
// dish-permissions.test.ts and board-permissions.test.ts. Bassi owns
// the Boards made here, Herschel joins them, Fossey is the outsider; all
// three are used by this file only.

interface Member { id: string, name: string, isYou: boolean, permissions?: Permissions }
interface Board { id: string, inviteToken: string, version: number, isOwner: boolean, permissions: Permissions, members: Member[] }

const owner = () => signIn(ALLOWLISTED[100])
const member = () => signIn(ALLOWLISTED[101])
const outsider = () => signIn(ALLOWLISTED[102])

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

// A new Board of the owner's that the member has joined.
async function sharedBoard(name: string): Promise<{ board: Board, bassi: Caller, herschel: Caller, herschelId: string }> {
  const bassi = await owner()
  const res = await send(bassi, 'POST', '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const herschel = await member()
  expect((await send(herschel, 'POST', `/api/invites/${(await getBoard(bassi, id)).inviteToken}/join`)).status).toBe(200)
  const board = await getBoard(bassi, id)
  return { board, bassi, herschel, herschelId: board.members.find(m => m.name === 'herschel')!.id }
}

const setPermissions = (caller: Caller, boardId: string, memberId: string, changes: Partial<Permissions>) =>
  send(caller, 'PATCH', `/api/boards/${boardId}/members/${memberId}/permissions`, changes)

const aDish = (title: string) => ({ title, placeholder: 'bowl' })

test('a Member joins with every Permission, and the Board answer carries them', async () => {
  const { board, herschel } = await sharedBoard('Werkstatt')

  expect((await getBoard(herschel, board.id)).permissions).toEqual(ALL_PERMISSIONS)
  expect(board.permissions).toEqual(ALL_PERMISSIONS)
})

test('without "add Dishes" adding is refused with a reason; with it, allowed again', async () => {
  const { board, bassi, herschel, herschelId } = await sharedBoard('Labor')

  const off = await setPermissions(bassi, board.id, herschelId, { addDishes: false })
  expect(off.status).toBe(200)
  expect(await off.json()).toEqual({ ...ALL_PERMISSIONS, addDishes: false })

  const refused = await postDish(herschel, board.id, aDish('Herschels Linsensuppe'))
  expect(refused.status).toBe(403)
  expect((await refused.json()).data).toEqual({ permission: 'addDishes' })
  expect((await getBoard(herschel, board.id)).permissions).toEqual({ ...ALL_PERMISSIONS, addDishes: false })

  expect((await setPermissions(bassi, board.id, herschelId, { addDishes: true })).status).toBe(200)
  expect((await postDish(herschel, board.id, aDish('Herschels Linsensuppe'))).status).toBe(201)
})

test('switching one Permission leaves the others as they are', async () => {
  const { board, bassi, herschelId } = await sharedBoard('Sternwarte')

  await setPermissions(bassi, board.id, herschelId, { addDishes: false, editBoard: false })
  const res = await setPermissions(bassi, board.id, herschelId, { addDishes: true })

  expect(await res.json()).toEqual({ ...ALL_PERMISSIONS, editBoard: false })
})

test('the Owner may always add, whatever their own Permissions say', async () => {
  const { board, bassi } = await sharedBoard('Observatorium')
  const ownerId = board.members.find(m => m.isYou)!.id
  // Not through the API, which refuses switching the Owner's: as if they
  // were the Owner's from before they took over.
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    await client.query(`update membership set permissions = permissions || '{"addDishes": false}' where board_id = $1 and user_id = $2`, [board.id, ownerId])
  }
  finally {
    await client.end()
  }

  expect((await postDish(bassi, board.id, aDish('Bassis Polenta'))).status).toBe(201)
  expect((await getBoard(bassi, board.id)).permissions).toEqual(ALL_PERMISSIONS)
})

test('only the Owner switches Permissions, and never their own', async () => {
  const { board, bassi, herschel, herschelId } = await sharedBoard('Archiv')
  const ownerId = board.members.find(m => m.isYou)!.id

  expect((await setPermissions(herschel, board.id, herschelId, { addDishes: false })).status).toBe(403)
  expect((await setPermissions(herschel, board.id, ownerId, { addDishes: false })).status).toBe(403)
  expect((await setPermissions(bassi, board.id, ownerId, { addDishes: false })).status).toBe(400)
  expect((await setPermissions(bassi, board.id, 'nobody', { addDishes: false })).status).toBe(404)
  expect((await setPermissions(await outsider(), board.id, herschelId, { addDishes: false })).status).toBe(404)
  expect((await setPermissions(bassi, board.id, herschelId, { addDishes: 'no' } as never)).status).toBe(400)
  expect((await setPermissions(bassi, board.id, herschelId, {})).status).toBe(400)
  expect((await setPermissions(bassi, board.id, herschelId, { flying: false } as never)).status).toBe(400)
  expect((await getBoard(herschel, board.id)).permissions).toEqual(ALL_PERMISSIONS)
})

test('the Owner sees every Member\'s Permissions; a Member only their own', async () => {
  const { board, bassi, herschel, herschelId } = await sharedBoard('Bibliothek')
  await setPermissions(bassi, board.id, herschelId, { addDishes: false })

  const asOwner = await getBoard(bassi, board.id)
  expect(asOwner.members.map(m => [m.name, m.permissions])).toEqual([
    ['bassi', ALL_PERMISSIONS],
    ['herschel', { ...ALL_PERMISSIONS, addDishes: false }],
  ])
  const asMember = await getBoard(herschel, board.id)
  expect(asMember.members.map(m => [m.name, m.permissions])).toEqual([
    ['bassi', undefined],
    ['herschel', { ...ALL_PERMISSIONS, addDishes: false }],
  ])
})

test('the Board list carries each Board\'s Permissions, for choosing where to add', async () => {
  const { board, bassi, herschel, herschelId } = await sharedBoard('Hörsaal')
  await setPermissions(bassi, board.id, herschelId, { addDishes: false })

  const listed = await (await herschel.fetch('/api/boards')).json() as { id: string, permissions: Permissions }[]
  expect(listed.find(b => b.id === board.id)!.permissions.addDishes).toBe(false)
})

test('switching a Permission moves the Board Version; switching it to what it is doesn\'t', async () => {
  const { board, bassi, herschelId } = await sharedBoard('Messstation')
  const version = async () => (await getBoard(bassi, board.id)).version
  const before = await version()

  await setPermissions(bassi, board.id, herschelId, { addDishes: false })
  const after = await version()
  expect(after).toBeGreaterThan(before)

  await setPermissions(bassi, board.id, herschelId, { addDishes: false })
  expect(await version()).toBe(after)
})

test('sharing to malkochen lands on the last opened Board the user may add to', async () => {
  const { board, bassi, herschel, herschelId } = await sharedBoard('Teeküche')
  expect((await send(herschel, 'POST', `/api/boards/${board.id}/open`)).status).toBe(204)
  const landing = async () => (await herschel.fetch('/api/boards/landing?adding')).json() as Promise<{ boardId: string, canAdd: boolean }>

  expect(await landing()).toEqual(expect.objectContaining({ boardId: board.id, canAdd: true }))

  await setPermissions(bassi, board.id, herschelId, { addDishes: false })
  const elsewhere = await landing()
  expect(elsewhere.boardId).not.toBe(board.id)
  expect(elsewhere.canAdd).toBe(true)
})

test('the migration gives every existing Member, archived ones too, every Permission', async () => {
  const before = await migrationsBefore('0033_permissions')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    await client.query(`insert into "user" (id, name, email) values ('ada', 'Ada', 'ada@example.com'), ('linus', 'Linus', 'linus@example.com')`)
    const { rows: [live] } = await client.query<{ id: string }>(`insert into board (name, emoji) values ('Kochclub', '🍜') returning id`)
    const { rows: [archived] } = await client.query<{ id: string }>(`insert into board (name, emoji, deleted_at) values ('Alt', '🍜', now()) returning id`)
    await client.query(`insert into membership (board_id, user_id, is_owner) values ($1, 'ada', true), ($1, 'linus', false)`, [live!.id])
    await client.query(`insert into archived_membership (board_id, user_id, is_owner, joined_at) values ($1, 'linus', true, now())`, [archived!.id])

    await migrateDatabase(database.url)

    const { rows } = await client.query<{ permissions: Permissions }>(
      'select permissions from membership union all select permissions from archived_membership',
    )
    expect(rows.map(r => r.permissions)).toEqual([ALL_PERMISSIONS, ALL_PERMISSIONS, ALL_PERMISSIONS])
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
