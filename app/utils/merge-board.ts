import type { BoardView } from '~~/server/utils/boards'

// Brings the Board as the app shows it up to date with the Board as the
// server has it (PRD story 38), in place: Columns and Dishes still there
// stay the same objects, as undo, drag and focus keep hold of them; only
// what changed is written, so nothing re-renders for nothing; and what is
// gone goes. Whatever the server has wins, as the last write did there.
export function mergeBoard(shown: BoardView, fresh: BoardView) {
  const { columns, ...board } = fresh
  assignChanged(shown, board)

  const shownColumns = new Map(shown.columns.map(c => [c.id, c]))
  // By id across all Columns: a Dish may have moved to another one.
  const shownDishes = new Map(shown.columns.flatMap(c => c.dishes).map(d => [d.id, d]))
  const merged = columns.map(({ dishes, ...fields }) => {
    const column = shownColumns.get(fields.id) ?? { ...fields, dishes: [] }
    assignChanged(column, fields)
    replaceChanged(column.dishes, dishes.map((dish) => {
      const known = shownDishes.get(dish.id)
      if (!known) return dish
      assignChanged(known, dish)
      return known
    }))
    return column
  })
  replaceChanged(shown.columns, merged)
}

// Copies the fields of `source` that differ onto `target`.
function assignChanged<T extends object>(target: T, source: Partial<T>) {
  for (const key of Object.keys(source) as (keyof T)[]) {
    if (JSON.stringify(target[key]) !== JSON.stringify(source[key])) target[key] = source[key]!
  }
}

// Makes `list` hold `items`, unless it already does.
function replaceChanged<T>(list: T[], items: T[]) {
  if (list.length === items.length && list.every((item, i) => item === items[i])) return
  list.splice(0, list.length, ...items)
}
