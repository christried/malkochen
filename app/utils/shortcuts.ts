// The Board's keyboard shortcuts (#182): one list, which the Board acts on
// and which both the "?" dialog and your settings explain (ShortcutList),
// so they can't drift apart. Each action's line is in the UI strings
// (`shortcuts.does`).
//
// They work at any width, whenever a keyboard sends the keys; never while
// typing in a field, never while a dialog or the side panel is open (a
// native <dialog> closes itself on Escape), and never with Ctrl, Alt or Cmd
// held, so the browser's own shortcuts keep working. Shift is fine: "?" and,
// on German keyboards, "/" need it.

export type ShortcutAction = 'addDish' | 'search' | 'close' | 'boardSettings' | 'switchBoard' | 'help'

// `keys` as they are shown: one key, or the first and last of a range.
export const SHORTCUTS: readonly { keys: readonly string[], action: ShortcutAction }[] = [
  { keys: ['N'], action: 'addDish' },
  { keys: ['/'], action: 'search' },
  { keys: ['Esc'], action: 'close' },
  { keys: [','], action: 'boardSettings' },
  { keys: ['1', '9'], action: 'switchBoard' },
  { keys: ['?'], action: 'help' },
]

// What a key press is: an action, and for switchBoard which Board, counted
// from 0 in the Board switcher's order.
export type Shortcut = { action: Exclude<ShortcutAction, 'switchBoard'> } | { action: 'switchBoard', board: number }

export interface KeyPress {
  key: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
}

const BY_KEY: Record<string, Exclude<ShortcutAction, 'switchBoard'>> = {
  'n': 'addDish',
  'N': 'addDish',
  '/': 'search',
  'Escape': 'close',
  ',': 'boardSettings',
  '?': 'help',
}

export function shortcutFor(press: KeyPress, { inField, modalOpen }: { inField: boolean, modalOpen: boolean }): Shortcut | null {
  if (inField || modalOpen || press.ctrlKey || press.altKey || press.metaKey) return null
  if (/^[1-9]$/.test(press.key)) return { action: 'switchBoard', board: Number(press.key) - 1 }
  const action = BY_KEY[press.key]
  return action ? { action } : null
}
