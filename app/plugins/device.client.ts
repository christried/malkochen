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
export default defineNuxtPlugin((nuxtApp) => {
  const store = indexedDbStore()
  // Who the device's data belongs to: /api/me as last answered. `undefined`
  // until read from the device.
  const user = shallowRef<Me | null | undefined>(undefined)
  const keptOf = new Map<string, KeptBoards>()

  // Remembering a user, under way: what asks who the user is waits for it.
  let settling: Promise<void> = Promise.resolve()
  async function keptUser(): Promise<Me | null> {
    await settling
    if (user.value === undefined) user.value = await store.user.load()
    return user.value
  }
  function kept(userId: string): KeptBoards {
    if (!keptOf.has(userId)) keptOf.set(userId, createKeptBoards({ store, userId }))
    return keptOf.get(userId)!
  }

  return {
    provide: {
      device: {
        keptUser,
        kept,
        // The device's user's kept Boards, if the device knows who that is.
        async keptOfUser(): Promise<KeptBoards | null> {
          const me = await keptUser()
          return me ? kept(me.id) : null
        },
        // The user as the server just answered. When it is another user than
        // the one the data belongs to, theirs is removed from the device: the
        // Boards, Histories and list. Their Unsent Changes stay (they wait
        // for them to sign in again; asking before discarding them is #463).
        remember(me: Me): Promise<void> {
          settling = settling.then(async () => {
            if (user.value === undefined) user.value = await store.user.load()
            const known = user.value
            if (known && JSON.stringify(known) === JSON.stringify(me)) return
            if (known && known.id !== me.id) await store.forgetUser(known.id)
            user.value = me
            await store.user.save(me)
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
        async forget() {
          user.value = null
          keptOf.clear()
          nuxtApp.$unsent.reset()
          await store.clear()
          // The images the service worker kept (IMAGES in public/sw.js): from the
          // page, so it is done when this returns, with or without a worker.
          await caches?.delete('images-v1').catch(() => false)
        },
      },
    },
  }
})
