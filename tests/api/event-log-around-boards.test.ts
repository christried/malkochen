import sharp from 'sharp'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { startResendService, type ResendService } from '../support/resend-service'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { everyEventAsText, watchEvents, type LoggedEvent } from './event-log'
import { startPushService, type Device, type PushService } from './push-service'
import { CRON_SECRET } from './server-env'

// The event log (#331) around Boards (#399): sign-up and sign-in, the
// settings a Member changes (Username, Profile Picture, language, push
// notifications on a device, the Email Digest), the account deleted, and the
// push notifications and Email Digests sent. None of them has a Board, but
// push_sent (its recipient's, per device) and the events of a Dish or Board
// they are about. Ids and non-content details only. The users below are
// used by this file only, and the tests run in order: the sign-up is first,
// and the account deletion last.

const MAXWELL = ALLOWLISTED[148]
const EULER = ALLOWLISTED[149]
const GAUSS = ALLOWLISTED[150]
const RIEMANN = ALLOWLISTED[151]

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

async function usernameOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { name: string }).name
}

// Every event of this file so far, oldest first: the watch starts with the
// first test, before anyone signs in.
let all: { recorded: () => Promise<LoggedEvent[]> }
// The events of one user, in the order recorded.
const of =(events: LoggedEvent[], userId: string) => events.filter(e => e.userId === userId)

let pushService: PushService
let resend: ResendService

beforeAll(async () => {
  pushService = await startPushService()
  resend = await startResendService()
})

afterAll(async () => {
  await pushService.close()
  await resend.close()
})

test('a first sign-in records the sign-up and the sign-in, a later one only the sign-in, both by the dev sign-in', async () => {
  all = await watchEvents()
  const maxwell = await signIn(MAXWELL)
  const id = await idOf(maxwell)

  expect(await all.recorded()).toEqual([
    { kind: 'signed_up', boardId: null, dishId: null, userId: id, details: { method: 'dev' } },
    { kind: 'signed_in', boardId: null, dishId: null, userId: id, details: { method: 'dev' } },
  ])

  const again = await watchEvents()
  await signIn(MAXWELL)
  expect(await again.recorded()).toEqual([
    { kind: 'signed_in', boardId: null, dishId: null, userId: id, details: { method: 'dev' } },
  ])
})

test('a Username changed is recorded, and keeping the one they have records nothing', async () => {
  const maxwell = await signIn(MAXWELL)
  const id = await idOf(maxwell)
  const log = await watchEvents()

  const keep = await maxwell.fetch('/api/me/username', json('PUT', { username: await usernameOf(maxwell) }))
  expect(keep.status).toBe(200)
  expect(await log.recorded()).toEqual([])

  const changed = await maxwell.fetch('/api/me/username', json('PUT', { username: 'Maxi' }))
  expect(changed.status).toBe(200)
  expect(await log.recorded()).toEqual([
    { kind: 'username_changed', boardId: null, dishId: null, userId: id, details: null },
  ])
})

test('a Profile Picture set and removed is recorded, and setting the same thing again records nothing', async () => {
  const maxwell = await signIn(MAXWELL)
  const id = await idOf(maxwell)
  const log = await watchEvents()
  const bytes = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#4a7' } }).jpeg().toBuffer()
  const uploaded = await maxwell.fetch('/api/me/pictures', { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
  expect(uploaded.status).toBe(201)
  const { url, ticket } = await uploaded.json() as { url: string, ticket: string }

  expect((await maxwell.fetch('/api/me/picture', json('PUT', { url, ticket }))).status).toBe(200)
  expect((await maxwell.fetch('/api/me/picture', json('PUT', { url, ticket }))).status).toBe(200)
  expect((await maxwell.fetch('/api/me/picture', { method: 'DELETE' })).status).toBe(200)
  expect((await maxwell.fetch('/api/me/picture', { method: 'DELETE' })).status).toBe(200)

  expect(await log.recorded()).toEqual([
    { kind: 'picture_changed', boardId: null, dishId: null, userId: id, details: { on: true } },
    { kind: 'picture_changed', boardId: null, dishId: null, userId: id, details: { on: false } },
  ])
})

test('the language changed is recorded, and setting the same language again records nothing', async () => {
  const maxwell = await signIn(MAXWELL)
  const id = await idOf(maxwell)
  const log = await watchEvents()

  expect((await maxwell.fetch('/api/me/language', json('PUT', { language: 'en' }))).status).toBe(200)
  expect((await maxwell.fetch('/api/me/language', json('PUT', { language: 'en' }))).status).toBe(200)

  expect(await log.recorded()).toEqual([
    { kind: 'language_changed', boardId: null, dishId: null, userId: id, details: { language: 'en' } },
  ])
})

test('push notifications switched on and off for a device are recorded, and a repeat of either records nothing', async () => {
  const euler = await signIn(EULER)
  const id = await idOf(euler)
  const device = pushService.device('euler-phone')
  const log = await watchEvents()

  expect((await euler.fetch('/api/me/push', json('PUT', device.subscription))).status).toBe(204)
  // The same device again: a re-subscription, not a switch.
  expect((await euler.fetch('/api/me/push', json('PUT', device.subscription))).status).toBe(204)
  expect((await euler.fetch('/api/me/push', json('DELETE', { endpoint: device.subscription.endpoint }))).status).toBe(204)
  expect((await euler.fetch('/api/me/push', json('DELETE', { endpoint: device.subscription.endpoint }))).status).toBe(204)

  expect(await log.recorded()).toEqual([
    { kind: 'push_switched', boardId: null, dishId: null, userId: id, details: { on: true } },
    { kind: 'push_switched', boardId: null, dishId: null, userId: id, details: { on: false } },
  ])
})

test('the Email Digest switched on and off is recorded, and a repeat of either records nothing', async () => {
  const euler = await signIn(EULER)
  const id = await idOf(euler)
  const log = await watchEvents()

  expect((await euler.fetch('/api/me/email-digest', { method: 'PUT' })).status).toBe(204)
  expect((await euler.fetch('/api/me/email-digest', { method: 'PUT' })).status).toBe(204)
  expect((await euler.fetch('/api/me/email-digest', { method: 'DELETE' })).status).toBe(204)
  expect((await euler.fetch('/api/me/email-digest', { method: 'DELETE' })).status).toBe(204)

  expect(await log.recorded()).toEqual([
    { kind: 'digest_switched', boardId: null, dishId: null, userId: id, details: { on: true } },
    { kind: 'digest_switched', boardId: null, dishId: null, userId: id, details: { on: false } },
  ])
})

test('a push notification sent is recorded per device, with its Board and Dish; a device the service has gone records gone', async () => {
  const gauss = await signIn(GAUSS)
  const riemann = await signIn(RIEMANN)
  const riemannId = await idOf(riemann)
  const phone: Device = pushService.device('riemann-phone')
  const tablet: Device = pushService.device('riemann-tablet')
  expect((await riemann.fetch('/api/me/push', json('PUT', phone.subscription))).status).toBe(204)
  expect((await riemann.fetch('/api/me/push', json('PUT', tablet.subscription))).status).toBe(204)
  pushService.answer(tablet, 410)

  const res = await gauss.fetch('/api/boards', json('POST', { name: 'Pushprobe', emoji: '🥘' }))
  const { id: boardId } = await res.json() as { id: string }
  const { inviteToken } = await (await gauss.fetch(`/api/boards/${boardId}`)).json() as { inviteToken: string }
  expect((await riemann.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  const log = await watchEvents()

  const dishRes = await postDish(gauss, boardId, { title: 'Brokkoli-Auflauf', placeholder: 'bowl' })
  expect(dishRes.status).toBe(201)
  const { id: dishId } = await dishRes.json() as { id: string }

  const sent = (await log.recorded()).filter(e => e.kind === 'push_sent')
  expect(sent.map(e => [e.userId, e.boardId, e.dishId, e.details]).toSorted((a, b) => JSON.stringify(a[3]).localeCompare(JSON.stringify(b[3])))).toEqual([
    [riemannId, boardId, dishId, { outcome: 'gone' }],
    [riemannId, boardId, dishId, { outcome: 'sent' }],
  ])
})

test('an Email Digest sent is recorded with the number of Boards it listed', async () => {
  const gauss = await signIn(GAUSS)
  const riemann = await signIn(RIEMANN)
  const riemannId = await idOf(riemann)
  expect((await riemann.fetch('/api/me/email-digest', { method: 'PUT' })).status).toBe(204)
  const res = await gauss.fetch('/api/boards', json('POST', { name: 'Digestprobe', emoji: '🍜' }))
  const { id: boardId } = await res.json() as { id: string }
  const { inviteToken } = await (await gauss.fetch(`/api/boards/${boardId}`)).json() as { inviteToken: string }
  expect((await riemann.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  const dishRes = await postDish(gauss, boardId, { title: 'Linsen', placeholder: 'bowl' })
  expect(dishRes.status).toBe(201)
  const log = await watchEvents()

  const run = await anonymous().fetch('/api/cron/email-digest', { headers: { authorization: `Bearer ${CRON_SECRET}` } })
  expect(run.status).toBe(200)

  expect((await log.recorded()).filter(e => e.kind === 'digest_sent' && e.userId === riemannId)).toEqual([
    { kind: 'digest_sent', boardId: null, dishId: null, userId: riemannId, details: { boards: 1 } },
  ])
})

test('deleting the account records one account_deleted with no user, and the user\'s earlier events lose their user', async () => {
  const euler = await signIn(EULER)
  const id = await idOf(euler)
  const before = await all.recorded()
  const theirs = of(before, id).map(e => e.kind)
  expect(theirs.length).toBeGreaterThan(0)

  const res = await euler.fetch('/api/me', json('DELETE', { username: await usernameOf(euler) }))
  expect(res.status).toBe(204)

  const after = await all.recorded()
  expect(of(after, id)).toEqual([])
  const nobody = after.filter(e => e.userId === null)
  expect(nobody.map(e => e.kind)).toEqual([...theirs, 'account_deleted'])
  expect(nobody.at(-1)).toEqual({ kind: 'account_deleted', boardId: null, dishId: null, userId: null, details: null })
})

test('no event holds an address', async () => {
  expect(await everyEventAsText()).not.toContain('@example.com')
})
