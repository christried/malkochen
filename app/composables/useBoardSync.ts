import type { BoardModule } from '~/board/board-module'
import type { BoardView } from '~~/server/utils/boards'

// How often an open Board asks for others' changes.
const POLL_MS = 5_000
// Coming back to the app after this long counts as opening the Board again,
// which moves on what is marked "Neu".
const REOPEN_AFTER_MS = 30 * 60_000

// Sync between Members (PRD story 38): while the Board is visible, others'
// changes show up within a few seconds by polling, and at once when the app
// comes back to the front. No live connection. Each poll goes through the
// Board's module (sync), which merges what the server answers, or drops it
// while `paused` (a Dish is being dragged) or if one of its writes was
// under way meanwhile; the next poll brings it.
export function useBoardSync(boardId: () => string, boardModule: BoardModule, paused: () => boolean) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let asking = false
  // A sync asked for while a poll was out, to run once it is back.
  let queued: { reopen: boolean } | null = null
  let hiddenSince: number | null = null
  // Once the Board page is gone, a poll still out schedules no other.
  let stopped = false

  async function sync({ reopen = false } = {}) {
    if (asking) {
      queued = { reopen: reopen || (queued?.reopen ?? false) }
      return
    }
    asking = true
    clearTimeout(timer)
    const id = boardId()
    try {
      if (reopen) await $fetch(`/api/boards/${id}/open`, { method: 'POST' })
      // Polling also records what the user has seen (so it isn't "Neu" next time).
      await boardModule.sync(() => $fetch<BoardView>(`/api/boards/${id}/seen`, { method: 'POST' }), { paused })
    }
    catch {
      // Offline, or no longer on the Board: the next poll tries again.
    }
    finally {
      asking = false
      const next = queued
      queued = null
      if (next && !stopped) sync(next)
      else schedule()
    }
  }

  function schedule() {
    clearTimeout(timer)
    if (!stopped && document.visibilityState === 'visible') timer = setTimeout(() => sync(), POLL_MS)
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      hiddenSince = Date.now()
      clearTimeout(timer)
      return
    }
    const reopen = hiddenSince !== null && Date.now() - hiddenSince >= REOPEN_AFTER_MS
    hiddenSince = null
    sync({ reopen })
  }
  // A desktop window coming back to the front, while it was visible all along.
  function onFocus() {
    sync()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('focus', onFocus)
    schedule()
  })
  onBeforeUnmount(() => {
    stopped = true
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('focus', onFocus)
    clearTimeout(timer)
  })
}
