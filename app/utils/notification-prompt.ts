import type { PushState } from './push-switch'

// Notification Prompts (CONTEXT.md, #407): Topfbert's card on the Board that
// offers Push Notifications or the Email Digest. This is the rule for which
// one, if any, to show now; the Board gathers the situation.

export const PROMPT_EVERY_MS = 30 * 24 * 3_600_000
export const PROMPT_APART_MS = 48 * 3_600_000
export const PROMPT_AFTER_SIGN_UP_MS = 24 * 3_600_000

export type PromptKind = 'push' | 'digest'

export interface PromptSituation {
  now: number
  // When the user signed up, and when each prompt was last shown (null: never).
  signedUpAt: number
  pushPromptedAt: number | null
  digestPromptedAt: number | null
  push: {
    // The server sends Push Notifications at all.
    offered: boolean
    // malkochen runs installed (Android), not in a browser tab.
    installed: boolean
    // This device's switch; null until known.
    state: PushState | null
    permission: NotificationPermission | null
  }
  digest: {
    offered: boolean
    // The Email Digest switch; null until known.
    on: boolean | null
  }
  // The Tour, the Changelog Popup or a prompt showed in this visit.
  shownThisVisit: boolean
}

const within = (now: number, at: number | null, ms: number) => at !== null && now - at < ms

// Push first when both are due. Unknown states are never due.
export function duePrompt(s: PromptSituation): PromptKind | null {
  if (s.shownThisVisit || s.now - s.signedUpAt < PROMPT_AFTER_SIGN_UP_MS) return null
  const pushDue = s.push.offered && s.push.installed && s.push.state === 'off' && s.push.permission !== 'denied'
    && !within(s.now, s.pushPromptedAt, PROMPT_EVERY_MS) && !within(s.now, s.digestPromptedAt, PROMPT_APART_MS)
  if (pushDue) return 'push'
  const digestDue = s.digest.offered && s.digest.on === false
    && !within(s.now, s.digestPromptedAt, PROMPT_EVERY_MS) && !within(s.now, s.pushPromptedAt, PROMPT_APART_MS)
  return digestDue ? 'digest' : null
}
