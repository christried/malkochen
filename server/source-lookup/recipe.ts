import { decodeEntities } from './html'
import { hasType, isObject, isRecipe, jsonLdNodes, type Json, type JsonObject } from './json-ld'
import { sentencesOf } from './sentence'
import type { PageRecipe } from './types'

// A schema.org Recipe as a page's recipe (CONTEXT.md: Ingredient, Step): its
// ingredient list and its instructions, each as plain text the way the page
// wrote it. Text is split and tidied, never reworded.

// The first of the page's Recipes that says anything: one with neither
// ingredients nor instructions is no recipe.
export function pageRecipe(recipes: JsonObject[]): PageRecipe | null {
  for (const recipe of recipes) {
    // `ingredients` is what recipeIngredient was called before 2016.
    const ingredients = [recipe.recipeIngredient, recipe.ingredients].map(ingredientsOf).find(found => found.length) ?? []
    const steps = stepsOf(recipe.recipeInstructions)
    if (ingredients.length || steps.length) return { ingredients, steps }
  }
  return null
}

// The recipe a page's HTML carries as schema.org Recipe data, if it does.
export function recipeInPage(html: string): PageRecipe | null {
  return pageRecipe(jsonLdNodes(html).filter(isRecipe))
}

// An ingredient list: a string per Ingredient, or one string with a line each.
function ingredientsOf(value: Json): string[] {
  if (Array.isArray(value)) return value.flatMap(ingredientsOf)
  return typeof value === 'string' ? plainLines(value) : []
}

// Instructions come as one string, a list of strings, a list of steps, or
// steps grouped in sections. Several pieces of text are a Step each, and a
// single one of several lines a Step per line. Only one string on one line
// has its Steps told apart within the line: one per number ("1. … 2. …"),
// else one per sentence.
function stepsOf(instructions: Json): string[] {
  const texts = textsOf(instructions).map(plainLines).filter(lines => lines.length)
  if (texts.length !== 1) return withoutNumbering(texts.map(lines => lines.join(' ')))
  const lines = texts[0]!
  if (lines.length > 1 || typeof instructions !== 'string') return withoutNumbering(lines)
  return numberedParts(lines[0]!) ?? withoutNumbering(sentencesOf(lines[0]!))
}

// The pieces of text in schema.org instructions, in order: a string, a
// HowToStep's text (its name when it has no text), and the steps of a
// HowToSection or an ItemList, whose own names are headings, not Steps.
function textsOf(value: Json): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(textsOf)
  if (!isObject(value)) return []
  if (value.itemListElement !== undefined || hasType(value, 'HowToSection')) return textsOf(value.itemListElement)
  // A ListItem wraps its step.
  if (value.item !== undefined) return textsOf(value.item)
  const text = [value.text, value.name].find(candidate => typeof candidate === 'string' && candidate.trim() !== '')
  return typeof text === 'string' ? [text] : []
}

// Tags that end a line of text.
const LINE_BREAK_TAG = /<(?:br|\/?(?:p|li|ol|ul|div|h[1-6]|tr))\b[^>]*>/gi
// Any other tag. A "<" no letter follows ("< 100 °C") is text.
const TAG = /<\/?[a-z][^>]*>/gi

function withoutTags(html: string): string {
  return html.replace(LINE_BREAK_TAG, '\n').replace(TAG, '')
}

// Text that may hold HTML, as plain lines: tags gone (those that arrive as
// entities, "&lt;p&gt;", too), entities read, spaces tidied, empty lines left
// out.
function plainLines(text: string): string[] {
  return withoutTags(decodeEntities(withoutTags(text)))
    .split(/[\r\n\u2028\u2029]+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

// A number in front of a Step: "1. ", "2) ".
const STEP_NUMBER = String.raw`(\d{1,2})[.)]\s+`

// Steps the page numbered itself ("1. Linsen waschen", "2. Aufkochen"),
// without the numbers, since Steps are shown numbered. Only when every Step
// starts with its own position, so "2 EL Öl dazu" keeps its amount.
function withoutNumbering(steps: string[]): string[] {
  const numbered = steps.map((step, at) => {
    const number = new RegExp(`^${STEP_NUMBER}`).exec(step)
    return number && Number(number[1]) === at + 1 ? step.slice(number[0].length) : null
  })
  return numbered.every(step => step) ? numbered as string[] : steps
}

// "1. Linsen waschen. 2. Aufkochen." → its numbered parts, without the
// numbers; null unless the line starts at 1 and counts up at least to 2.
function numberedParts(line: string): string[] | null {
  // Where each number in turn starts, and where its Step's text does.
  const marks: Array<{ at: number, text: number }> = []
  for (const number of line.matchAll(new RegExp(String.raw`(?<=^|\s)${STEP_NUMBER}`, 'g'))) {
    if (Number(number[1]) === marks.length + 1) marks.push({ at: number.index, text: number.index + number[0].length })
  }
  if (marks.length < 2 || marks[0]!.at !== 0) return null
  const parts = marks.map((mark, at) => line.slice(mark.text, marks[at + 1]?.at).trim())
  return parts.every(Boolean) ? parts : null
}
