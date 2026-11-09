import type { DeviceStore } from '../../app/board/device-store'
import type { UnsentChange } from '../../app/board/unsent-changes'

// The device store for the client tests: a plain Map per part. Copies on the
// way in and out (as IndexedDB does), so a test catches a change sharing an
// object with the store.
export function memoryStore(): DeviceStore {
  const unsent = new Map<string, UnsentChange[]>()
  return {
    unsent: {
      load: userId => Promise.resolve(structuredClone(unsent.get(userId) ?? [])),
      save: (userId, changes) => {
        // Through JSON, as reactive proxies can't be structured-cloned.
        unsent.set(userId, structuredClone(JSON.parse(JSON.stringify(changes)) as UnsentChange[]))
        return Promise.resolve()
      },
    },
  }
}
