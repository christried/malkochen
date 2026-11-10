import { shallowRef } from 'vue'
import { indexedDbStore } from '~/board/device-store'
import { createKeptBoards, type KeptBoards } from '~/board/kept-boards'
import { layOver } from '~/board/unsent-changes'
import type { BoardView } from '~~/server/utils/boards'
import type { Me } from '~~/server/utils/people'

// What malkochen keeps on this device (device-store.ts, kept-boards.ts):
// the user's Boards, the Board Switcher's list, the Dish Histories and the
// addresses, so the app opens without a connection (#461). One for the whole
// app; client only (the server renders without it).
// The images the service worker kept (IMAGES in public/sw.js).
const IMAGE_CACHE = 'images-v1'

// Takes some of them out, from the page, best effort: without the Cache API
// (an insecure page, a browser without it) there is nothing to take out.
async function forgetImages(urls: string[]): Promise<void> {
  try {
    const cache = await globalThis.caches?.open(IMAGE_CACHE)
    await Promise.all(urls.map(url => cache?.delete(url, { ignoreVary: true })))
  }
  catch {
    // Best effort: an image left behind is trimmed or goes at sign-out.
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const store = indexedDbStore()
  // Who the device's data belongs to: /api/me as last answered. `undefined`
  // until read from the device.
  const user = shallowRef<Me | null | undefined>(undefined)
  const keptOf = new Map<string, KeptBoards>()
  // The user as the server last answered, once the device has taken note of
  // them: what LeavingQuestion waits for to settle other users' Unsent
  // Changes and to send the user's own (#463).
  const signedIn = shallowRef<Me | null>(null)

  // Remembering a user, under way: what asks who the user is waits for it.
  let settling: Promise<void> = Promise.resolve()
  async function keptUser(): Promise<Me | null> {
    await settling
    if (user.value === undefined) user.value = await store.user.load()
    return user.value
  }
  function kept(userId: string): KeptBoards {
    if (!keptOf.has(userId)) keptOf.set(userId, createKeptBoards({ store, userId, forgetImages }))
    return keptOf.get(userId)!
  }

  return {
    provide: {
      device: {
        keptUser,
        kept,
        signedIn,
        store,
        // How many Unsent Changes the signed-in user has, read from the device
        // (no Board page needs to have opened them).
        async unsentCount(): Promise<number> {
          const me = await keptUser()
          if (!me) return 0
          const unsent = nuxtApp.$unsent.open(me.id)
          await unsent.ready
          return unsent.count.value
        },
        // The device's user's kept Boards, if the device knows who that is.
        async keptOfUser(): Promise<KeptBoards | null> {
          const me = await keptUser()
          return me ? kept(me.id) : null
        },
        // The user as the server just answered. When it is another user than
        // the one the data belongs to, theirs is removed from the device: the
        // Boards, Histories and list. Their Unsent Changes stay, for them to
        // sign in again and send; LeavingQuestion asks about discarding them.
        remember(me: Me): Promise<void> {
          settling = settling.then(async () => {
            if (user.value === undefined) user.value = await store.user.load()
            const known = user.value
            if (known && JSON.stringify(known) === JSON.stringify(me)) return
            if (known && known.id !== me.id) await store.forgetUser(known.id)
            user.value = me
            await store.user.save(me)
          }).then(() => {
            signedIn.value = me
          })
          return settling
        },
        // A kept Board with the Unsent Changes laid over it, as it is shown.
        async openKept(boardId: string): Promise<BoardView | null> {
          const me = await keptUser()
          const view = me ? await kept(me.id).board(boardId) : null
          if (!me || !view) return null
          const unsent = nuxtApp.$unsent.open(me.id)
          await unsent.ready
          return layOver(view, unsent.forBoard(boardId))
        },
        // Signing out or deleting the account: everything kept goes, the
        // Unsent Changes with it, and the images the service worker kept.
        // `keepUnsent`: all but the Unsent Changes (signing out again so
        // another user can send theirs, #463).
        async forget(options?: { keepUnsent?: boolean }) {
          user.value = null
          signedIn.value = null
          for (const open of keptOf.values()) open.close()
          keptOf.clear()
          // Nothing still to be sent is sent, or written back, after this.
          nuxtApp.$unsent.reset()
          await store.clear(options)
          // The images the service worker kept (IMAGES in public/sw.js): from the
          // page, so it is done when this returns, with or without a worker.
          await globalThis.caches?.delete(IMAGE_CACHE).catch(() => false)
        },
      },
    },
  }
})
