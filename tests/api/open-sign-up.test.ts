import { afterAll, beforeAll, expect, inject, test } from 'vitest'
import type { AdminFigures } from '../../shared/admin'
import { OPERATOR } from '../support/test-auth-env'
import { startResendService, type ResendService } from '../support/resend-service'
import { ALLOWLISTED, anonymous, devSignIn, signIn, type Caller } from './client'
import { watchEvents } from './event-log'

// Open Sign-up (#350, PRD #321 stories 34–36): the Operator's switch
// "Anmeldung offen", PUT /api/admin/open-sign-up { on }. Off (the default),
// only the Allowlist signs up; on, anyone, with Google or by email; off
// again, nobody new, while everyone with an account still signs in. Each
// test leaves it off, as every other file expects. Turing is used by this
// file only; the strangers are new each run.

const TURING = ALLOWLISTED.indexOf('turing@example.com')

const run = Date.now().toString(36)
let strangers = 0
const stranger = () => `stranger-${run}-${++strangers}@example.org`

let resend: ResendService

beforeAll(async () => {
  resend = await startResendService()
})

afterAll(async () => {
  await switchOpenSignUp(await signIn(OPERATOR), false)
  resend.close()
})

function switchOpenSignUp(caller: Caller, on: boolean) {
  return caller.fetch('/api/admin/open-sign-up', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on }),
  })
}

async function switchAs(caller: Caller, on: boolean) {
  expect((await switchOpenSignUp(caller, on)).status).toBe(200)
}

const askForCode = (email: string) => anonymous().fetch('/api/auth/email-otp/send-verification-otp', {
  method: 'POST',
  // An address of its own, so Better Auth's limit per address counts this file apart.
  headers: { 'content-type': 'application/json', 'origin': inject('apiBaseUrl'), 'x-forwarded-for': `2001:db8:350::${(++strangers).toString(16)}` },
  body: JSON.stringify({ email, type: 'sign-in' }),
})

test('off, a stranger is refused "Not unlocked" with Google and by email', async () => {
  const email = stranger()

  const google = await devSignIn(email)
  expect(google.status).toBe(403)
  expect((await google.json()).code).toBe('not_allowed')

  const code = await askForCode(email)
  expect(code.status).toBe(403)
  expect((await code.json()).code).toBe('not_allowed')
})

test('on, a stranger signs up with Google and by email', async () => {
  const operator = await signIn(OPERATOR)
  await switchAs(operator, true)
  try {
    const google = stranger()
    const byGoogle = await devSignIn(google)
    expect(byGoogle.status).toBe(200)

    const byEmail = stranger()
    expect((await askForCode(byEmail)).status).toBe(200)
    expect(resend.sent.some(e => e.to.includes(byEmail))).toBe(true)
  }
  finally {
    await switchAs(operator, false)
  }
})

test('off again, no new stranger signs up, but one who signed up meanwhile still signs in and uses the API', async () => {
  const operator = await signIn(OPERATOR)
  const early = stranger()
  await switchAs(operator, true)
  await signIn(early)
  await switchAs(operator, false)

  const late = await devSignIn(stranger())
  expect(late.status).toBe(403)
  expect((await late.json()).code).toBe('not_allowed')

  const back = await signIn(early)
  expect((await back.fetch('/api/me')).status).toBe(200)
  expect((await askForCode(early)).status).toBe(200)
})

test('off, the Allowlist still signs up', async () => {
  expect((await devSignIn(ALLOWLISTED[TURING]!)).status).toBe(200)
})

test('only the Operator switches it, and the Admin Page says how it stands', async () => {
  const turing = await signIn(ALLOWLISTED[TURING]!)
  expect((await switchOpenSignUp(turing, true)).status).toBe(404)
  expect((await switchOpenSignUp(anonymous(), true)).status).toBe(404)
  expect((await devSignIn(stranger())).status).toBe(403)

  const operator = await signIn(OPERATOR)
  const figures = async () => (await (await operator.fetch('/api/admin')).json()) as AdminFigures
  expect((await figures()).openSignUp).toBe(false)
  await switchAs(operator, true)
  expect((await figures()).openSignUp).toBe(true)
  await switchAs(operator, false)
  expect((await figures()).openSignUp).toBe(false)
})

test('the switch takes only true or false', async () => {
  const res = await (await signIn(OPERATOR)).fetch('/api/admin/open-sign-up', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ on: 'yes' }),
  })
  expect(res.status).toBe(400)
})

test('each switch is recorded in the event log as the Operator\'s, on no Board; switching to how it stands records nothing', async () => {
  const operator = await signIn(OPERATOR)
  const operatorId = (await (await operator.fetch('/api/me')).json()).id
  const log = await watchEvents()

  await switchAs(operator, true)
  await switchAs(operator, true)
  await switchAs(operator, false)

  expect(await log.recorded()).toEqual([
    { kind: 'open_sign_up_switched', boardId: null, dishId: null, userId: operatorId, details: { on: true } },
    { kind: 'open_sign_up_switched', boardId: null, dishId: null, userId: operatorId, details: { on: false } },
  ])
})
