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
