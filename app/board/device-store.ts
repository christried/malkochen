import type { UnsentChange } from './unsent-changes'

// What the app keeps on the device for the signed-in user (CONTEXT.md: Unsent
// Change; ADR 0012), so it outlives closing the app and restarting the
// phone. Narrow and async, one part per kind of thing kept; later tickets
// add kept Boards, histories and a clear for signing out. Every read and
// write is safe: storage that is missing, blocked or cleared answers nothing
// and keeps nothing, and the app works online without it.
export interface DeviceStore {
  unsent: {
    // The user's Unsent Changes, in the order they were made.
    load: (userId: string) => Promise<UnsentChange[]>
    // Replaces them all with `changes`.
    save: (userId: string, changes: UnsentChange[]) => Promise<void>
  }
}

const DB_NAME = 'malkochen'
const DB_VERSION = 1
// One object store per part; each keyed by the user's id.
const UNSENT = 'unsent'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(UNSENT)) request.result.createObjectStore(UNSENT)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('blocked'))
  })
}

// Runs `use` on the object store in a transaction; resolves once it is done.
async function inStore<T>(mode: IDBTransactionMode, use: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(UNSENT, mode)
      const request = use(transaction.objectStore(UNSENT))
      transaction.oncomplete = () => resolve(request.result)
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  }
  finally {
    db.close()
  }
}

// The app's store: raw IndexedDB, database `malkochen`. Nothing it does
// throws.
export function indexedDbStore(): DeviceStore {
  return {
    unsent: {
      async load(userId) {
        try {
          const found = await inStore('readonly', store => store.get(userId))
          return Array.isArray(found) ? found as UnsentChange[] : []
        }
        catch {
          return []
        }
      },
      async save(userId, changes) {
        try {
          // A plain copy: reactive proxies can't be cloned into the database.
          await inStore('readwrite', store => store.put(JSON.parse(JSON.stringify(changes)), userId))
        }
        catch {
          // Nowhere to keep them: they live in memory until the app closes.
        }
      },
    },
  }
}
