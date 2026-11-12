// The pure rules of editing a Recipe's lines (CONTEXT.md: Recipe, Ingredient,
// Step; handoff "Paste lines" and RecipeEditor's rules): what a paste makes of
// its text, where a paste, Enter and Backspace leave the lines and the caret,
// what saving keeps. No Vue and no DOM, so it runs in Node under test.
import { RECIPE_LIMITS } from '../../shared/recipe'

export type RecipeKind = 'ingredients' | 'steps'

// What a list may hold: so many lines of so many characters.
export interface LineLimits {
  lines: number
  characters: number
}

// Where the text cursor stands in a line: `start` to `end` is the selection
// (the same when nothing is selected).
export interface Caret {
  start: number
  end: number
}

// Where the cursor goes after an edit: into which line, and at which
// character of it.
export interface Focus {
  index: number
  caret: number
}

// A leading bullet, dash, star or number ("1." or "1)") with the spaces after it
// (or nothing after it, a line that is only the mark).
const LEADING_MARK = /^(?:[•\-*–]|\d+[.)])(?:\s+|$)/

// The lines a pasted text makes: one per non-empty line, trimmed, each
// without one leading mark. A line that is only a mark is gone.
export function pastedLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map(line => line.trim().replace(LEADING_MARK, '').trim())
    .filter(line => line !== '')
}

// Pasting a text with line breaks into line `index`, the cursor at `caret`:
// the first piece replaces the selection (the text before it stays), the
// rest become new lines below, and the text after the selection goes to the
// end of the last new line. The list takes no more lines than `limits.lines`
// and no line more than `limits.characters` (longer ones are cut there).
// `inserted` is how many pieces found a place (the first included),
// `didNotFit` how many did not. The cursor ends after the pasted text.
export function pasteInto(lines: readonly string[], index: number, caret: Caret, text: string, limits: LineLimits): { lines: string[], inserted: number, didNotFit: number, focus: Focus } {
  const pieces = pastedLines(text)
  if (pieces.length === 0) return { lines: [...lines], inserted: 0, didNotFit: 0, focus: { index, caret: caret.end } }
  const current = lines[index] ?? ''
  const before = current.slice(0, caret.start)
  const after = current.slice(caret.end)
  const cut = (line: string) => line.slice(0, limits.characters)
  // The line it is pasted into stays, so only the others need room.
  const room = Math.max(0, limits.lines - lines.length)
  const placed = pieces.slice(0, 1 + room)
  const last = placed.length - 1
  const made = placed.map((piece, i) => cut(`${i === 0 ? before : ''}${piece}${i === last ? after : ''}`))
  const lastPiece = placed[last]!
  const reach = (last === 0 ? before.length : 0) + lastPiece.length
  return {
    lines: [...lines.slice(0, index), ...made, ...lines.slice(index + 1)],
    inserted: placed.length,
    didNotFit: pieces.length - placed.length,
    focus: { index: index + last, caret: Math.min(reach, limits.characters) },
  }
}

// Enter in line `index`: the line is split at the cursor (a selection is
// replaced) into itself and a new one below, which the cursor goes to. Null
// when the list is full.
export function enterAt(lines: readonly string[], index: number, caret: Caret, limits: LineLimits): { lines: string[], focus: Focus } | null {
  if (lines.length >= limits.lines) return null
  const current = lines[index] ?? ''
  const next = [...lines]
  next.splice(index, 1, current.slice(0, caret.start), current.slice(caret.end))
  return { lines: next, focus: { index: index + 1, caret: 0 } }
}

// Backspace in the empty line `index`: it goes, and the cursor to the end of
// the line above (the start of the next one for the first). Null for a line
// with text, and for the only line.
export function backspaceOnEmpty(lines: readonly string[], index: number): { lines: string[], focus: Focus } | null {
  if (lines.length < 2 || lines[index] !== '') return null
  const next = lines.filter((_, i) => i !== index)
  return index === 0
    ? { lines: next, focus: { index: 0, caret: 0 } }
    : { lines: next, focus: { index: index - 1, caret: next[index - 1]!.length } }
}

// The lines with the one at `from` moved to `to`; the same lines if either
// is outside them.
export function moveLine(lines: readonly string[], from: number, to: number): string[] {
  const next = [...lines]
  if (from === to || from < 0 || to < 0 || from >= lines.length || to >= lines.length) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

// What Speichern sends: both lists with the lines trimmed and the empty ones
// dropped; null, no Recipe, when nothing is left in either.
export function recipeToSave({ ingredients, steps }: { ingredients: readonly string[], steps: readonly string[] }): { ingredients: string[], steps: string[] } | null {
  const kept = (lines: readonly string[]) => lines.map(line => line.trim()).filter(line => line !== '')
  const saved = { ingredients: kept(ingredients), steps: kept(steps) }
  return saved.ingredients.length === 0 && saved.steps.length === 0 ? null : saved
}

// From which count the editor shows "n von max": the characters of a line
// (a line's counter) and the lines of a list (a list's), a little before
// the limit.
const COUNT_FROM = {
  line: { ingredients: 180, steps: 900 },
  list: { ingredients: 50, steps: 35 },
} as const

export function countShown(what: 'line' | 'list', kind: RecipeKind, count: number): boolean {
  return count >= COUNT_FROM[what][kind]
}

// What a list may hold.
export const limitsOf = (kind: RecipeKind): LineLimits => RECIPE_LIMITS[kind]
