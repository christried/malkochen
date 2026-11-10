import type { BoardAddress } from '../../server/utils/addresses'
import type { BoardListing, BoardView } from '../../server/utils/boards'
import type { DishHistory } from '../../server/utils/dish-history'
import type { Me } from '../../server/utils/people'
import type { DeviceStore } from '../../app/board/device-store'
import type { UnsentChange } from '../../app/board/unsent-changes'

// A copy through JSON, as IndexedDB copies on the way in and out (and as a
// reactive proxy can't be structured-cloned): a test catches a Board
// sharing an object with the store.
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

// The device store for the client tests: plain Maps, one per part, each by
// user. `broken()` makes every read and write fail quietly (storage blocked
// or cleared), as the real one does when it can't reach the database.
export function memoryStore(): DeviceStore & { broken: (on?: boolean) => void } {
  const unsent = new Map<string, UnsentChange[]>()
  let user: Me | null = null
  const boards = new Map<string, Map<string, { view: BoardView, at: number }>>()
  const listings = new Map<string, BoardListing[]>()
  const histories = new Map<string, Map<string, { boardId: string, history: DishHistory }>>()
  const addresses = new Map<string, Map<string, { boardId: string, address: BoardAddress }>>()
  const last = new Map<string, { boardId: string, slug: string }>()
  let saves = 0
  let down = false

  const of = <V>(parts: Map<string, Map<string, V>>, userId: string) => {
    if (!parts.has(userId)) parts.set(userId, new Map())
    return parts.get(userId)!
  }
  // Storage that fails answers nothing and keeps nothing.
  const reading = <T>(fallback: T, read: () => T) => Promise.resolve(down ? fallback : copy(read() ?? fallback))
  const writing = (write: () => void) => {
    if (!down) write()
    return Promise.resolve()
  }

  return {
    broken: (on = true) => {
      down = on
    },
    unsent: {
      load: userId => reading<UnsentChange[]>([], () => unsent.get(userId) ?? []),
      // Through JSON, as reactive proxies can't be structured-cloned.
      save: (userId, changes) => writing(() => unsent.set(userId, copy(changes))),
    },
    user: {
      load: () => reading<Me | null>(null, () => user),
      save: me => writing(() => {
        user = copy(me)
      }),
    },
    boards: {
      load: (userId, boardId) => reading<BoardView | null>(null, () => of(boards, userId).get(boardId)?.view ?? null),
      save: (userId, board) => writing(() => of(boards, userId).set(board.id, { view: copy(board), at: ++saves })),
      all: userId => reading<BoardView[]>([], () => [...of(boards, userId).values()].sort((a, b) => b.at - a.at).map(k => k.view)),
    },
    listings: {
      load: userId => reading<BoardListing[] | null>(null, () => listings.get(userId) ?? null),
      save: (userId, list) => writing(() => listings.set(userId, copy(list))),
    },
    histories: {
      load: (userId, dishId) => reading<DishHistory | null>(null, () => of(histories, userId).get(dishId)?.history ?? null),
      save: (userId, boardId, dishId, history) => writing(() => of(histories, userId).set(dishId, { boardId, history: copy(history) })),
    },
    addresses: {
      load: (userId, asked, dish) => reading<BoardAddress | null>(null, () => of(addresses, userId).get(`${asked}\0${dish}`)?.address ?? null),
      save: (userId, asked, dish, address) => writing(() => of(addresses, userId).set(`${asked}\0${dish}`, { boardId: address.boardId, address: copy(address) })),
    },
    last: {
      load: userId => reading<{ boardId: string, slug: string } | null>(null, () => last.get(userId) ?? null),
      save: (userId, value) => writing(() => last.set(userId, copy(value))),
    },
    removeBoard: (userId, boardId) => writing(() => {
      of(boards, userId).delete(boardId)
      for (const part of [of(histories, userId), of(addresses, userId)]) {
        for (const [key, kept] of part) if (kept.boardId === boardId) part.delete(key)
      }
      if (last.get(userId)?.boardId === boardId) last.delete(userId)
    }),
    forgetUser: userId => writing(() => {
      boards.delete(userId)
      listings.delete(userId)
      histories.delete(userId)
      addresses.delete(userId)
      last.delete(userId)
    }),
    clear: () => writing(() => {
      unsent.clear()
      user = null
      boards.clear()
      listings.clear()
      histories.clear()
      addresses.clear()
      last.clear()
    }),
  }
}
