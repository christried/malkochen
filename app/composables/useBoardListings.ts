import { gotNoAnswer } from '~/board/kept-boards'
import type { BoardListing } from '~~/server/utils/boards'

// The user's Boards as the Board switcher last fetched them: its list, and
// what a Board's skeleton shows of it while it opens (BoardSkeleton).
export function useBoardListings() {
  return useState<BoardListing[]>('board-listings', () => [])
}

// Fetches the list afresh into useBoardListings and keeps it on the device
// (which also removes a kept Board that isn't on it any more: left, removed
// from, archived or deleted). With no answer from malkochen it shows the
// kept list instead, the Boards opened on this device (#461); any other
// failure leaves the list as it was. Answers whether malkochen answered.
export function useRefreshBoardListings() {
  const listings = useBoardListings()
  const device = useDevice()
  return async (): Promise<boolean> => {
    try {
      const fresh = await $fetch<BoardListing[]>('/api/boards')
      listings.value = fresh
      void device?.keptOfUser().then(kept => kept?.keepListings(fresh))
      return true
    }
    catch (error) {
      if (!gotNoAnswer(error)) return false
      const kept = await (await device?.keptOfUser())?.listings()
      if (kept?.length) listings.value = kept
      return false
    }
  }
}
