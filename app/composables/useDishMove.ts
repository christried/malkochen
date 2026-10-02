import type { BoardView } from '~~/server/utils/boards'
import { focusAfterLeaving } from '~/board/board-module'
import { boardLabel, dishOnBoard } from '~~/shared/board'

// Moving a Dish to another Board (PRD story 46). Moving within the Board
// and cooking go through the client Board module.
export function useDishMove(board: Ref<BoardView | undefined>, showToast: (toast: Toast) => void) {
  const t = useStrings()

  // To a Column on another Board: it leaves this Board at once, keeping its
  // Cooking History, and a Toast says where it went; into that Board's
  // Gekocht Column it records a Cooking, but with no Gekocht toast or undo,
  // as it is no longer here. If the server refuses, it comes back with a
  // notice. Answers the id of the element to focus instead of the Dish's card.
  function moveToBoard(dishId: string, columnId: string, toBoard: { emoji: string, name: string, columns: { id: string, name: string }[] }): string | null {
    const found = board.value && dishOnBoard(board.value, dishId)
    const target = toBoard.columns.find(c => c.id === columnId)
    if (!found || !target) return null
    const { dish, column } = found
    const from = column.dishes.indexOf(dish)
    const focusId = focusTargetId(focusAfterLeaving(column, from))
    column.dishes.splice(from, 1)
    showToast({ text: t.dish.movedToBoard(dish.title, boardLabel(toBoard), target.name), duration: NOTICE_MS })

    trackWrite($fetch<unknown>(`/api/dishes/${dishId}/move`, { method: 'POST', body: { columnId } })).catch((error: { statusCode?: number }) => {
      // Gone meanwhile (another Member deleted it): it stays gone.
      if (error.statusCode === 404) return
      const now = board.value?.columns.find(c => c.id === column.id)
      now?.dishes.splice(Math.min(from, now.dishes.length), 0, dish)
      showToast({ text: t.dish.moveFailed(dish.title), duration: NOTICE_MS })
    })
    return focusId
  }

  return { moveToBoard }
}
