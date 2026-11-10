// Relative imports, not `~~`: runs in plain Node under test, like the Board
// module.
import type { BoardAddress } from '../../server/utils/addresses'
import type { BoardListing, BoardView } from '../../server/utils/boards'
import type { DishHistory } from '../../server/utils/dish-history'
import { deviceOwner } from './device-owner'
import type { DeviceStore } from './device-store'
import { plainCopy } from './plain-copy'

// What the device keeps of one signed-in user's Boards (spec #456, ticket
// #461), over the device store: each Board opened here as last loaded, the
// Board Switcher's list, the Dish History of each Dish opened, and the
// addresses that led to them. It is what the app opens from when malkochen
// doesn't answer. Plain data in and out, no Nuxt and no DOM, so it runs in
// Node under test. Nothing here throws: the store tolerates missing storage.

// A Board on the device is kept as the server last said it: Unsent Changes
// are not in it (they are laid over when it is shown), so one that is
// dropped on arrival can't stay behind in the kept copy.
export interface KeptBoards {
  // The Board opened or loaded: kept, and the one the app starts on next.
  opened: (view: BoardView) => Promise<void>
  // The Board loaded again (a sync): kept, nothing else changes.
  keep: (view: BoardView) => Promise<void>
  board: (boardId: string) => Promise<BoardView | null>
  // The Board Switcher's list as fetched: kept, and a Board kept here that
  // isn't on it any more (left, removed from, archived, deleted) is removed.
  keepListings: (listings: BoardListing[]) => Promise<void>
  // The kept list, of the Boards that are kept here.
  listings: () => Promise<BoardListing[]>
  keepHistory: (boardId: string, dishId: string, history: DishHistory) => Promise<void>
  history: (dishId: string) => Promise<DishHistory | null>
  keepAddress: (asked: string, dish: string | undefined, address: BoardAddress) => Promise<void>
  // Where an address leads, from what was kept; null for a Board never
  // opened here.
  address: (asked: string, dish: string | undefined) => Promise<BoardAddress | null>
  // Where the app opens: the Board used last (else the one kept last).
  landing: () => Promise<{ boardId: string, slug: string } | null>
  // Where something shared opens: the Board used last that the user may add
  // Dishes to, `canAdd` false if they may add to none (then the Board used
  // last).
  landingToAdd: () => Promise<{ boardId: string, slug: string, canAdd: boolean } | null>
  // A Board the server says is gone: it, its Dish Histories and addresses.
  remove: (boardId: string) => Promise<void>
  // Whatever is kept for an address that the server says isn't there.
  removeAddress: (asked: string) => Promise<void>
  // The user signed out or the device was cleared: whatever is still being
  // kept is not written any more.
  close: () => void
}

export function createKeptBoards({ store, userId }: { store: DeviceStore, userId: string }): KeptBoards {
  // Writes go through here: nothing is written once the device is signed out
  // or belongs to someone else (a tab that stayed open, a keep still under way).
  const owner = deviceOwner(store, userId)
  let closed = false
  async function writing(write: () => Promise<void>) {
    if (closed || !await owner.mine() || closed) return
    await write()
  }

  // Copied before anything is awaited: the caller goes on changing what it passed.
  function keep(view: BoardView) {
    const copy = plainCopy(view)
    return writing(() => store.boards.save(userId, copy))
  }

  async function opened(view: BoardView) {
    const copy = plainCopy(view)
    await writing(async () => {
      await store.boards.save(userId, copy)
      await store.last.save(userId, { boardId: view.id, slug: view.slug })
    })
  }

  // The kept Boards that `asked` (a slug, current or former, or an id) leads
  // to: found by their current slug or id, or by an address kept for it.
  async function boardAsked(asked: string): Promise<BoardView | null> {
    const kept = await store.boards.all(userId)
    const lower = asked.toLowerCase()
    return kept.find(b => b.id === asked || b.slug.toLowerCase() === lower) ?? null
  }

  async function address(asked: string, dish: string | undefined) {
    const known = await store.addresses.load(userId, asked, dish ?? '')
    if (known && await store.boards.load(userId, known.boardId)) return known
    const view = await boardAsked(asked)
    if (!view) return null
    // A Dish's part as it was asked: offline there is no forwarding to its
    // current title (the Dish page finds the Dish by its code). Not looked up
    // with shared/address.ts here, which the app's build would then pull in
    // from a relative path it can't resolve.
    return { boardId: view.id, slug: view.slug, dish: dish ?? null }
  }

  async function landing() {
    const last = await store.last.load(userId)
    if (last && await store.boards.load(userId, last.boardId)) return last
    const [latest] = await store.boards.all(userId)
    return latest ? { boardId: latest.id, slug: latest.slug } : null
  }

  async function landingToAdd() {
    const last = await store.last.load(userId)
    const kept = await store.boards.all(userId)
    const ordered = [...kept.filter(b => b.id === last?.boardId), ...kept.filter(b => b.id !== last?.boardId)]
    const found = ordered.find(b => b.permissions.addDishes)
    if (found) return { boardId: found.id, slug: found.slug, canAdd: true }
    const [first] = ordered
    return first ? { boardId: first.id, slug: first.slug, canAdd: false } : null
  }

  async function listings() {
    const kept = new Set((await store.boards.all(userId)).map(b => b.id))
    return (await store.listings.load(userId) ?? []).filter(b => kept.has(b.id))
  }

  function keepListings(listed: BoardListing[]) {
    const list = plainCopy(listed)
    return writing(async () => {
    await store.listings.save(userId, list)
    const there = new Set(list.map(b => b.id))
    for (const kept of await store.boards.all(userId)) {
      if (!there.has(kept.id)) await store.removeBoard(userId, kept.id)
    }
    })
  }

  return {
    opened,
    keep,
    board: boardId => store.boards.load(userId, boardId),
    keepListings,
    listings,
    keepHistory: (boardId, dishId, history) => {
      const copy = plainCopy(history)
      return writing(() => store.histories.save(userId, boardId, dishId, copy))
    },
    history: dishId => store.histories.load(userId, dishId),
    keepAddress: (asked, dish, found) => writing(() => store.addresses.save(userId, asked, dish ?? '', found)),
    address,
    landing,
    landingToAdd,
    close: () => {
      closed = true
    },
    remove: boardId => store.removeBoard(userId, boardId),
    removeAddress: async (asked) => {
      const known = await store.addresses.load(userId, asked, '')
      const view = known ? { id: known.boardId } : await boardAsked(asked)
      if (view) await store.removeBoard(userId, view.id)
    },
  }
}

// Whether a failed request got no answer from malkochen: no response at all,
// or Vercel's own error page (a 5xx with x-vercel-error), as the connection
// plugin and the service worker count it. What `$fetch` rejects with.
export function gotNoAnswer(error: unknown): boolean {
  const { statusCode, status, response } = (error ?? {}) as { statusCode?: number, status?: number, response?: { status?: number, headers?: Headers } }
  const code = statusCode ?? response?.status ?? status
  if (code === undefined) return true
  return code >= 500 && !!response?.headers?.has('x-vercel-error')
}

// Whether malkochen answered that the Board isn't the user's (any more): they
// left it, were removed from it, or it was archived or deleted.
export function boardIsGone(error: unknown): boolean {
  const { statusCode, response } = (error ?? {}) as { statusCode?: number, response?: { status?: number } }
  const code = statusCode ?? response?.status
  return code === 403 || code === 404 || code === 410
}
