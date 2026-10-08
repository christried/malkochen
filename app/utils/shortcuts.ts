// The Board's keyboard shortcuts (#182): one list, which the Board acts on
// and which both the "?" dialog and your settings explain (ShortcutList),
// so they can't drift apart. Each action's line is in the UI strings
// (`shortcuts.does`).
//
// They work at any width, whenever a keyboard sends the keys; never while
// typing in a field, never while a dialog or the side panel is open (a
// native <dialog> closes itself on Escape), never with Ctrl, Alt or Cmd
// held, so the browser's own shortcuts keep working, and a key held down
// counts once. Shift is fine: "?" and, on German keyboards, "/" need it.

export type ShortcutAction = 'addDish' | 'search' | 'close' | 'boardSettings' | 'switchBoard' | 'help'

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

// `keys` as they are shown (one key, or the first and last of a range);
// `sent`, the KeyboardEvent keys that are it.
export const SHORTCUTS: readonly { keys: readonly string[], sent: readonly string[], action: ShortcutAction }[] = [
  { keys: ['N'], sent: ['n', 'N'], action: 'addDish' },
  { keys: ['/'], sent: ['/'], action: 'search' },
  { keys: ['Esc'], sent: ['Escape'], action: 'close' },
  { keys: [','], sent: [','], action: 'boardSettings' },
  { keys: ['1', '9'], sent: DIGITS, action: 'switchBoard' },
  { keys: ['?'], sent: ['?'], action: 'help' },
]

// What a key press is: an action, and for switchBoard which Board, counted
// from 0 in the Board switcher's order.
export type Shortcut = { action: Exclude<ShortcutAction, 'switchBoard'> } | { action: 'switchBoard', board: number }

export interface KeyPress {
  key: string
  ctrlKey: boolean
  altKey: boolean
  metaKey: boolean
  repeat: boolean
}

export function shortcutFor(press: KeyPress, { inField, modalOpen }: { inField: boolean, modalOpen: boolean }): Shortcut | null {
  if (inField || modalOpen || press.ctrlKey || press.altKey || press.metaKey || press.repeat) return null
  const action = SHORTCUTS.find(s => s.sent.includes(press.key))?.action
  if (!action) return null
  return action === 'switchBoard' ? { action, board: DIGITS.indexOf(press.key) } : { action }
}
