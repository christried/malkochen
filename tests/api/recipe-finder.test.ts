import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import type { AdminEventPage } from '../../shared/admin'
import type { AdminRecipeFinderUser, RecipeFinderStatus } from '../../shared/recipe-finder'
import { startResendService, type ResendService } from '../support/resend-service'
import { OPERATOR } from '../support/test-auth-env'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { endLimitWindow, useUpLimit } from './time-travel'

// The Recipe Finder switch (#497, ADR 0013): off for every new user; a user
// asks once in Your Settings, which emails the Operator; only the Operator
// switches it on or off, from the Admin Page. The users below are used by
// this file only.

const user = (name: string) => ALLOWLISTED[ALLOWLISTED.indexOf(`${name}@example.com` as typeof ALLOWLISTED[number])]!
const LAMPORT = user('lamport')
const HOARE = user('hoare')
const BACKUS = user('backus')
const MCCARTHY = user('mccarthy')
const WIRTH = user('wirth')
const KAY = user('kay')
const IVERSON = user('iverson')
const HAZELHURST = user('hazelhurst')
const AMBROSE = user('ambrose')
const THIBAULT = user('thibault')

let resend: ResendService

beforeAll(async () => {
  resend = await startResendService()
})

afterAll(() => resend.close())

beforeEach(() => resend.forget())

const json = (body: unknown): RequestInit => ({ method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function stateOf(caller: Caller): Promise<RecipeFinderStatus> {
  const res = await caller.fetch('/api/me/recipe-finder')
  expect(res.status).toBe(200)
  return res.json()
}

const ask = (caller: Caller) => caller.fetch('/api/me/recipe-finder', { method: 'POST' })
const switchFor = (caller: Caller, userId: string, on: unknown) => caller.fetch(`/api/admin/recipe-finder/${userId}`, json({ on }))

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

async function listed(operator: Caller): Promise<AdminRecipeFinderUser[]> {
  const res = await operator.fetch('/api/admin/recipe-finder')
  expect(res.status).toBe(200)
  return res.json()
}

const emailsToOperator = () => resend.sent.filter(e => e.to.includes(OPERATOR))

test('a new user starts with it off', async () => {
  expect(await stateOf(await signIn(LAMPORT))).toEqual({ state: 'off', available: true })
})

test('asking moves a user to asked, records it and emails the Operator once, naming them', async () => {
  const hoare = await signIn(HOARE, { name: 'Tony' })
  const events = await watchEvents()

  const before = Date.now()
  const res = await ask(hoare)
  expect(res.status).toBe(200)
  const asked = await res.json() as RecipeFinderStatus
  expect(asked.state).toBe('asked')
  if (asked.state !== 'asked') return
  expect(Date.parse(asked.askedAt)).toBeGreaterThanOrEqual(before - 1000)
  expect(await stateOf(hoare)).toEqual(asked)

  const mails = emailsToOperator()
  expect(mails).toHaveLength(1)
  expect(mails[0]!.subject).toContain('Tony')
  expect(mails[0]!.text).toContain('Tony')
  expect(mails[0]!.text).toContain('/admin')
  expect(resend.sent).toHaveLength(1)

  expect(await events.recorded()).toEqual([
    { kind: 'recipe_finder_asked', boardId: null, dishId: null, userId: await idOf(hoare), details: null },
  ])
})

test('asking again changes nothing and sends no second email', async () => {
  const backus = await signIn(BACKUS)
  await ask(backus)
  const first = await stateOf(backus)
  resend.forget()
  const events = await watchEvents()

  const again = await Promise.all([ask(backus), ask(backus)])
  for (const res of again) expect(await res.json()).toEqual(first)
  expect(await stateOf(backus)).toEqual(first)
  expect(resend.sent).toHaveLength(0)
  expect(await events.recorded()).toEqual([])
})

test('the email is in the Operator\'s language', async () => {
  const operator = await signIn(OPERATOR)
  expect((await operator.fetch('/api/me/language', json({ language: 'it' }))).status).toBe(200)
  try {
    await ask(await signIn(MCCARTHY, { name: 'John' }))
    const [mail] = emailsToOperator()
    expect(mail!.subject).toBe('John chiede il Trova ricette')
  }
  finally {
    await operator.fetch('/api/me/language', json({ language: 'auto' }))
  }
})

test('the Operator lists who asked and who has it, and switches any user on and off', async () => {
  const operator = await signIn(OPERATOR)
  const wirth = await signIn(WIRTH, { name: 'Niklaus' })
  const kay = await signIn(KAY, { name: 'Alan' })
  const wirthId = await idOf(wirth)
  const kayId = await idOf(kay)
  const operatorId = await idOf(operator)
  await ask(wirth)
  resend.forget()
  const events = await watchEvents()

  const asking = (await listed(operator)).find(u => u.id === wirthId)
  expect(asking).toMatchObject({ name: 'Niklaus', state: 'asked' })
  expect(asking!.askedAt).not.toBeNull()
  expect((await listed(operator)).some(u => u.id === kayId)).toBe(false)

  // A request granted, and a user switched on who never asked.
  expect((await switchFor(operator, wirthId, true)).status).toBe(200)
  expect((await switchFor(operator, kayId, true)).status).toBe(200)
  expect(await stateOf(wirth)).toEqual({ state: 'on', available: true })
  expect(await stateOf(kay)).toEqual({ state: 'on', available: true })
  const on = await listed(operator)
  expect(on.find(u => u.id === wirthId)).toMatchObject({ state: 'on', askedAt: asking!.askedAt })
  expect(on.find(u => u.id === kayId)).toMatchObject({ name: 'Alan', state: 'on', askedAt: null })

  // On already: nothing changes, nothing is recorded.
  expect((await switchFor(operator, kayId, true)).status).toBe(200)

  // Asking while on changes nothing.
  expect(await (await ask(kay)).json()).toEqual({ state: 'on', available: true })
  expect(resend.sent).toHaveLength(0)

  expect((await switchFor(operator, kayId, false)).status).toBe(200)
  expect(await stateOf(kay)).toEqual({ state: 'off', available: true })
  expect((await listed(operator)).some(u => u.id === kayId)).toBe(false)
  // Off already: nothing.
  expect((await switchFor(operator, kayId, false)).status).toBe(200)

  expect(await events.recorded()).toEqual([
    { kind: 'recipe_finder_switched', boardId: null, dishId: null, userId: operatorId, details: { member: wirthId, on: true } },
    { kind: 'recipe_finder_switched', boardId: null, dishId: null, userId: operatorId, details: { member: kayId, on: true } },
    { kind: 'recipe_finder_switched', boardId: null, dishId: null, userId: operatorId, details: { member: kayId, on: false } },
  ])

  // The Event Log names whose it was switched.
  const page = await (await operator.fetch('/api/admin/events?kinds=recipe_finder_switched')).json() as AdminEventPage
  expect(page.events[0]).toMatchObject({ kind: 'recipe_finder_switched', member: { id: kayId, name: 'Alan' }, details: { on: false } })

  await switchFor(operator, wirthId, false)
})

test('the Operator\'s switch takes on or off only, and a user that exists', async () => {
  const operator = await signIn(OPERATOR)
  const kayId = await idOf(await signIn(KAY))
  expect((await switchFor(operator, kayId, 'yes')).status).toBe(400)
  expect((await switchFor(operator, 'no-such-user', true)).status).toBe(404)
})

test('nobody but the Operator lists or switches it, for themselves or anyone else', async () => {
  const iverson = await signIn(IVERSON)
  const iversonId = await idOf(iverson)
  const otherId = await idOf(await signIn(KAY))

  expect((await iverson.fetch('/api/admin/recipe-finder')).status).toBe(404)
  expect((await switchFor(iverson, iversonId, true)).status).toBe(404)
  expect((await switchFor(iverson, otherId, true)).status).toBe(404)
  // No way in through their own settings either.
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    expect((await iverson.fetch('/api/me/recipe-finder', { ...json({ on: true }), method })).ok).toBe(false)
  }
  expect(await stateOf(iverson)).toEqual({ state: 'off', available: true })
  expect(await stateOf(await signIn(KAY))).toEqual({ state: 'off', available: true })
})

test('deleting an account removes the state', async () => {
  const lamport = await signIn(LAMPORT)
  const lamportId = await idOf(lamport)
  await ask(lamport)
  const operator = await signIn(OPERATOR)
  expect((await switchFor(operator, lamportId, true)).status).toBe(200)

  const username = ((await (await lamport.fetch('/api/me')).json()) as { name: string }).name
  expect((await lamport.fetch('/api/me', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username }) })).status).toBe(204)

  expect((await listed(operator)).some(u => u.id === lamportId)).toBe(false)
  // Back with a new account: off, like any new user.
  expect(await stateOf(await signIn(LAMPORT))).toEqual({ state: 'off', available: true })
})

test('the Admin list shows each user\'s email, picture and the searches counting against their cap now', async () => {
  const operator = await signIn(OPERATOR)
  const hazelhurst = await signIn(HAZELHURST, { name: 'Hazel', image: 'https://example.com/hazel.png' })
  const hazelhurstId = await idOf(hazelhurst)
  await ask(hazelhurst)

  const own = async () => (await listed(operator)).find(u => u.id === hazelhurstId)!
  expect(await own()).toMatchObject({ name: 'Hazel', email: HAZELHURST, image: 'https://example.com/hazel.png', searchesToday: 0 })

  // The window is running: its calls count.
  await useUpLimit(HAZELHURST, 'recipe-search', 7)
  expect((await own()).searchesToday).toBe(7)
  // Another limit's calls don't.
  await useUpLimit(HAZELHURST, 'username', 3)
  expect((await own()).searchesToday).toBe(7)

  // The window is over: they may search anew, so none count.
  await endLimitWindow(HAZELHURST, 'recipe-search')
  expect((await own()).searchesToday).toBe(0)

  await switchFor(operator, hazelhurstId, false)
})

test('the Admin list puts who asked before who was switched on unasked, within each group', async () => {
  const operator = await signIn(OPERATOR)
  const ambroseId = await idOf(await signIn(AMBROSE, { name: 'Ambrose' }))
  const thibault = await signIn(THIBAULT, { name: 'Thibault' })
  const thibaultId = await idOf(thibault)

  // Thibault never asked, so he has no request date, which must not float him up.
  await switchFor(operator, thibaultId, true)
  await ask(await signIn(AMBROSE))
  await switchFor(operator, ambroseId, true)

  const ids = (await listed(operator)).map(u => u.id)
  expect(ids).toContain(ambroseId)
  expect(ids.indexOf(ambroseId)).toBeLessThan(ids.indexOf(thibaultId))

  await switchFor(operator, ambroseId, false)
  await switchFor(operator, thibaultId, false)
})
