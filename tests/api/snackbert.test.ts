import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { parseServerEnv } from '../../server/env'
import { snackbertClientFrom } from '../../server/snackbert'
import { startSnackbertService, type SnackbertService } from '../support/snackbert-service'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { ageSnackbertCheck } from './time-travel'
import { TEST_SNACKBERT_SECRET } from '../support/test-auth-env'

// Snackbert in Your Settings (#423): the account check (remembered for a day),
// the switch with its consent (only with an account, asked of Snackbert each
// time it is switched on), the Event Log, and what Snackbert's being down
// does. Snackbert itself is a stand-in (snackbert-service.ts). The users below
// are used by this file only; a test that doesn't care what the last one left
// may reuse one.

const LEVI = ALLOWLISTED[176]
const HACK = ALLOWLISTED[177]
const CRISTOFORETTI = ALLOWLISTED[178]
const GIANOTTI = ALLOWLISTED[179]
const PELLEGRINI = ALLOWLISTED[180]
const TAGLIAVINI = ALLOWLISTED[181]
const CAVALIERI = ALLOWLISTED[182]
const FERRARI = ALLOWLISTED[183]

let snackbert: SnackbertService

beforeAll(async () => {
  snackbert = await startSnackbertService()
})

afterAll(() => snackbert.close())

beforeEach(() => snackbert.forget())

const getSnackbert = async (caller: Caller) => {
  const res = await caller.fetch('/api/me/snackbert')
  expect(res.status).toBe(200)
  return res.json() as Promise<{ available: boolean, on: boolean }>
}
const switchOn = (caller: Caller) => caller.fetch('/api/me/snackbert', { method: 'PUT' })
const switchOff = (caller: Caller) => caller.fetch('/api/me/snackbert', { method: 'DELETE' })

async function idOf(caller: Caller): Promise<string> {
  return ((await (await caller.fetch('/api/me')).json()) as { id: string }).id
}

test('without an account, Snackbert is not available, and Snackbert is asked once', async () => {
  const levi = await signIn(LEVI)
  expect(await getSnackbert(levi)).toEqual({ available: false, on: false })
  expect(snackbert.requests).toHaveLength(1)
  expect(snackbert.requests[0]).toEqual({
    path: '/account-check',
    authorization: `Bearer ${TEST_SNACKBERT_SECRET}`,
    body: { email: LEVI },
  })
})

test('with an account, Snackbert is available and off until switched on', async () => {
  snackbert.accounts.add(HACK)
  const hack = await signIn(HACK)
  expect(await getSnackbert(hack)).toEqual({ available: true, on: false })
})

test('the answer is remembered for a day, then asked again', async () => {
  snackbert.accounts.add(CRISTOFORETTI)
  const cristoforetti = await signIn(CRISTOFORETTI)
  expect(await getSnackbert(cristoforetti)).toEqual({ available: true, on: false })
  expect(await getSnackbert(cristoforetti)).toEqual({ available: true, on: false })
  expect(snackbert.requests).toHaveLength(1)

  // The account is gone at Snackbert, but the answer is still a day old or less.
  snackbert.accounts.delete(CRISTOFORETTI)
  expect(await getSnackbert(cristoforetti)).toEqual({ available: true, on: false })
  expect(snackbert.requests).toHaveLength(1)

  await ageSnackbertCheck(CRISTOFORETTI, 25)
  expect(await getSnackbert(cristoforetti)).toEqual({ available: false, on: false })
  expect(snackbert.requests).toHaveLength(2)
})

test('switching on without an account is refused, and nothing is switched on', async () => {
  const levi = await signIn(LEVI)
  const log = await watchEvents()
  expect((await switchOn(levi)).status).toBe(409)
  expect(await getSnackbert(levi)).toEqual({ available: false, on: false })
  expect((await log.recorded()).filter(e => e.kind === 'snackbert_switched')).toEqual([])
})

test('switching on with an account turns it on, asking Snackbert each time; switching off asks nothing', async () => {
  snackbert.accounts.add(GIANOTTI)
  const gianotti = await signIn(GIANOTTI)
  expect((await switchOn(gianotti)).status).toBe(204)
  expect(snackbert.requests).toHaveLength(1)
  expect(await getSnackbert(gianotti)).toEqual({ available: true, on: true })
  expect(snackbert.requests).toHaveLength(1)

  // The remembered answer is fresh, but switching on asks anyway.
  expect((await switchOn(gianotti)).status).toBe(204)
  expect(snackbert.requests).toHaveLength(2)

  expect((await switchOff(gianotti)).status).toBe(204)
  expect(snackbert.requests).toHaveLength(2)
  expect(await getSnackbert(gianotti)).toEqual({ available: true, on: false })
})

test('switching on and off is recorded in the Event Log, and a repeat of either records nothing', async () => {
  snackbert.accounts.add(PELLEGRINI)
  const pellegrini = await signIn(PELLEGRINI)
  const id = await idOf(pellegrini)
  const log = await watchEvents()

  expect((await switchOn(pellegrini)).status).toBe(204)
  expect((await switchOn(pellegrini)).status).toBe(204)
  expect((await switchOff(pellegrini)).status).toBe(204)
  expect((await switchOff(pellegrini)).status).toBe(204)

  expect(await log.recorded()).toEqual([
    { kind: 'snackbert_switched', boardId: null, dishId: null, userId: id, details: { on: true } },
    { kind: 'snackbert_switched', boardId: null, dishId: null, userId: id, details: { on: false } },
  ])
})

test('when Snackbert can\'t be reached, switching on fails and nothing is switched; a stale answer stands', async () => {
  // Nothing remembered: switching on fails, and Snackbert isn't available.
  const tagliavini = await signIn(TAGLIAVINI)
  snackbert.answer(500)
  expect((await switchOn(tagliavini)).status).toBe(502)
  expect(await getSnackbert(tagliavini)).toEqual({ available: false, on: false })

  // Remembered as available, a day old: Snackbert not answering keeps that answer.
  snackbert.forget()
  snackbert.accounts.add(CAVALIERI)
  const cavalieri = await signIn(CAVALIERI)
  expect(await getSnackbert(cavalieri)).toEqual({ available: true, on: false })
  await ageSnackbertCheck(CAVALIERI, 25)
  snackbert.answer(500)
  expect(await getSnackbert(cavalieri)).toEqual({ available: true, on: false })
})

test('when Snackbert doesn\'t answer at all, switching on fails with 502', async () => {
  const hack = await signIn(HACK)
  snackbert.answer('silent')
  expect((await switchOn(hack)).status).toBe(502)
  snackbert.answer(null)
  expect(await getSnackbert(hack)).toEqual({ available: true, on: false })
}, 20_000)

test('an account gone while Snackbert is on switches it off, and the Event Log says so', async () => {
  snackbert.accounts.add(FERRARI)
  const ferrari = await signIn(FERRARI)
  const id = await idOf(ferrari)
  const log = await watchEvents()
  expect((await switchOn(ferrari)).status).toBe(204)

  snackbert.accounts.delete(FERRARI)
  await ageSnackbertCheck(FERRARI, 25)
  expect(await getSnackbert(ferrari)).toEqual({ available: false, on: false })
  expect(await log.recorded()).toEqual([
    { kind: 'snackbert_switched', boardId: null, dishId: null, userId: id, details: { on: true } },
    { kind: 'snackbert_switched', boardId: null, dishId: null, userId: id, details: { on: false } },
  ])
})

test('Snackbert is off without both of its variables, and both or none is required', () => {
  expect(snackbertClientFrom({ SNACKBERT_URL: '', SNACKBERT_SECRET: '' })).toBeNull()

  const base = {
    DATABASE_URL: 'postgres://localhost:5432/malkochen',
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
  }
  const url = 'https://europe-west1-snackbert-christried.cloudfunctions.net/malkochen'
  expect(() => parseServerEnv({ ...base, SNACKBERT_URL: url })).toThrow('SNACKBERT_URL and SNACKBERT_SECRET must be set together, or none of them')
  expect(() => parseServerEnv({ ...base, SNACKBERT_SECRET: 'x'.repeat(16) })).toThrow('SNACKBERT_URL and SNACKBERT_SECRET must be set together, or none of them')
  const both = parseServerEnv({ ...base, SNACKBERT_URL: url, SNACKBERT_SECRET: 'x'.repeat(16) })
  expect(both.SNACKBERT_URL).toBe(url)
  expect(snackbertClientFrom(both)).not.toBeNull()
})
