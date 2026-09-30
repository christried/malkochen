import type { BoardView } from '~~/server/utils/boards'
import { dishOnBoard, focusAfterLeaving } from '~~/shared/board'

// "Verschieben nach…" (PRD story 33): the Dish goes at once to the top of
// the other Column, and a Toast says where. The Board's copy is changed in
// place; if the server refuses, the Dish goes back where it was. One already
// gone there (another Member deleted it) just goes.
export function useDishMove(board: Ref<BoardView | undefined>, showToast: (toast: Toast) => void) {
  const t = useStrings()

  // Moves the Dish and answers the id of the element to focus instead of its
  // card: the card now in its place, or its Column if that is empty.
  function moveDish(dishId: string, columnId: string): string | null {
    const found = board.value && dishOnBoard(board.value, dishId)
    const target = board.value?.columns.find(c => c.id === columnId)
    if (!found || !target || target === found.column) return null
    const { dish, column } = found
    const index = column.dishes.indexOf(dish)
    const focusId = focusAfterLeaving(column, index)
    column.dishes.splice(index, 1)
    target.dishes.unshift(dish)
    showToast({ text: t.dish.moved(dish.title, target.name), duration: NOTICE_MS })

    $fetch(`/api/dishes/${dishId}/move`, { method: 'POST', body: { columnId } }).catch((error: { statusCode?: number }) => {
      const at = target.dishes.indexOf(dish)
      if (at === -1) return
      target.dishes.splice(at, 1)
      if (error.statusCode === 404) return
      column.dishes.splice(Math.min(index, column.dishes.length), 0, dish)
      showToast({ text: t.dish.moveFailed(dish.title), duration: NOTICE_MS })
    })

    return focusId
  }

  return { moveDish }
}
