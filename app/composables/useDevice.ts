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
  forget: () => Promise<void>
}

export function useDevice(): Device | undefined {
  return useNuxtApp().$device as Device | undefined
}
