import type { BoardView } from '~~/server/utils/boards'
import { dishOnBoard, focusAfterLeaving } from '~~/shared/board'

// Deleting a Dish (PRD story 47): its card goes at once, and a Toast offers
// "Rückgängig" for the undo window, which puts it back where it was. The
// Board's copy is changed in place; the server keeps the Dish's Column and
// position, so after a reload it is where it was either way.
export function useDishDelete(board: Ref<BoardView | undefined>, showToast: (toast: Toast) => void) {
  const t = useStrings()

  // Where focus goes instead of a deleted Dish's card: the card now in its
  // place, or its Column if that is empty. Keyed by the deleted Dish's id.
  const focusAfterDelete = new Map<string, string>()

  // Focuses a Dish's card, or what took its place if it was deleted.
  function focusCard(dishId: string) {
    document.getElementById(focusAfterDelete.get(dishId) ?? `dish-${dishId}`)?.focus()
  }

  function deleteDish(dishId: string) {
    const found = board.value && dishOnBoard(board.value, dishId)
    if (!found) return
    const { dish, column } = found
    const index = column.dishes.indexOf(dish)
    // Its neighbours find its place again, whatever was added meanwhile.
    const above = column.dishes[index - 1]
    const below = column.dishes[index + 1]
    focusAfterDelete.set(dishId, focusAfterLeaving(column, index))
    column.dishes.splice(index, 1)
    hapticReject()

    function putBack() {
      if (column.dishes.includes(dish)) return
      const belowAt = below ? column.dishes.indexOf(below) : -1
      const aboveAt = above ? column.dishes.indexOf(above) : -1
      const at = belowAt !== -1 ? belowAt : aboveAt !== -1 ? aboveAt + 1 : Math.min(index, column.dishes.length)
      column.dishes.splice(at, 0, dish)
      focusAfterDelete.delete(dishId)
    }
    function takeOut() {
      const at = column.dishes.indexOf(dish)
      if (at !== -1) column.dishes.splice(at, 1)
    }

    // Whether it is deleted on the server. One already gone there (another
    // Member deleted it) counts as deleted; undo can still bring it back.
    const deleting = $fetch(`/api/dishes/${dishId}`, { method: 'DELETE' }).then(() => true, (error: { statusCode?: number }) => {
      if (error.statusCode === 404) return true
      putBack()
      showToast({ text: t.dish.deleteFailed(dish.title), duration: NOTICE_MS })
      return false
    })

    // Undo waits for the delete, so the two never cross on the way.
    async function undo() {
      if (!await deleting) return // Never deleted, and already back.
      putBack()
      await nextTick()
      focusCard(dishId)
      await $fetch(`/api/dishes/${dishId}/restore`, { method: 'POST' }).catch(() => {
        takeOut()
        showToast({ text: t.dish.restoreFailed(dish.title), duration: NOTICE_MS })
      })
    }

    showToast({ text: t.dish.deleted(dish.title), duration: UNDO_WINDOW_MS, actions: [{ label: t.dish.undo, run: undo }] })
  }

  return { deleteDish, focusCard }
}
