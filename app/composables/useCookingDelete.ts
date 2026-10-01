import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'

// Deleting a single Cooking from a Dish's Cooking History (PRD story 48):
// it goes at once, and a Toast offers "Rückgängig" for the undo window,
// which puts it back. The Dish's copy (the Board's) is changed in place.
export function useCookingDelete(showToast: (toast: Toast) => void) {
  const t = useStrings()

  function deleteCooking(dish: DishView, cooking: CookingView) {
    const index = dish.cookings.indexOf(cooking)
    if (index === -1 || !cooking.id) return
    dish.cookings.splice(index, 1)
    hapticReject()
    const date = new Date(cooking.cookedAt)

    // The History is newest first, so the Cooking's date finds its place again.
    function putBack() {
      if (dish.cookings.includes(cooking)) return
      const at = dish.cookings.findIndex(c => c.cookedAt < cooking.cookedAt)
      dish.cookings.splice(at === -1 ? dish.cookings.length : at, 0, cooking)
    }

    // Whether it is deleted on the server. One already gone there (another
    // Member deleted it) counts as deleted; undo can still bring it back.
    const deleting = trackWrite($fetch<unknown>(`/api/cookings/${cooking.id}`, { method: 'DELETE' })).then(() => true, (error: { statusCode?: number }) => {
      if (error.statusCode === 404) return true
      putBack()
      showToast({ text: t.cooking.deleteFailed, duration: NOTICE_MS })
      return false
    })

    // Undo waits for the delete, so the two never cross on the way.
    async function undo() {
      if (!await deleting) return // Never deleted, and already back.
      putBack()
      await trackWrite($fetch<unknown>(`/api/cookings/${cooking.id}/restore`, { method: 'POST' })).catch(() => {
        const at = dish.cookings.indexOf(cooking)
        if (at !== -1) dish.cookings.splice(at, 1)
        showToast({ text: t.cooking.restoreFailed, duration: NOTICE_MS })
      })
    }

    showToast({ text: t.cooking.deleted(date), duration: UNDO_WINDOW_MS, actions: [{ label: t.dish.undo, run: undo }] })
  }

  return { deleteCooking }
}
