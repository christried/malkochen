import type { Shortcut } from '~/utils/shortcuts'

// The Board's keyboard shortcuts (utils/shortcuts.ts), while the Board is
// mounted: each key press that is one goes to `run`, and nothing else
// happens with it (so "/" or "n" isn't typed into the field it opens).
// `blocked` holds them back too, e.g. mid-drag.
export function useBoardShortcuts(run: (shortcut: Shortcut) => void, blocked: () => boolean = () => false) {
  const modalOpen = useAnyModalOpen()
  function onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || blocked()) return
    const shortcut = shortcutFor(event, {
      inField: isField(event.target),
      // A native <dialog> not on the modal stack counts too.
      modalOpen: modalOpen.value || !!document.querySelector('dialog[open]'),
    })
    if (!shortcut) return
    event.preventDefault()
    run(shortcut)
  }
  onMounted(() => window.addEventListener('keydown', onKeydown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
}

function isField(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || target.matches('input, textarea, select'))
}
