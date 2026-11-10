import { shallowRef } from 'vue'
import { indexedDbStore } from '~/board/device-store'
import { httpTransport } from '~/board/http-transport'
import { createUnsentChanges, type UnsentChanges } from '~/board/unsent-changes'

// The signed-in user's Unsent Changes (unsent-changes.ts), one for the whole
// app, kept in IndexedDB on this device. Made by the first Board page that
// knows who is signed in (useUnsentChanges), and by then shared by every
// Board's module. Client only: the server renders without them.
export default defineNuxtPlugin(() => {
  const current = shallowRef<UnsentChanges | null>(null)
  let userId: string | null = null
  const store = indexedDbStore()
  const transport = httpTransport()
  return {
    provide: {
      unsent: {
        current,
        // The user's Unsent Changes; another user's are never shown to this one.
        open(id: string): UnsentChanges {
          if (!current.value || userId !== id) {
            userId = id
            current.value = createUnsentChanges({ store, transport, userId: id })
          }
          return current.value
        },
        // Signed out: the in-memory list goes too, so the next to sign in
        // starts from what the device holds for them.
        reset() {
          current.value = null
          userId = null
        },
      },
    },
  }
})
