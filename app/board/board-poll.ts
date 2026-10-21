// How often an open Board asks whether it changed (ADR 0008, spec #319):
// each tick is the cheap check, which answers only the server's Board
// Version, and the Board loads itself (a full sync) only when that moved
// past the one it knows. Plain timers, no Nuxt and no DOM, so it runs in
// Node under test; useBoardSync wires it to the page.

// The intervals, and after how long without activity the next one applies.
// One setting, so a change of plan (or a test) changes them in one place.
export interface PollCadence {
  // While the Member acted or a change arrived in the last `quietAfterMs`.
  activeMs: number
  quietMs: number
  // After `idleAfterMs` without either.
  idleMs: number
  quietAfterMs: number
  idleAfterMs: number
}

export const POLL_CADENCE: PollCadence = {
  activeMs: 5_000,
  quietMs: 15_000,
  idleMs: 60_000,
  quietAfterMs: 2 * 60_000,
  idleAfterMs: 10 * 60_000,
}

export interface BoardPollDeps {
  // The server's Board Version.
  check: () => Promise<number>
  // Loads the Board and merges it; false if it dropped the answer.
  sync: () => Promise<boolean>
  // The Board Version of the Board as the app shows it.
  known: () => number | undefined
  // Hidden, nothing is asked: coming back syncs anyway.
  visible: () => boolean
  cadence?: PollCadence
}

export function createBoardPoll({ check, sync, known, visible, cadence = POLL_CADENCE }: BoardPollDeps) {
  let timer: ReturnType<typeof setTimeout> | undefined
  // When the timer fires, while one is set.
  let dueAt: number | null = null
  let lastActivity = Date.now()
  let asking = false
  // A full sync asked for while something was out, to run once it is back.
  let queued = false
  // A full sync failed (offline, say): the next tick loads the Board
  // whatever its version, as the app coming back still needs that.
  let syncDue = false
  // Once the Board page is gone, a check still out schedules no other.
  let stopped = true

  function interval() {
    const quiet = Date.now() - lastActivity
    if (quiet < cadence.quietAfterMs) return cadence.activeMs
    if (quiet < cadence.idleAfterMs) return cadence.quietMs
    return cadence.idleMs
  }

  function schedule(ms = interval()) {
    clearTimeout(timer)
    dueAt = null
    if (stopped || !visible()) return
    dueAt = Date.now() + ms
    timer = setTimeout(() => ask(false), ms)
  }

  // A tick (`full` false), or a full sync whatever the version.
  async function ask(full: boolean) {
    if (asking) {
      queued ||= full
      return
    }
    asking = true
    clearTimeout(timer)
    dueAt = null
    try {
      const moved = full || (!syncDue && await check() !== known())
      // A change arrived (or the Member came back): back to the shortest interval.
      if (moved) lastActivity = Date.now()
      if (moved || syncDue) {
        syncDue = true
        await sync()
        syncDue = false
      }
    }
    catch {
      // Offline, or no longer on the Board: the next tick tries again.
    }
    finally {
      asking = false
      const next = queued
      queued = false
      if (next && !stopped && visible()) void ask(true)
      else schedule()
    }
  }

  return {
    start() {
      stopped = false
      lastActivity = Date.now()
      schedule()
    },
    stop() {
      stopped = true
      clearTimeout(timer)
      dueAt = null
    },
    // The Member did something: the next check comes within the shortest interval.
    acted() {
      lastActivity = Date.now()
      if (dueAt !== null && dueAt - Date.now() > cadence.activeMs) schedule(cadence.activeMs)
    },
    // Loads the Board now, whatever the version (the app came back to the front).
    syncNow: () => ask(true),
    // The app went to the background: nothing is asked until it is back.
    pause() {
      clearTimeout(timer)
      dueAt = null
    },
  }
}

export type BoardPoll = ReturnType<typeof createBoardPoll>
