import type { BoardView } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView, MovedDish } from '~~/server/utils/dishes'
import { dishOnBoard, focusAfterLeaving } from '~~/shared/board'

// "Verschieben nach…" (PRD story 33), drag and drop (stories 31, 32, 34)
// and "Gekocht ✓" (story 35): the Dish goes at once to its new place. The
// Board's copy is changed in place; if the server refuses, the Dish goes
// back where it was and a Toast says so. One already gone there (another
// Member deleted it) just goes.
//
// Moving a Dish into the Gekocht Column records a Cooking (stories 49–55):
// it shows in its Cooking History at once, and the Gekocht toast offers
// "Notiz hinzufügen" (`addNote`) and "Rückgängig", which puts the Dish back
// where it was and removes that Cooking.
export function useDishMove(
  board: Ref<BoardView | undefined>,
  showToast: (toast: Toast) => void,
  addNote: (dish: DishView, cooking: CookingView) => void,
) {
  const t = useStrings()

  // Puts the Dish at `index` among the target Column's other Dishes (as
  // dragged, in any Column), or without one at the top of another Column.
  // `cook` ("Gekocht ✓") records a Cooking even if the Dish already is in
  // the Gekocht Column, where it then stays. Answers where it went and the
  // id of the element to focus instead of its card (the card now in its
  // place, or its Column if that is empty), or null if it didn't move.
  function dropDish(dishId: string, { columnId, index }: { columnId: string, index?: number }, { cook = false } = {}) {
    const found = board.value && dishOnBoard(board.value, dishId)
    const target = board.value?.columns.find(c => c.id === columnId)
    if (!found || !target) return null
    const { dish, column } = found
    const from = column.dishes.indexOf(dish)
    const others = target === column ? column.dishes.length - 1 : target.dishes.length
    const to = Math.min(index ?? 0, others)
    const stays = target === column && (index === undefined || to === from)
    const cooks = target.isGekocht && (cook || target !== column)
    if (stays && !cooks) return null
    const focusId = stays ? `dish-${dish.id}` : focusAfterLeaving(column, from)
    if (!stays) {
      column.dishes.splice(from, 1)
      target.dishes.splice(to, 0, dish)
    }
    // The Cooking as the server will record it, filled in once it has.
    // The Board's own (reactive) copy, so filling it in shows.
    if (cooks) dish.cookings.unshift({ id: '', cookedAt: new Date().toISOString(), note: null, recordedBy: null })
    const pending = cooks ? dish.cookings[0]! : null

    // Back where it was, from wherever it is now, without that Cooking.
    // One no longer on the Board (deleted meanwhile) stays gone.
    function takeBack() {
      if (pending) removeFrom(dish.cookings, pending)
      const now = board.value && dishOnBoard(board.value, dish.id)
      if (stays || !now) return
      removeFrom(now.column.dishes, dish)
      column.dishes.splice(Math.min(from, column.dishes.length), 0, dish)
    }

    const request = cook
      ? $fetch<MovedDish>(`/api/dishes/${dishId}/cook`, { method: 'POST' })
      : $fetch<MovedDish>(`/api/dishes/${dishId}/move`, { method: 'POST', body: { columnId, index } })
    // The Cooking recorded, once it is.
    const recorded = request.then((moved) => {
      if (!pending) return null
      if (!moved.cooking) {
        // Already in the Gekocht Column on the server: nothing recorded.
        removeFrom(dish.cookings, pending)
        return null
      }
      Object.assign(pending, moved.cooking)
      return pending
    }, (error: { statusCode?: number }) => {
      if (error.statusCode === 404) {
        removeFrom(target.dishes, dish)
        return null
      }
      takeBack()
      showToast({ text: (cooks ? t.dish.cookFailed : t.dish.moveFailed)(dish.title), duration: NOTICE_MS })
      return null
    })

    if (pending) {
      hapticConfirm()
      showToast({
        text: t.dish.cook,
        duration: UNDO_WINDOW_MS,
        actions: [
          { label: t.dish.addNote, run: async () => {
            const cooking = await recorded
            if (cooking) addNote(dish, cooking)
          } },
          { label: t.dish.undo, run: () => undoCooking(dish, recorded, { column, from, takeBack }) },
        ],
      })
    }
    return { dish, target, focusId }
  }

  // "Rückgängig" in the Gekocht toast. It waits for the Cooking to be
  // recorded, so the two never cross on the way.
  async function undoCooking(
    dish: DishView,
    recorded: Promise<CookingView | null>,
    { column, from, takeBack }: { column: { id: string }, from: number, takeBack: () => void },
  ) {
    const cooking = await recorded
    if (!cooking) return // Never recorded, and already back.
    const now = board.value && dishOnBoard(board.value, dish.id)
    const at = now ? now.column.dishes.indexOf(now.dish) : -1
    takeBack()
    await nextTick()
    document.getElementById(`dish-${dish.id}`)?.focus()
    await $fetch(`/api/cookings/${cooking.id}/undo`, { method: 'POST', body: { columnId: column.id, index: from } }).catch((error: { statusCode?: number }) => {
      // Back to where the move put it, with its Cooking unless that is gone
      // (deleted from the Cooking History meanwhile).
      if (error.statusCode !== 404) dish.cookings.unshift(cooking)
      const back = board.value && dishOnBoard(board.value, dish.id)
      if (now && back && back.column !== now.column) {
        removeFrom(back.column.dishes, back.dish)
        now.column.dishes.splice(Math.min(at, now.column.dishes.length), 0, dish)
      }
      showToast({ text: t.dish.uncookFailed(dish.title), duration: NOTICE_MS })
    })
  }

  // From the menu: to the top of another Column, and a Toast says where
  // (into the Gekocht Column, the Gekocht toast does). Answers the id of the
  // element to focus instead of the Dish's card.
  function moveDish(dishId: string, columnId: string): string | null {
    const moved = dropDish(dishId, { columnId })
    if (!moved) return null
    if (!moved.target.isGekocht) showToast({ text: t.dish.moved(moved.dish.title, moved.target.name), duration: NOTICE_MS })
    return moved.focusId
  }

  // "Gekocht ✓" on a card or in the Dish detail: to the top of the Gekocht
  // Column, or where it is if it is there already. Answers the id of the
  // element to focus instead of the Dish's card.
  function cookDish(dishId: string): string | null {
    const gekocht = board.value?.columns.find(c => c.isGekocht)
    if (!gekocht) return null
    return dropDish(dishId, { columnId: gekocht.id }, { cook: true })?.focusId ?? null
  }

  return { moveDish, dropDish, cookDish }
}

// Takes `item` out of `list`; false if it wasn't in it.
function removeFrom<T>(list: T[], item: T): boolean {
  const at = list.indexOf(item)
  if (at === -1) return false
  list.splice(at, 1)
  return true
}
