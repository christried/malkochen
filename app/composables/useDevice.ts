import type { ShallowRef } from 'vue'
import type { DeviceStore } from '~/board/device-store'
import type { KeptBoards } from '~/board/kept-boards'
import type { BoardView } from '~~/server/utils/boards'
import type { Me } from '~~/server/utils/people'

// What malkochen keeps on this device (plugins/device.client.ts); undefined
// on the server, which keeps nothing.
export interface Device {
  keptUser: () => Promise<Me | null>
  kept: (userId: string) => KeptBoards
  keptOfUser: () => Promise<KeptBoards | null>
  remember: (me: Me) => Promise<void>
  openKept: (boardId: string) => Promise<BoardView | null>
  // The user as last answered, once taken note of; the device store; how many
  // Unsent Changes the user has (#463).
  signedIn: ShallowRef<Me | null>
  store: DeviceStore
  unsentCount: () => Promise<number>
  forget: (options?: { keepUnsent?: boolean }) => Promise<void>
}

export function useDevice(): Device | undefined {
  return useNuxtApp().$device as Device | undefined
}
