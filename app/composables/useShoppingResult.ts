import type { ShoppingNotice, ShoppingResult } from '~/board/shopping-list'
import { NOTICE_MS, UNDO_WINDOW_MS, type Toast } from '~/utils/toast'

// Showing what a Shopping List write answered (#536, #537), on the list, in
// the Dish detail and on the Week Plan alike: a notice as a toast, then what
// the write ended in once settled. With `done`, the toast says what was done
// and, for a delete or a clear, offers "Rückgängig", which is the write's
// own undo through the Board module; its result shows the same way.
export function useShoppingResult(show: (toast: Toast) => void) {
  const t = useStrings()

  function noticeText(notice: ShoppingNotice, title: string): string {
    if (notice === 'dishGone') return t.shopping.dishGone(title)
    return notice === 'shoppingFull' ? t.shopping.full : t.shopping.failed
  }

  function showShoppingResult(result: ShoppingResult, done?: { text: string, undo?: boolean }, title = '') {
    if (result.notice) {
      hapticReject()
      show({ text: noticeText(result.notice, title), duration: NOTICE_MS })
      return
    }
    if (done) {
      show({
        text: done.text,
        duration: done.undo && result.undo ? UNDO_WINDOW_MS : NOTICE_MS / 2,
        ...done.undo && result.undo && {
          actions: [{ label: t.dish.undo, offline: true, run: () => {
            const undone = result.undo!()
            if (undone) showShoppingResult(undone, undefined, title)
          } }],
        },
      })
    }
    void result.settled?.then(ended => ended.notice && showShoppingResult(ended, undefined, title))
  }

  return { showShoppingResult }
}
