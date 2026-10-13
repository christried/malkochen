import type { FocusTarget } from '~/board/board-module'

// The element a focus target from the client Board module stands for: a
// Dish's card, or a Column.
function focusTargetId(target: FocusTarget): string {
  return 'dish' in target ? `dish-${target.dish}` : `column-${target.column}`
}

// Puts focus on what a focus target stands for, once the DOM shows the
// change that led to it.
export async function focusOn(target: FocusTarget) {
  await nextTick()
  document.getElementById(focusTargetId(target))?.focus()
}
