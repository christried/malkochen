import type { Ref } from 'vue'
import { closesOnBackdrop, hasTypedText } from '~/utils/backdrop-close'

// Wires a native <dialog>'s backdrop to `close` (#390; the rule is in
// utils/backdrop-close). Bind the returned handlers: pointerdown, input,
// click.self and close. `canClose` holds back a close the sheet has
// reason to keep (the Dish detail while it is edited).
export function useBackdropClose(dialog: Ref<HTMLDialogElement | null>, close: () => void, canClose: () => boolean = () => true) {
  let startedOnBackdrop = false
  // The Member has typed since the sheet opened (a prefilled field they never
  // touched doesn't count). Whether text is still there is checked at click time.
  let dirty = false
  return {
    onPointerdown(event: PointerEvent) {
      startedOnBackdrop = event.target === dialog.value
    },
    onInput() {
      dirty = true
    },
    onBackdropClick() {
      const press = { startedOnBackdrop, typed: dirty && hasTypedText(dialog.value) }
      startedOnBackdrop = false
      if (closesOnBackdrop(press) && canClose()) close()
    },
    // Closed: what was typed is gone with it.
    onClosed() {
      dirty = false
    },
  }
}
