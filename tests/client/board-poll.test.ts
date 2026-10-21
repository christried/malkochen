import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { createBoardPoll } from '../../app/board/board-poll'

// Seam 4: how often an open Board asks whether it changed (ADR 0008), with
// fake timers. The cheap check answers the server's Board Version; a full
// sync merges the Board, or drops it (a write under way, a paused drag).
// The tests look at what was asked, and when.

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

const SECOND = 1_000
const MINUTE = 60 * SECOND

function setup() {
  // The Board Version on the server, and the one the Board knows.
  const server = { version: 0 }
  let known = 0
  const asked: string[] = []
  // Whether the next full syncs merge what they bring.
  let merges = true
  // Whether the next full syncs fail, as offline.
  let fails = false
  const poll = createBoardPoll({
    check: async () => {
      asked.push('check')
      return server.version
    },
    sync: async () => {
      asked.push('sync')
      if (fails) throw new Error('Offline')
      if (merges) known = server.version
      return merges
    },
    known: () => known,
    visible: () => true,
  })
  return {
    server,
    poll,
    asked,
    dropSyncs: (drop: boolean) => (merges = !drop),
    failSyncs: (fail: boolean) => (fails = fail),
    // What was asked during the next `ms`, and nothing before.
    async during(ms: number) {
      asked.length = 0
      await vi.advanceTimersByTimeAsync(ms)
      return [...asked]
    },
  }
}

test('an open Board checks its version every 5 seconds, and loads itself only when the version moved', async () => {
  const { server, poll, during } = setup()
  poll.start()

  expect(await during(4.9 * SECOND)).toEqual([])
  expect(await during(0.1 * SECOND)).toEqual(['check'])
  expect(await during(5 * SECOND)).toEqual(['check'])

  server.version = 1
  expect(await during(5 * SECOND)).toEqual(['check', 'sync'])
  expect(await during(5 * SECOND)).toEqual(['check'])
  poll.stop()
})

test('after 2 quiet minutes it checks every 15 seconds, after 10 every 60, and every 5 again once the Member acts', async () => {
  const { poll, during } = setup()
  poll.start()

  await vi.advanceTimersByTimeAsync(2 * MINUTE)
  expect(await during(14.9 * SECOND)).toEqual([])
  expect(await during(0.1 * SECOND)).toEqual(['check'])

  await vi.advanceTimersByTimeAsync(10 * MINUTE - 2 * MINUTE - 15 * SECOND)
  expect(await during(59.9 * SECOND)).toEqual([])
  expect(await during(0.1 * SECOND)).toEqual(['check'])

  // Halfway to the next check, the Member taps: it comes within 5 seconds.
  await vi.advanceTimersByTimeAsync(30 * SECOND)
  poll.acted()
  expect(await during(5 * SECOND)).toEqual(['check'])
  expect(await during(5 * SECOND)).toEqual(['check'])
  poll.stop()
})

test('a change arriving while quiet brings it back to every 5 seconds', async () => {
  const { server, poll, during } = setup()
  poll.start()
  await vi.advanceTimersByTimeAsync(10 * MINUTE)
  expect(await during(60 * SECOND)).toEqual(['check'])

  server.version = 1
  expect(await during(60 * SECOND)).toEqual(['check', 'sync'])
  expect(await during(5 * SECOND)).toEqual(['check'])
  poll.stop()
})

test('a dropped answer leaves the version where it was, so the next check loads the Board again', async () => {
  const { server, poll, during, dropSyncs } = setup()
  poll.start()
  server.version = 1

  dropSyncs(true)
  expect(await during(5 * SECOND)).toEqual(['check', 'sync'])
  dropSyncs(false)
  expect(await during(5 * SECOND)).toEqual(['check', 'sync'])
  expect(await during(5 * SECOND)).toEqual(['check'])
  poll.stop()
})

test('coming back loads the Board at once, whatever the version, and checks every 5 seconds from there', async () => {
  const { poll, asked, during } = setup()
  poll.start()
  await vi.advanceTimersByTimeAsync(10 * MINUTE)
  poll.pause()
  expect(await during(10 * MINUTE)).toEqual([])

  asked.length = 0
  await poll.syncNow()
  expect(asked).toEqual(['sync'])
  expect(await during(5 * SECOND)).toEqual(['check'])
  poll.stop()
})

test('a stopped poll asks nothing more', async () => {
  const { poll, during } = setup()
  poll.start()
  await vi.advanceTimersByTimeAsync(4.9 * SECOND)
  poll.stop()
  expect(await during(MINUTE)).toEqual([])
})

test('a load that failed (offline on coming back) is tried again at the next tick, though the version didn’t move', async () => {
  const { poll, asked, during, failSyncs } = setup()
  poll.start()
  failSyncs(true)
  asked.length = 0
  await poll.syncNow()
  expect(asked).toEqual(['sync'])

  expect(await during(5 * SECOND)).toEqual(['sync'])
  failSyncs(false)
  expect(await during(5 * SECOND)).toEqual(['sync'])
  expect(await during(5 * SECOND)).toEqual(['check'])
  poll.stop()
})
