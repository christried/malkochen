import type { FocusTarget } from '~/board/board-module'

// The element a focus target from the client Board module stands for: a
// Dish's card, or a Column.
export function focusTargetId(target: FocusTarget): string {
  return 'dish' in target ? `dish-${target.dish}` : `column-${target.column}`
}
