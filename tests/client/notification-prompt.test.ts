import { expect, test } from 'vitest'
import { duePrompt, PROMPT_AFTER_SIGN_UP_MS, PROMPT_APART_MS, PROMPT_EVERY_MS, type PromptSituation } from '../../app/utils/notification-prompt'

// Notification Prompts (CONTEXT.md, #407): which prompt, if any, to show now.

const NOW = Date.UTC(2026, 9, 25, 12)
const HOUR = 3_600_000
const DAY = 24 * HOUR

// Everything due: signed up long ago, installed, push off, digest off.
function due(over: Partial<PromptSituation> = {}): PromptSituation {
  return {
    now: NOW,
    signedUpAt: NOW - 10 * DAY,
    pushPromptedAt: null,
    digestPromptedAt: null,
    push: { offered: true, installed: true, state: 'off', permission: 'default' },
    digest: { offered: true, on: false },
    shownThisVisit: false,
    ...over,
  }
}
const noPush: PromptSituation['push'] = { offered: true, installed: true, state: 'on', permission: 'granted' }
const noDigest: PromptSituation['digest'] = { offered: true, on: true }

test('both due: push comes first', () => {
  expect(duePrompt(due())).toBe('push')
})

test('nothing in the first 24 hours after sign-up, then it may', () => {
  expect(PROMPT_AFTER_SIGN_UP_MS).toBe(24 * HOUR)
  expect(duePrompt(due({ signedUpAt: NOW - 24 * HOUR + 1 }))).toBeNull()
  expect(duePrompt(due({ signedUpAt: NOW - 24 * HOUR }))).toBe('push')
})

test('nothing in a visit where the Tour, the Changelog Popup or a prompt showed', () => {
  expect(duePrompt(due({ shownThisVisit: true }))).toBeNull()
})

test('push only installed', () => {
  expect(duePrompt(due({ push: { offered: true, installed: false, state: 'off', permission: 'default' } }))).toBe('digest')
})

test('push only when off on this device: on, blocked, unsupported and unknown are not', () => {
  for (const state of ['on', 'blocked', 'unsupported', null] as const) {
    expect(duePrompt(due({ push: { offered: true, installed: true, state, permission: 'default' } }))).toBe('digest')
  }
})

test('push not when the permission is denied', () => {
  expect(duePrompt(due({ push: { offered: true, installed: true, state: 'off', permission: 'denied' } }))).toBe('digest')
})

test('push not when the server does not offer it', () => {
  expect(duePrompt(due({ push: { offered: false, installed: true, state: 'off', permission: 'default' } }))).toBe('digest')
})

test('digest only while off: on and unknown are not due', () => {
  expect(duePrompt(due({ push: noPush, digest: { offered: true, on: true } }))).toBeNull()
  expect(duePrompt(due({ push: noPush, digest: { offered: true, on: null } }))).toBeNull()
  expect(duePrompt(due({ push: noPush, digest: { offered: true, on: false } }))).toBe('digest')
})

test('digest not when the server does not offer it', () => {
  expect(duePrompt(due({ push: noPush, digest: { offered: false, on: false } }))).toBeNull()
})

test('digest does not need the app installed', () => {
  expect(duePrompt(due({ push: { offered: true, installed: false, state: 'off', permission: 'default' } }))).toBe('digest')
})

test('each prompt at most once every 30 days', () => {
  expect(PROMPT_EVERY_MS).toBe(30 * DAY)
  expect(duePrompt(due({ pushPromptedAt: NOW - 30 * DAY + 1, digest: noDigest }))).toBeNull()
  expect(duePrompt(due({ pushPromptedAt: NOW - 30 * DAY, digest: noDigest }))).toBe('push')
  expect(duePrompt(due({ digestPromptedAt: NOW - 30 * DAY + 1, push: noPush }))).toBeNull()
  expect(duePrompt(due({ digestPromptedAt: NOW - 30 * DAY, push: noPush }))).toBe('digest')
})

test('never within 48 hours of the other', () => {
  expect(PROMPT_APART_MS).toBe(48 * HOUR)
  // Push was shown a day ago: the digest waits, and the push itself is 30 days away.
  expect(duePrompt(due({ pushPromptedAt: NOW - DAY }))).toBeNull()
  expect(duePrompt(due({ pushPromptedAt: NOW - 48 * HOUR }))).toBe('digest')
  // The digest was shown a day ago: the push waits.
  expect(duePrompt(due({ digestPromptedAt: NOW - DAY }))).toBeNull()
  expect(duePrompt(due({ digestPromptedAt: NOW - 48 * HOUR }))).toBe('push')
})

test('push shown three days ago leaves the digest due, and the other way round', () => {
  expect(duePrompt(due({ pushPromptedAt: NOW - 3 * DAY }))).toBe('digest')
  expect(duePrompt(due({ digestPromptedAt: NOW - 3 * DAY }))).toBe('push')
})
