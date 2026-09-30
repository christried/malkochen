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

// The id of the element to focus when the Dish at `index` leaves its Column:
// the card that takes its place (the one below, else the one above), or the
// Column itself if it is left empty.
export function focusAfterLeaving(column: { id: string, dishes: { id: string }[] }, index: number): string {
  const next = column.dishes[index + 1] ?? column.dishes[index - 1]
  return next ? `dish-${next.id}` : `column-${column.id}`
}
