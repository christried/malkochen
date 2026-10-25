import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { watchEvents } from './event-log'

// Notification Prompts (CONTEXT.md, #407): the user record keeps when each
// prompt was last shown, /api/me returns both and when the user signed up,
// and PUT /api/me/prompt marks a prompt shown or records its answer. The
// users below are used by this file only.

const LOVELACE = ALLOWLISTED[168]
const TURING = ALLOWLISTED[169]
const KNUTH = ALLOWLISTED[170]
const HOPPER = ALLOWLISTED[171]

interface Me { signedUpAt: string, pushPromptedAt: string | null, digestPromptedAt: string | null }

const me = async (caller: Caller): Promise<Me> => (await caller.fetch('/api/me')).json()
const put = (caller: Caller, body: unknown) => caller.fetch('/api/me/prompt', { method: 'PUT', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

test('a new user has a sign-up time and no prompt shown yet', async () => {
  const lovelace = await signIn(LOVELACE)
  const mine = await me(lovelace)

  expect(Date.now() - Date.parse(mine.signedUpAt)).toBeLessThan(10 * 60_000)
  expect(mine.pushPromptedAt).toBeNull()
  expect(mine.digestPromptedAt).toBeNull()
})

test('showing the digest prompt stores its time, answers Me, and records prompt_shown', async () => {
  const turing = await signIn(TURING)
  const events = await watchEvents()

  const res = await put(turing, { which: 'digest' })

  expect(res.status).toBe(200)
  const answered = await res.json() as Me
  expect(Math.abs(Date.now() - Date.parse(answered.digestPromptedAt!))).toBeLessThan(10 * 60_000)
  expect(answered.pushPromptedAt).toBeNull()
  expect(await me(turing)).toEqual(answered)
  const recorded = await events.recorded()
  expect(recorded).toEqual([expect.objectContaining({ kind: 'prompt_shown', boardId: null, details: { which: 'digest' } })])
})

test('showing the push prompt stores the push time only', async () => {
  const knuth = await signIn(KNUTH)

  const answered = await (await put(knuth, { which: 'push' })).json() as Me

  expect(answered.pushPromptedAt).not.toBeNull()
  expect(answered.digestPromptedAt).toBeNull()
})

test('an answer is recorded as prompt_answered and leaves the time alone', async () => {
  const hopper = await signIn(HOPPER)
  const shown = await (await put(hopper, { which: 'digest' })).json() as Me
  const events = await watchEvents()

  const res = await put(hopper, { which: 'digest', answer: 'later' })
  await put(hopper, { which: 'digest', answer: 'on' })

  expect(res.status).toBe(200)
  expect((await res.json() as Me).digestPromptedAt).toBe(shown.digestPromptedAt)
  expect((await events.recorded()).map(e => [e.kind, e.details])).toEqual([
    ['prompt_answered', { which: 'digest', answer: 'later' }],
    ['prompt_answered', { which: 'digest', answer: 'on' }],
  ])
})

test('anything but a prompt and an answer is a 400', async () => {
  const lovelace = await signIn(LOVELACE)

  expect((await put(lovelace, { which: 'sms' })).status).toBe(400)
  expect((await put(lovelace, { which: 'push', answer: 'maybe' })).status).toBe(400)
  expect((await put(lovelace, {})).status).toBe(400)
  expect((await lovelace.fetch('/api/me/prompt', { method: 'PUT', body: 'nope' })).status).toBe(400)
})

test('signed out, it is a 401', async () => {
  const res = await put(anonymous(), { which: 'push' })

  expect(res.status).toBe(401)
})
