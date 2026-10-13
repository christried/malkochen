import type { Shortcut } from '~/utils/shortcuts'

// The Board's keyboard shortcuts (utils/shortcuts.ts), while the Board is
// mounted: each key press that is one goes to `run`, which says whether it
// did anything; if it did, nothing else happens with the key (so "/" or "n"
// isn't typed into the field it opens). `blocked` holds them back, e.g.
// mid-drag. Every modal (sheets, dialogs, the Dish detail) is on the modal
// stack. The Board settings page listens the same way, for Escape only
// (useEscapeToLeave).
export function useBoardShortcuts(run: (shortcut: Shortcut) => boolean, blocked: () => boolean) {
  const modalOpen = useAnyModalOpen()
  function onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || blocked()) return
    const shortcut = shortcutFor(event, { inField: isField(event.target), modalOpen: modalOpen.value })
    if (shortcut && run(shortcut)) event.preventDefault()
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}

function isField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}
