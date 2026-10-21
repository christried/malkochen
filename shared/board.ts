// Where a Dish is on a Board: the Dish and its Column, or null if it isn't there.
export function dishOnBoard<C extends { dishes: { id: string }[] }>(
  board: { columns: C[] },
  dishId: unknown,
): { dish: C['dishes'][number], column: C } | null {
  for (const column of board.columns) {
    const dish = column.dishes.find(d => d.id === dishId)
    if (dish) return { dish, column }
  }
  return null
}

// How a Board is named in running text and titles: "🍜 Kochclub".
export function boardLabel(board: { emoji: string, name: string }): string {
  return `${board.emoji} ${board.name}`
}

// How many Boards of their own one user may have (#347), Archived Boards not
// counted, so one user can't fill the database. Creating one more is refused
// (409, BOARD_LIMIT_REACHED) until they delete one. Boards they're a Member
// of don't count, and restoring an Archived Board isn't refused: bringing
// back their own Board never fails, and the daily limit on creating Boards
// (server/rate-limits.ts) keeps archiving and creating again slow.
export const BOARDS_PER_USER = 20
export const BOARD_LIMIT_REACHED = 409
