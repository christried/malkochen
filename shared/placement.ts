// The placement and Gekocht Column rules (CONTEXT.md: Gekocht Column,
// Cooking; PRD stories 13, 31–35, 49, 55, 57–59; ADR 0003), as pure
// functions over a Board's Columns in order. The client and the server's
// JavaScript both decide by these; the server's atomic SQL does the same on
// its own, and API tests check that it agrees (placement-rules.test.ts).

interface RuleColumn {
  id: string
  isGekocht: boolean
}

// The Column that takes new Dishes: the first one that isn't the Gekocht
// Column, as a new Dish hasn't been cooked.
export function columnForNewDishes<C extends RuleColumn>(columns: C[]): C | undefined {
  return columns.find(c => !c.isGekocht)
}

// Whether moving a Dish from one Column to another records a Cooking: into
// the Gekocht Column from elsewhere (another Board's too), or "Gekocht ✓"
// (`cook`) on a Dish already there. Moving it within the Gekocht Column
// otherwise records none, and nor does deleting its Column.
export function recordsCooking(from: { id: string }, to: RuleColumn, { cook = false }: { cook?: boolean } = {}): boolean {
  return to.isGekocht && (cook || from.id !== to.id)
}

// Where a Dish lands among a Column's Dishes when moved there. With a drop
// `index`, at that place among the Column's other Dishes, or at the end if
// there are fewer; without one, at the top, or where it is if it already is
// in that Column.
export function landingIndex(column: { dishes: { id: string }[] }, dishId: string, index?: number): number {
  const at = column.dishes.findIndex(d => d.id === dishId)
  if (index === undefined) return Math.max(at, 0)
  const others = at === -1 ? column.dishes.length : column.dishes.length - 1
  return Math.min(index, others)
}

// Why a Column can't be deleted as asked.
export type ColumnRefusal = 'gekocht' | 'last' | 'not-empty' | 'bad-target'

// Where a Column's Dishes go when it is deleted, or why it can't be. The
// Gekocht Column stays, and so does a Board's last other Column, which
// takes new Dishes. Its Dishes go to `moveTo`, which must be another of the
// Board's Columns; without one it must have no Dishes. Those archived from
// it stay in the Archive and come back at the top of the Column that takes
// new Dishes once it is gone (server/utils/dishes.ts). Asked about the
// Column alone, it answers whether it can be deleted at all and, if so,
// the Column its Dishes would go to by default.
export function columnDeletion<C extends RuleColumn>(
  columns: C[],
  column: RuleColumn,
  { moveTo, hasDishes = false }: { moveTo?: string, hasDishes?: boolean } = {},
): { target: C } | { refusal: ColumnRefusal } {
  if (column.isGekocht) return { refusal: 'gekocht' }
  const others = columns.filter(c => c.id !== column.id)
  const firstOther = columnForNewDishes(others)
  if (!firstOther) return { refusal: 'last' }
  if (moveTo !== undefined) {
    const target = others.find(c => c.id === moveTo)
    return target ? { target } : { refusal: 'bad-target' }
  }
  return hasDishes ? { refusal: 'not-empty' } : { target: firstOther }
}
