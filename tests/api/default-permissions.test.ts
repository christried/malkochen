import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { ALL_PERMISSIONS, VIEW_ONLY, type Permission, type Permissions } from '../../shared/permissions'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Default Permissions, "Nur ansehen" and handing over ownership (#343,
// CONTEXT.md): what a new Member gets on joining, the shortcut that leaves
// a Member only commenting and voting, and whose Permissions a handover
// leaves. Tereshkova owns the Boards made here, Cori and Avery join them;
// all three are used by this file only.

interface Member { id: string, name: string, isYou: boolean, isOwner: boolean, permissions?: Permissions }
interface Dish { id: string }
interface Board {
  id: string
  inviteToken: string
  version: number
  isOwner: boolean
  permissions: Permissions
  defaultPermissions?: Permissions
  members: Member[]
  columns: { id: string, dishes: Dish[] }[]
}

const tereshkova = () => signIn(ALLOWLISTED[107])
const cori = () => signIn(ALLOWLISTED[108])
const avery = () => signIn(ALLOWLISTED[109])

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const send = (caller: Caller, method: string, path: string, body?: unknown) =>
  caller.fetch(path, { method, ...body === undefined ? {} : json(body) })

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

async function newBoard(name: string): Promise<{ board: Board, owner: Caller }> {
  const owner = await tereshkova()
  const res = await send(owner, 'POST', '/api/boards', { name, emoji: '🛰️' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return { board: await getBoard(owner, id), owner }
}

const join = async (caller: Caller, board: Board) =>
  expect((await send(caller, 'POST', `/api/invites/${board.inviteToken}/join`)).status).toBe(200)

const setDefaults = (caller: Caller, boardId: string, changes: Partial<Permissions>) =>
  send(caller, 'PATCH', `/api/boards/${boardId}/default-permissions`, changes)
const setPermissions = (caller: Caller, boardId: string, memberId: string, changes: Partial<Permissions>) =>
  send(caller, 'PATCH', `/api/boards/${boardId}/members/${memberId}/permissions`, changes)
const handOver = (caller: Caller, boardId: string, userId: string) =>
  send(caller, 'POST', `/api/boards/${boardId}/owner`, { userId })

const memberId = (board: Board, name: string) => board.members.find(m => m.name === name)!.id

async function expectRefused(res: Response, permission: Permission) {
  expect(res.status).toBe(403)
  expect((await res.json()).data).toEqual({ permission })
}

test('the Default Permissions allow everything until the Owner changes them; only the Owner sees them', async () => {
  const { board, owner } = await newBoard('Wostok')
  expect(board.defaultPermissions).toEqual(ALL_PERMISSIONS)

  const member = await cori()
  await join(member, board)
  expect((await getBoard(member, board.id)).permissions).toEqual(ALL_PERMISSIONS)
  expect((await getBoard(member, board.id)).defaultPermissions).toBeUndefined()
  expect((await getBoard(owner, board.id)).defaultPermissions).toEqual(ALL_PERMISSIONS)
})

test('a Member joining through the Invite Link gets the Default Permissions; those already on keep theirs', async () => {
  const { board, owner } = await newBoard('Saljut')
  const early = await cori()
  await join(early, board)

  const res = await setDefaults(owner, board.id, { addDishes: false, editColumns: false })
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ...ALL_PERMISSIONS, addDishes: false, editColumns: false })

  const late = await avery()
  await join(late, board)
  expect((await getBoard(late, board.id)).permissions).toEqual({ ...ALL_PERMISSIONS, addDishes: false, editColumns: false })
  await expectRefused(await postDish(late, board.id, { title: 'Averys Borschtsch', placeholder: 'bowl' }), 'addDishes')
  expect((await getBoard(early, board.id)).permissions).toEqual(ALL_PERMISSIONS)

  // Following the link again changes nothing about them.
  await setDefaults(owner, board.id, { addDishes: true })
  await join(late, board)
  expect((await getBoard(late, board.id)).permissions.addDishes).toBe(false)
})

test('only the Owner changes the Default Permissions', async () => {
  const { board, owner } = await newBoard('Mir')
  const member = await cori()
  await join(member, board)

  expect((await setDefaults(member, board.id, { addDishes: false })).status).toBe(403)
  expect((await setDefaults(await avery(), board.id, { addDishes: false })).status).toBe(404)
  expect((await setDefaults(owner, board.id, {})).status).toBe(400)
  expect((await setDefaults(owner, board.id, { flying: false } as never)).status).toBe(400)
  expect((await getBoard(owner, board.id)).defaultPermissions).toEqual(ALL_PERMISSIONS)
})

test('"Nur ansehen" leaves a Member only commenting and voting', async () => {
  const { board, owner } = await newBoard('Skylab')
  const dish = await (await postDish(owner, board.id, { title: 'Tereshkovas Soljanka', placeholder: 'bowl' })).json() as Dish
  const member = await cori()
  await join(member, board)

  const res = await setPermissions(owner, board.id, memberId(await getBoard(owner, board.id), 'cori'), VIEW_ONLY)
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ...Object.fromEntries(Object.keys(ALL_PERMISSIONS).map(p => [p, false])), commentAndVote: true })

  await expectRefused(await postDish(member, board.id, { title: 'Coris Pelmeni', placeholder: 'bowl' }), 'addDishes')
  await expectRefused(await send(member, 'PATCH', `/api/dishes/${dish.id}`, { title: 'Umbenannt' }), 'editDishes')
  await expectRefused(await send(member, 'POST', `/api/dishes/${dish.id}/move`, { columnId: board.columns[1]!.id }), 'moveDishes')
  await expectRefused(await send(member, 'DELETE', `/api/dishes/${dish.id}`), 'archiveDishes')
  expect((await send(member, 'POST', `/api/dishes/${dish.id}/comments`, { text: 'Sieht gut aus' })).status).toBe(201)
  expect((await getBoard(member, board.id)).inviteToken).toBeNull()
})

test('handing over: the new Owner has everything, the former Owner keeps everything until the new Owner changes it', async () => {
  const { board, owner } = await newBoard('Sojus')
  const member = await cori()
  await join(member, board)
  const coriId = memberId(await getBoard(owner, board.id), 'cori')
  const tereshkovaId = memberId(await getBoard(owner, board.id), 'tereshkova')
  await setPermissions(owner, board.id, coriId, VIEW_ONLY)

  expect((await handOver(owner, board.id, coriId)).status).toBe(204)

  expect((await getBoard(member, board.id)).permissions).toEqual(ALL_PERMISSIONS)
  const former = await getBoard(owner, board.id)
  expect(former.isOwner).toBe(false)
  expect(former.permissions).toEqual(ALL_PERMISSIONS)
  expect(former.defaultPermissions).toBeUndefined()

  expect((await setPermissions(member, board.id, tereshkovaId, { editBoard: false })).status).toBe(200)
  expect((await getBoard(owner, board.id)).permissions).toEqual({ ...ALL_PERMISSIONS, editBoard: false })

  // Handed back, Cori keeps everything too, not the "Nur ansehen" from before.
  expect((await handOver(member, board.id, tereshkovaId)).status).toBe(204)
  expect((await getBoard(member, board.id)).permissions).toEqual(ALL_PERMISSIONS)
})

test('changing the Default Permissions moves the Board Version', async () => {
  const { board, owner } = await newBoard('Gemini')
  const before = (await getBoard(owner, board.id)).version

  await setDefaults(owner, board.id, { shareInvite: false })

  expect((await getBoard(owner, board.id)).version).toBeGreaterThan(before)
})

test('the migration gives every existing Board, archived ones too, "everything allowed" as Default Permissions', async () => {
  const before = await migrationsBefore('0034_default_permissions')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    await client.query(`insert into board (name, emoji) values ('Kochclub', '🍜')`)
    await client.query(`insert into board (name, emoji, deleted_at) values ('Alt', '🍜', now())`)

    await migrateDatabase(database.url)

    const { rows } = await client.query<{ default_permissions: Permissions }>('select default_permissions from board')
    expect(rows.map(r => r.default_permissions)).toEqual([ALL_PERMISSIONS, ALL_PERMISSIONS])
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
