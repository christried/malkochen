import type { BoardModule } from '~/board/board-module'
import { createBoardPoll, POLL_CADENCE, type BoardPoll, type PollCadence } from '~/board/board-poll'
import type { BoardView } from '~~/server/utils/boards'

// Coming back to the app after this long counts as opening the Board again,
// which moves on what is marked "Neu".
const REOPEN_AFTER_MS = 30 * 60_000

// Sync between Members (PRD story 38, ADR 0008): while the Board is
// visible, it asks every few seconds whether its Board Version moved
// (board-poll.ts sets how often), and loads itself only when it did, and at
// once when the app comes back to the front. No live connection. Each load
// goes through the Board's module (sync), which merges what the server
// answers, or drops it while `paused` (a Dish is being dragged) or if one of
// its writes was under way meanwhile; the next check brings it.
export function useBoardSync(boardId: () => string, boardModule: BoardModule, paused: () => boolean) {
  const visit = useVisit()
  let hiddenSince: number | null = null
  // The user came back after long enough away to reopen the Board, and it
  // hasn't been reopened yet: the next sync does that before it loads. Kept
  // until the reopen succeeds, as a phone coming back may still be offline.
  let reopenDue = false
  // A browser test that waits for polls may shorten the cadence on its page
  // (tests/e2e/polls.ts); anywhere but the tests' server, it can't.
  const e2e = useRuntimeConfig().public.e2e
  const cadence = (): PollCadence => ({ ...POLL_CADENCE, ...(e2e && (window as { e2ePollCadence?: Partial<PollCadence> }).e2ePollCadence) })

  // Only from the client: the poll starts on mount.
  let poll: BoardPoll | undefined

  async function sync() {
    const id = boardId()
    if (reopenDue) {
      await $fetch(`/api/boards/${id}/open`, { method: 'POST' })
      reopenDue = false
    }
    // Loading also records what the user has seen (so it isn't "Neu" next time).
    return boardModule.sync(() => $fetch<BoardView>(`/api/boards/${id}/seen`, { method: 'POST' }), { paused })
  }

  // The app coming back to the front, told by visibilitychange or focus,
  // whichever comes first (a phone may send either first). The first one
  // back decides whether this reopens the Board, before anything is loaded:
  // a load before the reopen would record the Board as seen up to now, and
  // the reopen would then take every Dish added while away off what is "Neu".
  function comeBack() {
    if (hiddenSince !== null && Date.now() - hiddenSince >= REOPEN_AFTER_MS) {
      reopenDue = true
      // A new visit (useVisit): what was shown in the last may show again.
      visit.nextVisit()
    }
    hiddenSince = null
    void poll?.syncNow()
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      hiddenSince = Date.now()
      poll?.pause()
      return
    }
    comeBack()
  }
  // Also a desktop window coming back to the front, while it was visible
  // all along. Focus while still hidden isn't the user coming back.
  function onFocus() {
    if (document.visibilityState === 'visible') comeBack()
  }
  // The Member doing something on the Board keeps the checks frequent.
  function onActivity() {
    poll?.acted()
  }
  const activity = ['pointerdown', 'keydown', 'wheel'] as const

  onMounted(() => {
    poll = createBoardPoll({
      check: async () => (await $fetch<{ version: number }>(`/api/boards/${boardId()}/version`)).version,
      sync,
      known: boardModule.version,
      visible: () => document.visibilityState === 'visible',
      cadence: cadence(),
    })
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    for (const type of activity) window.addEventListener(type, onActivity, { capture: true, passive: true })
    poll.start()
  })
  onBeforeUnmount(() => {
    poll?.stop()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onFocus)
    for (const type of activity) window.removeEventListener(type, onActivity, { capture: true })
  })
}
