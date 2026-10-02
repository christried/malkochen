// The Dish detail's edit mode morph (handoff motion.json "Edit mode morph"):
// "Bearbeiten" morphs the read-only Dish into edit mode's fields, and leaving
// edit mode morphs them back. Both sides mark their fields
// `data-morph-field="<name>"`, in the order they show, the same name for
// what becomes what (the title heading, the title field). Measured before
// the swap, each field after it moves from where its namesake was, or rises
// in if it had none: 380ms with settle, each 60ms after the one before.
// Reduced motion: the fields swap with a 150ms fade.

const FIELD = '[data-morph-field]'
// How far a field with no namesake rises.
const RISE_PX = 12
const REDUCED_FADE_MS = 150

// Where each field inside a root was, by name.
export type FieldPlaces = Map<string, DOMRect>

export function measureFields(root: Element | null): FieldPlaces {
  const places: FieldPlaces = new Map()
  for (const field of fieldsIn(root)) places.set(field.dataset.morphField!, field.getBoundingClientRect())
  return places
}

// Morphs the fields now inside `root` from `places`, where the fields
// before them were.
export function morphFields(root: Element | null, places: FieldPlaces) {
  const reduced = prefersReducedMotion()
  fieldsIn(root).forEach((field, i) => {
    if (reduced) {
      field.animate({ opacity: [0, 1] }, { id: 'edit-morph', duration: REDUCED_FADE_MS, easing: motionEase('fade') })
      return
    }
    const from = places.get(field.dataset.morphField!)
    const at = field.getBoundingClientRect()
    const start = from ? `${from.left - at.left}px ${from.top - at.top}px` : `0 ${RISE_PX}px`
    field.animate({ translate: [start, '0 0'], opacity: [0, 1] }, {
      id: 'edit-morph',
      duration: motionMs('edit-morph'),
      easing: motionEase('settle'),
      delay: i * motionMs('stagger'),
      fill: 'backwards',
    })
  })
}

function fieldsIn(root: Element | null): HTMLElement[] {
  return [...root?.querySelectorAll<HTMLElement>(FIELD) ?? []]
}
