import type { BoardListing } from '~~/server/utils/boards'

// The user's Boards as the Board switcher last fetched them: its list, and
// what a Board's skeleton shows of it while it opens (BoardSkeleton).
export function useBoardListings() {
  return useState<BoardListing[]>('board-listings', () => [])
}
