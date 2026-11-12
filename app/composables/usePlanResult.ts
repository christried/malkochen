import type { DishView } from '~~/server/utils/dishes'
import type { PlanNotice, PlanResult } from '~/board/board-module'
import { NOTICE_MS, UNDO_WINDOW_MS, type Toast } from '~/utils/toast'

// Showing what a Week Plan write answered (handoff Toast r14), for the Week
// Plan and for "Einplanen" in the Dish detail alike: a notice as a toast, then
// what the write ended in once settled. With `done`, the toast says what was
// done and offers "Rückgängig", which is the opposite write through the Board
// module; its own result shows the same way.
export function usePlanResult(show: (toast: Toast) => void) {
  const t = useStrings()

  function noticeText(notice: PlanNotice, dish: DishView): string {
    return notice === 'notAllowed' ? t.dish.notAllowed(dish.title) : t.dish[notice](dish.title)
  }

  function showPlanResult(result: PlanResult, done?: { text: string, undo: () => PlanResult | null }) {
    if (result.notice) {
      hapticReject()
      show({ text: noticeText(result.notice, result.dish), duration: NOTICE_MS })
      return
    }
    if (done) {
      show({
        text: done.text,
        duration: UNDO_WINDOW_MS,
        actions: [{ label: t.dish.undo, offline: true, run: () => {
          const undone = done.undo()
          if (undone) showPlanResult(undone)
        } }],
      })
    }
    void result.settled?.then(ended => ended.notice && showPlanResult(ended))
  }

  return { showPlanResult }
}
