import type { BoardView } from '~~/server/utils/boards'
import { dishOnBoard, focusAfterLeaving } from '~~/shared/board'

// "Verschieben nach…" (PRD story 33) and drag and drop (stories 31, 32, 34):
// the Dish goes at once to its new place. The Board's copy is changed in
// place; if the server refuses, the Dish goes back where it was and a Toast
// says so. One already gone there (another Member deleted it) just goes.
export function useDishMove(board: Ref<BoardView | undefined>, showToast: (toast: Toast) => void) {
  const t = useStrings()

  // Puts the Dish at `index` among the target Column's other Dishes (as
  // dragged, in any Column), or without one at the top of another Column.
  // Answers where it went and the id of the element to focus instead of its
  // card (the card now in its place, or its Column if that is empty), or
  // null if it didn't move.
  function dropDish(dishId: string, { columnId, index }: { columnId: string, index?: number }) {
    const found = board.value && dishOnBoard(board.value, dishId)
    const target = board.value?.columns.find(c => c.id === columnId)
    if (!found || !target || (index === undefined && target === found.column)) return null
    const { dish, column } = found
    const from = column.dishes.indexOf(dish)
    const focusId = focusAfterLeaving(column, from)
    column.dishes.splice(from, 1)
    const to = Math.min(index ?? 0, target.dishes.length)
    target.dishes.splice(to, 0, dish)
    if (target === column && to === from) return null

    $fetch(`/api/dishes/${dishId}/move`, { method: 'POST', body: { columnId, index } }).catch((error: { statusCode?: number }) => {
      const at = target.dishes.indexOf(dish)
      if (at === -1) return
      target.dishes.splice(at, 1)
      if (error.statusCode === 404) return
      column.dishes.splice(Math.min(from, column.dishes.length), 0, dish)
      showToast({ text: t.dish.moveFailed(dish.title), duration: NOTICE_MS })
    })
    return { dish, target, focusId }
  }

  // From the menu: to the top of another Column, and a Toast says where.
  // Answers the id of the element to focus instead of the Dish's card.
  function moveDish(dishId: string, columnId: string): string | null {
    const moved = dropDish(dishId, { columnId })
    if (!moved) return null
    showToast({ text: t.dish.moved(moved.dish.title, moved.target.name), duration: NOTICE_MS })
    return moved.focusId
  }

  return { moveDish, dropDish }
}
