import type { Page } from '@playwright/test'
import type { PollCadence } from '../../app/board/board-poll'

// The open Board checks its version every second, however quiet, instead of
// every 5, 15 or 60 seconds (useBoardSync's test-only setting), for the tests
// that wait for others' changes. Not for those where a check arriving early
// would pass for the refresh they check.
export const FAST_POLL_MS = 1_000

export async function fastPolls(page: Page) {
  const cadence: Partial<PollCadence> = { activeMs: FAST_POLL_MS, quietMs: FAST_POLL_MS, idleMs: FAST_POLL_MS }
  await page.addInitScript((c) => {
    (window as { e2ePollCadence?: Partial<PollCadence> }).e2ePollCadence = c
  }, cadence)
}
