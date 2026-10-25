// Closing a sheet or dialog by a click on its backdrop (#390). It closes only
// when the press started on the backdrop too: a press that starts inside and
// ends outside (a drag, selecting text) is no close. A sheet with something
// the Member typed in it ignores outside clicks altogether, so it can't lose
// the text by accident. ✕, Escape, "Abbrechen" and the handle always close.

export interface BackdropPress {
  // The pointer went down on the backdrop itself.
  startedOnBackdrop: boolean
  // Something was typed into the sheet since it opened.
  typed: boolean
}

export function closesOnBackdrop({ startedOnBackdrop, typed }: BackdropPress): boolean {
  return startedOnBackdrop && !typed
}

// Whether a text field inside `root` holds something. Checkboxes, switches,
// buttons and the like don't count.
const TEXT_INPUT_TYPES = new Set(['text', 'search', 'url', 'email', 'tel', 'number', 'password', 'date', 'time'])
export function hasTypedText(root: ParentNode | null): boolean {
  if (!root) return false
  return [...root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')].some((field) => {
    if (field instanceof HTMLTextAreaElement) return field.value.trim() !== ''
    return TEXT_INPUT_TYPES.has(field.type) && field.value.trim() !== ''
  })
}
