import type { BoardView } from '~~/server/utils/boards'
import { dishOnBoard, focusAfterLeaving } from '~~/shared/board'

// "Verschieben nach…" (PRD story 33) and drag and drop (stories 31, 32, 34):
// the Dish goes at once to its new place. The Board's copy is changed in
// place; if the server refuses, the Dish goes back where it was and a Toast
// says so. One already gone there (another Member deleted it) just goes.
export function useDishMove(board: Ref<BoardView | undefined>, showToast: (toast: Toast) => void) {
  const t = useStrings()

  // Puts the Dish at `index` among the target Column's other Dishes, or at
  // the top of another Column without one. False if there is nothing to do.
  function move(dishId: string, columnId: string, index?: number): boolean {
    const found = board.value && dishOnBoard(board.value, dishId)
    const target = board.value?.columns.find(c => c.id === columnId)
    if (!found || !target || (index === undefined && target === found.column)) return false
    const { dish, column } = found
    const from = column.dishes.indexOf(dish)
    column.dishes.splice(from, 1)
    const to = Math.min(index ?? 0, target.dishes.length)
    target.dishes.splice(to, 0, dish)
    if (target === column && to === from) return false

    $fetch(`/api/dishes/${dishId}/move`, { method: 'POST', body: { columnId, index } }).catch((error: { statusCode?: number }) => {
      const at = target.dishes.indexOf(dish)
      if (at === -1) return
      target.dishes.splice(at, 1)
      if (error.statusCode === 404) return
      column.dishes.splice(Math.min(from, column.dishes.length), 0, dish)
      showToast({ text: t.dish.moveFailed(dish.title), duration: NOTICE_MS })
    })
    return true
  }

  // From the menu: to the top of another Column, and a Toast says where.
  // Answers the id of the element to focus instead of its card: the card
  // now in its place, or its Column if that is empty.
  function moveDish(dishId: string, columnId: string): string | null {
    const found = board.value && dishOnBoard(board.value, dishId)
    const target = board.value?.columns.find(c => c.id === columnId)
    if (!found || !target) return null
    const focusId = focusAfterLeaving(found.column, found.column.dishes.indexOf(found.dish))
    if (!move(dishId, columnId)) return null
    showToast({ text: t.dish.moved(found.dish.title, target.name), duration: NOTICE_MS })
    return focusId
  }

  // Dragged: to `index` in any Column, its own too. No Toast; the card
  // shows where it went.
  function dropDish(dishId: string, columnId: string, index: number) {
    move(dishId, columnId, index)
  }

  return { moveDish, dropDish }
}
