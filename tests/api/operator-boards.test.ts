import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import type { AdminBoard } from '../../shared/admin'
import { ALL_PERMISSIONS } from '../../shared/permissions'
import { OPERATOR } from '../support/test-auth-env'
import { startResendService, type ResendService } from '../support/resend-service'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { startPushService, type PushService } from './push-service'
import { CRON_SECRET } from './server-env'

// The Operator opens every Board (#397, ADR 0009): through the one access
// check they have an Owner's rights on every live Board without being a
// Member of it, and the Admin Page lists every Board. Everyone else's access
// is unchanged. Ada owns the Boards made here; Grace and Margaret join them;
// Linus is no Member of any. All four are used by this file only.

const ADA = ALLOWLISTED[144]
const GRACE = ALLOWLISTED[145]
const LINUS = ALLOWLISTED[146]
const MARGARET = ALLOWLISTED[147]

interface Member { id: string, name: string, isOwner: boolean }
interface Board {
  id: string
  slug: string
  name: string
  inviteToken: string | null
  asOperator: boolean
  permissions: Record<string, boolean>
  members: Member[]
  newDishIds: string[]
  columns: { id: string, dishes: { id: string, title: string, addedBy: { name: string } | null }[] }[]
}

let push: PushService
let resend: ResendService

beforeAll(async () => {
  push = await startPushService()
  resend = await startResendService()
})

afterAll(async () => {
  await push.close()
  await resend.close()
})

beforeEach(() => {
  push.forget()
  resend.forget()
})

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const operator = () => signIn(OPERATOR)
const ada = () => signIn(ADA, { name: 'Ada' })
const grace = () => signIn(GRACE, { name: 'Grace' })
const linus = () => signIn(LINUS, { name: 'Linus' })

const getBoard = (caller: Caller, id: string): Promise<Board> => caller.fetch(`/api/boards/${id}`).then(res => res.json())
const me = async (caller: Caller) => (await caller.fetch('/api/me')).json() as Promise<{ id: string, name: string }>

// A new Board of Ada's, with `joiners` joined.
async function adaBoard(name: string, ...joiners: Caller[]): Promise<Board> {
  const owner = await ada()
  const res = await owner.fetch('/api/boards', json('POST', { name, emoji: '🥘' }))
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(owner, id)
  for (const joiner of joiners) {
    expect((await joiner.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  }
  return getBoard(owner, id)
}

test('the Operator opens a Board they are not on, which is shown as the Operator visiting', async () => {
  const board = await adaBoard('Operator zu Besuch')
  const op = await operator()

  const read = await op.fetch(`/api/boards/${board.id}`)
  expect(read.status).toBe(200)
  expect(await read.json()).toMatchObject({ id: board.id, isOwner: true, asOperator: true })
  expect((await op.fetch(`/api/boards/${board.id}/open`, { method: 'POST' })).status).toBe(204)
  const seen = await op.fetch(`/api/boards/${board.id}/seen`, { method: 'POST' })
  expect(seen.status).toBe(200)
  expect(await seen.json()).toMatchObject({ id: board.id, asOperator: true })
  expect((await getBoard(await ada(), board.id)).asOperator).toBe(false)
})

test('the Operator writes on it like its Owner: Dishes, name, Invite Link, Permissions, archiving', async () => {
  const member = await grace()
  const board = await adaBoard('Operator schreibt', member)
  const op = await operator()
  const graceId = board.members.find(m => m.name === 'Grace')!.id

  const added = await postDish(op, board.id, { title: 'Betreiber-Suppe', placeholder: 'bowl' })
  expect(added.status).toBe(201)
  const { id: dishId } = await added.json() as { id: string }
  const dish = (await getBoard(await ada(), board.id)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)
  expect(dish?.addedBy?.name).toBe((await me(op)).name)

  expect((await op.fetch(`/api/boards/${board.id}`, json('PATCH', { name: 'Umbenannt', emoji: '🍜' }))).status).toBe(200)
  expect((await getBoard(await ada(), board.id)).name).toBe('Umbenannt')

  expect((await op.fetch(`/api/boards/${board.id}/invite/reset`, { method: 'POST' })).status).toBe(200)
  expect((await getBoard(await ada(), board.id)).inviteToken).not.toBe(board.inviteToken)

  const perms = await op.fetch(`/api/boards/${board.id}/members/${graceId}/permissions`, json('PATCH', { addDishes: false }))
  expect(perms.status).toBe(200)
  expect(await perms.json()).toEqual({ ...ALL_PERMISSIONS, addDishes: false })

  expect((await op.fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })).status).toBe(204)
})

test('the Operator hands the Board over from its Owner to another Member, recorded as theirs', async () => {
  const member = await grace()
  const board = await adaBoard('Operator übergibt', member)
  const op = await operator()
  const graceId = board.members.find(m => m.name === 'Grace')!.id
  const events = await watchEvents()

  const res = await op.fetch(`/api/boards/${board.id}/owner`, json('POST', { userId: graceId }))

  expect(res.status).toBe(204)
  const after = await getBoard(member, board.id)
  expect(after.members.filter(m => m.isOwner).map(m => m.name)).toEqual(['Grace'])
  const handed = (await events.recorded()).filter(e => e.kind === 'ownership_handed_over')
  expect(handed).toEqual([expect.objectContaining({ boardId: board.id, userId: (await me(op)).id, details: { member: graceId } })])
})

test('the Operator is no Member of it: not listed, not in their Boards, and they cannot leave it', async () => {
  const board = await adaBoard('Operator unsichtbar')
  const op = await operator()
  const opId = (await me(op)).id

  const visited = await getBoard(op, board.id)
  expect(visited.members.map(m => m.id)).not.toContain(opId)
  const mine = await (await op.fetch('/api/boards')).json() as { id: string }[]
  expect(mine.map(b => b.id)).not.toContain(board.id)

  expect((await op.fetch(`/api/boards/${board.id}/members/${opId}`, { method: 'DELETE' })).status).toBe(404)
  expect((await getBoard(op, board.id)).asOperator).toBe(true)
})

test('what the Operator sees of a Board has no New Dish', async () => {
  const member = await grace()
  const board = await adaBoard('Operator ohne Neu', member)
  const op = await operator()
  await op.fetch(`/api/boards/${board.id}/open`, { method: 'POST' })
  await member.fetch(`/api/boards/${board.id}/open`, { method: 'POST' })
  const added = await postDish(await ada(), board.id, { title: 'Neues Gericht', placeholder: 'bowl' })
  const { id } = await added.json() as { id: string }

  expect((await getBoard(member, board.id)).newDishIds).toEqual([id])
  expect((await getBoard(op, board.id)).newDishIds).toEqual([])
})

test('nothing from a Board the Operator is not on reaches them as a Push Notification or in the Email Digest', async () => {
  const member = await grace()
  const board = await adaBoard('Operator still', member)
  const op = await operator()
  const device = push.device('operator-phone')
  expect((await op.fetch('/api/me/push', json('PUT', device.subscription))).status).toBe(204)
  expect((await op.fetch('/api/me/email-digest', { method: 'PUT' })).status).toBe(204)
  try {
    expect((await postDish(await ada(), board.id, { title: 'Stilles Gericht', placeholder: 'bowl' })).status).toBe(201)
    const run = await anonymous().fetch('/api/cron/email-digest', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
    expect(run.status).toBe(200)

    expect(push.deliveries.map(d => d.device)).not.toContain('operator-phone')
    expect(resend.sent.filter(e => e.to.includes(OPERATOR))).toEqual([])
  }
  finally {
    await op.fetch('/api/me/push', json('DELETE', { endpoint: device.subscription.endpoint }))
    await op.fetch('/api/me/email-digest', { method: 'DELETE' })
  }
})

test('someone who is not the Operator and not a Member still gets "not found", and so does the Operator on an Archived Board', async () => {
  const board = await adaBoard('Fremde draußen')
  const outsider = await linus()

  expect((await outsider.fetch(`/api/boards/${board.id}`)).status).toBe(404)
  expect((await postDish(outsider, board.id, { title: 'Eindringling', placeholder: 'bowl' })).status).toBe(404)
  expect((await outsider.fetch(`/api/boards/${board.id}`, json('PATCH', { name: 'Meins' }))).status).toBe(404)
  expect((await outsider.fetch(`/api/boards/${board.id}/open`, { method: 'POST' })).status).toBe(404)

  const gone = await adaBoard('Archiviert für alle')
  expect((await (await ada()).fetch(`/api/boards/${gone.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await (await operator()).fetch(`/api/boards/${gone.id}`)).status).toBe(404)
})

test('the Admin Page lists every Board with its Owner and counts, filtered by name or Owner, for the Operator only', async () => {
  const member = await signIn(MARGARET, { name: 'Margaret' })
  const board = await adaBoard('Spaghetti-Zentrale', member)
  await postDish(await ada(), board.id, { title: 'Carbonara', placeholder: 'bowl' })
  const archived = await adaBoard('Zombie-Zentrale')
  await (await ada()).fetch(`/api/boards/${archived.id}`, { method: 'DELETE' })
  const op = await operator()
  const listing = async (q?: string) => {
    const res = await op.fetch(`/api/admin/boards${q === undefined ? '' : `?q=${encodeURIComponent(q)}`}`)
    expect(res.status).toBe(200)
    return await res.json() as AdminBoard[]
  }

  expect(await listing('spaghetti')).toEqual([{
    id: board.id,
    slug: board.slug,
    emoji: '🥘',
    name: 'Spaghetti-Zentrale',
    owner: 'Ada',
    members: 2,
    dishes: 1,
    lastActivity: expect.any(String),
    archived: false,
  }])
  expect((await listing('zombie'))[0]).toMatchObject({ id: archived.id, archived: true, owner: 'Ada' })
  expect((await listing('  ADA ')).map(b => b.id)).toEqual(expect.arrayContaining([board.id, archived.id]))
  expect(await listing('gibt-es-nicht')).toEqual([])
  expect((await listing()).length).toBeGreaterThanOrEqual(2)

  expect((await (await linus()).fetch('/api/admin/boards')).status).toBe(404)
  expect((await (await ada()).fetch('/api/admin/boards')).status).toBe(404)
})

test('the Operator visiting opens a Member\'s popover, which lists only Boards the Operator really belongs to', async () => {
  const member = await grace()
  const board = await adaBoard('Operator am Popover', member)
  const op = await operator()
  const graceId = board.members.find(m => m.name === 'Grace')!.id

  const res = await op.fetch(`/api/boards/${board.id}/people/${graceId}`)

  expect(res.status).toBe(200)
  const card = await res.json() as { id: string, sharedBoards: { id: string }[] }
  expect(card.id).toBe(graceId)
  expect(card.sharedBoards.map(b => b.id)).not.toContain(board.id)
  expect(card.sharedBoards).toEqual([])
})

test('on a Board the Operator joined as a Member, they have an Owner\'s rights and can still leave it', async () => {
  const op = await operator()
  const member = await grace()
  const board = await adaBoard('Operator als Mitglied', op, member)
  const opId = (await me(op)).id
  const graceId = board.members.find(m => m.name === 'Grace')!.id

  const visited = await getBoard(op, board.id)
  expect(visited).toMatchObject({ isOwner: true, asOperator: false })
  expect(visited.permissions).toEqual(ALL_PERMISSIONS)
  expect(visited.members.find(m => m.id === opId)).toMatchObject({ isOwner: false })
  expect(visited.members.find(m => m.name === 'Ada')).toMatchObject({ isOwner: true })

  expect((await op.fetch(`/api/boards/${board.id}/members/${graceId}/permissions`, json('PATCH', { addDishes: false }))).status).toBe(200)
  expect((await op.fetch(`/api/boards/${board.id}/invite/reset`, { method: 'POST' })).status).toBe(200)
  expect((await op.fetch(`/api/boards/${board.id}/members/${graceId}`, { method: 'DELETE' })).status).toBe(204)
  expect((await getBoard(await ada(), board.id)).members.map(m => m.id)).not.toContain(graceId)

  expect((await op.fetch(`/api/boards/${board.id}/members/${opId}`, { method: 'DELETE' })).status).toBe(204)
  expect((await getBoard(await ada(), board.id)).members.map(m => m.id)).not.toContain(opId)
  expect((await getBoard(op, board.id)).asOperator).toBe(true)

  expect((await (await ada()).fetch(`/api/boards/${board.id}/members/${(await me(await ada())).id}`, { method: 'DELETE' })).status).toBe(409)
})
