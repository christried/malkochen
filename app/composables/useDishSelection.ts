import type { BoardView } from '~~/server/utils/boards'

// The browser's close requests (Chromium): the Android back gesture, and
// Escape on desktop, close the newest watcher first. Not in TypeScript's DOM
// types yet.
interface CloseWatcherLike {
  onclose: (() => void) | null
  destroy: () => void
}
declare const CloseWatcher: { new (): CloseWatcherLike } | undefined

// Several Dishes selected on a Board (#218), to move or delete them at
// once: selection mode is on while at least one is selected, from any of
// the Board's Columns. Leaving it clears the selection: deselecting the last
// one, `clear`, or a close request (the back gesture on phones, Escape on
// desktop; the Board's Escape shortcut clears it too). A Dish that leaves
// the Board (another Member deleted it, or moved it elsewhere) leaves the
// selection.
export function useDishSelection(board: Ref<BoardView | undefined>) {
  const selectedIds = ref<string[]>([])
  const selecting = computed(() => selectedIds.value.length > 0)

  function isSelected(dishId: string) {
    return selectedIds.value.includes(dishId)
  }

  function toggle(dishId: string) {
    selectedIds.value = isSelected(dishId)
      ? selectedIds.value.filter(id => id !== dishId)
      : [...selectedIds.value, dishId]
  }

  function clear() {
    selectedIds.value = []
  }

  const onBoard = computed(() => new Set(board.value?.columns.flatMap(c => c.dishes.map(d => d.id))))
  watch(onBoard, (ids) => {
    const kept = selectedIds.value.filter(id => ids.has(id))
    if (kept.length !== selectedIds.value.length) selectedIds.value = kept
  })

  let watcher: CloseWatcherLike | undefined
  function stopWatching() {
    watcher?.destroy()
    watcher = undefined
  }
  watch(selecting, (on) => {
    stopWatching()
    if (!on || typeof CloseWatcher === 'undefined') return
    watcher = new CloseWatcher()
    watcher.onclose = clear
  })
  onBeforeUnmount(stopWatching)

  return { selectedIds: readonly(selectedIds), selecting, isSelected, toggle, clear }
}
