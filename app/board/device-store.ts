// Relative imports, not `~~`: runs in plain Node under test, like the Board
// module.
import type { BoardAddress } from '../../server/utils/addresses'
import type { BoardListing, BoardView } from '../../server/utils/boards'
import type { DishHistory } from '../../server/utils/dish-history'
import type { Me } from '../../server/utils/people'
import type { BoardSpot } from '../../shared/board'
import { plainCopy } from './plain-copy'
import type { UnsentChange } from './unsent-changes'

// What the app keeps on the device for the signed-in user (CONTEXT.md: Unsent
// Change; ADR 0012; spec #456), so it outlives closing the app and
// restarting the phone, and opens without a connection. Narrow and async,
// one part per kind of thing kept, each by the user's id: nothing of one
// user is ever answered to another. Every read and write is safe: storage
// that is missing, blocked or cleared answers nothing and keeps nothing, and
// the app works online without it.
export interface DeviceStore {
  unsent: {
    // The user's Unsent Changes, in the order they were made.
    load: (userId: string) => Promise<UnsentChange[]>
    // Replaces them all with `changes`.
    save: (userId: string, changes: UnsentChange[]) => Promise<void>
    // The users the device holds Unsent Changes of (at least one), each with
    // how many: to tell when another user signed in (#463).
    holders: () => Promise<{ userId: string, count: number }[]>
    // Drops one user's Unsent Changes (their go-ahead to lose them).
    discard: (userId: string) => Promise<void>
  }
  // Who the device's data belongs to: /api/me as last answered, so the app
  // knows the user without a connection.
  user: {
    load: () => Promise<Me | null>
    save: (me: Me) => Promise<void>
  }
  // The Boards opened here, each as last loaded (its Permissions for the
  // user come with it).
  boards: {
    load: (userId: string, boardId: string) => Promise<BoardView | null>
    save: (userId: string, board: BoardView) => Promise<void>
    // All of them, the one saved last first.
    all: (userId: string) => Promise<BoardView[]>
  }
  // The Board Switcher's list as last fetched.
  listings: {
    load: (userId: string) => Promise<BoardListing[] | null>
    save: (userId: string, listings: BoardListing[]) => Promise<void>
  }
  // The Dish History of each Dish opened here; `boardId` is the Board it was
  // on, to remove it with the Board.
  histories: {
    load: (userId: string, dishId: string) => Promise<DishHistory | null>
    save: (userId: string, boardId: string, dishId: string, history: DishHistory) => Promise<void>
  }
  // Where an address asked (`/b/<asked>`, and a Dish's part, '' for none) led
  // when it was last resolved, to open it without the server.
  addresses: {
    load: (userId: string, asked: string, dish: string) => Promise<BoardAddress | null>
    save: (userId: string, asked: string, dish: string, address: BoardAddress) => Promise<void>
  }
  // The Board used last, which the app opens on.
  last: {
    load: (userId: string) => Promise<BoardSpot | null>
    save: (userId: string, last: BoardSpot) => Promise<void>
  }
  // A Board no longer the user's: it, its Dish Histories and addresses go.
  removeBoard: (userId: string, boardId: string) => Promise<void>
  // Everything of the user's but their Unsent Changes (another user signed
  // in on the device).
  forgetUser: (userId: string) => Promise<void>
  // Everything, Unsent Changes included (signing out, deleting the account);
  // `keepUnsent` for all but the Unsent Changes (signing out again to let
  // another user send theirs, #463).
  clear: (options?: { keepUnsent?: boolean }) => Promise<void>
}

const DB_NAME = 'malkochen'
// 2: the parts besides `unsent` (#461). The upgrade adds their stores and
// leaves `unsent` and what it holds as it is.
const DB_VERSION = 2
// One object store per part, each keyed by the user's id, and for parts of
// many, by the user's id, a NUL and the item's.
const STORES = ['unsent', 'user', 'boards', 'listings', 'histories', 'addresses', 'last'] as const
type StoreName = typeof STORES[number]
const DEVICE = 'device'
const SEP = '\u0000'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      for (const name of STORES) {
        if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('blocked'))
  })
}

// Runs `use` on a transaction over `names`; resolves once it is complete.
async function inTransaction<T>(names: StoreName[], mode: IDBTransactionMode, use: (stores: Record<string, IDBObjectStore>) => Promise<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(names, mode)
      const stores = Object.fromEntries(names.map(name => [name, transaction.objectStore(name)]))
      let result: T
      use(stores).then((value) => {
        result = value
      }, reject)
      transaction.oncomplete = () => resolve(result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
  finally {
    db.close()
  }
}

const asPromise = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

// All of one user's items in a store, as key and value.
async function itemsOf(store: IDBObjectStore, userId: string): Promise<{ key: string, value: unknown }[]> {
  // From the user's id and the NUL up to (not including) the user's id and
  // the character after the NUL: everything of theirs, nothing of another's.
  const range = IDBKeyRange.bound(`${userId}${SEP}`, `${userId}\u0001`, false, true)
  const [keys, values] = await Promise.all([asPromise(store.getAllKeys(range)), asPromise(store.getAll(range))])
  return keys.map((key, i) => ({ key: String(key), value: values[i] }))
}

// Nothing it does throws: `fallback` stands in for what couldn't be read or
// written.
async function safely<T>(fallback: T, work: () => Promise<T>): Promise<T> {
  try {
    return await work()
  }
  catch {
    return fallback
  }
}

async function read<T>(name: StoreName, key: string): Promise<T | null> {
  return safely<T | null>(null, () => inTransaction([name], 'readonly', async stores => (await asPromise(stores[name]!.get(key)) as T | undefined) ?? null))
}

async function write(name: StoreName, key: string, value: unknown): Promise<void> {
  // Nowhere to keep it: it lives in memory until the app closes.
  await safely(undefined, () => inTransaction([name], 'readwrite', async (stores) => {
    await asPromise(stores[name]!.put(plainCopy(value), key))
  }))
}

// The app's store: raw IndexedDB, database `malkochen`.
export function indexedDbStore(): DeviceStore {
  const item = (userId: string, id: string) => `${userId}${SEP}${id}`
  type Kept<V> = { boardId?: string, value: V, savedAt?: number }

  return {
    unsent: {
      async load(userId) {
        const found = await read<UnsentChange[]>('unsent', userId)
        return Array.isArray(found) ? found : []
      },
      save: (userId, changes) => write('unsent', userId, changes),
      holders: () => safely<{ userId: string, count: number }[]>([], () => inTransaction(['unsent'], 'readonly', async (stores) => {
        const [keys, values] = await Promise.all([asPromise(stores.unsent!.getAllKeys()), asPromise(stores.unsent!.getAll())])
        return keys.flatMap((key, i) => Array.isArray(values[i]) && values[i].length > 0 ? [{ userId: String(key), count: values[i].length as number }] : [])
      })),
      discard: userId => safely(undefined, () => inTransaction(['unsent'], 'readwrite', async (stores) => {
        stores.unsent!.delete(userId)
      })),
    },
    user: {
      load: () => read<Me>('user', DEVICE),
      save: me => write('user', DEVICE, me),
    },
    boards: {
      async load(userId, boardId) {
        return (await read<Kept<BoardView>>('boards', item(userId, boardId)))?.value ?? null
      },
      save: (userId, board) => write('boards', item(userId, board.id), { value: board, savedAt: Date.now() } satisfies Kept<BoardView>),
      all: userId => safely<BoardView[]>([], () => inTransaction(['boards'], 'readonly', async (stores) => {
        const kept = (await itemsOf(stores.boards!, userId)).map(i => i.value as Kept<BoardView>)
        return kept.sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0)).map(k => k.value)
      })),
    },
    listings: {
      load: userId => read<BoardListing[]>('listings', userId),
      save: (userId, listings) => write('listings', userId, listings),
    },
    histories: {
      async load(userId, dishId) {
        return (await read<Kept<DishHistory>>('histories', item(userId, dishId)))?.value ?? null
      },
      save: (userId, boardId, dishId, history) => write('histories', item(userId, dishId), { boardId, value: history } satisfies Kept<DishHistory>),
    },
    addresses: {
      async load(userId, asked, dish) {
        return (await read<Kept<BoardAddress>>('addresses', item(userId, `${asked}${SEP}${dish}`)))?.value ?? null
      },
      save: (userId, asked, dish, address) => write('addresses', item(userId, `${asked}${SEP}${dish}`), { boardId: address.boardId, value: address } satisfies Kept<BoardAddress>),
    },
    last: {
      load: userId => read<BoardSpot>('last', userId),
      save: (userId, last) => write('last', userId, last),
    },
    removeBoard: (userId, boardId) => safely(undefined, () => inTransaction(['boards', 'histories', 'addresses', 'last'], 'readwrite', async (stores) => {
      stores.boards!.delete(item(userId, boardId))
      for (const name of ['histories', 'addresses'] as const) {
        for (const { key, value } of await itemsOf(stores[name]!, userId)) {
          if ((value as Kept<unknown>).boardId === boardId) stores[name]!.delete(key)
        }
      }
      const last = await asPromise(stores.last!.get(userId)) as { boardId: string } | undefined
      if (last?.boardId === boardId) stores.last!.delete(userId)
    })),
    forgetUser: userId => safely(undefined, () => inTransaction(['boards', 'listings', 'histories', 'addresses', 'last'], 'readwrite', async (stores) => {
      for (const name of ['boards', 'histories', 'addresses'] as const) {
        for (const { key } of await itemsOf(stores[name]!, userId)) stores[name]!.delete(key)
      }
      stores.listings!.delete(userId)
      stores.last!.delete(userId)
    })),
    clear: options => safely(undefined, () => inTransaction([...STORES], 'readwrite', async (stores) => {
      for (const name of STORES) if (!(options?.keepUnsent && name === 'unsent')) stores[name]!.clear()
    })),
  }
}
