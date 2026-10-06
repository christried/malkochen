// The Placeholder Images (CONTEXT.md, ADR 0004): the handoff's 12 vegan dish
// illustrations, in picker order. A Dish stores one of these keys as its
// image; the stills live at /placeholders/<key>-light.svg and <key>-dark.svg.
export const PLACEHOLDERS = [
  'pasta',
  'ramen',
  'bowl',
  'breakfast',
  'burger',
  'tacos',
  'wok',
  'bread',
  'cake',
  'dumplings',
  'smoothie',
  'eintopf',
] as const

export type Placeholder = typeof PLACEHOLDERS[number]

// Every Placeholder Image file exists once per theme.
export const PLACEHOLDER_THEMES = ['light', 'dark'] as const

export type PlaceholderTheme = typeof PLACEHOLDER_THEMES[number]

// The handoff's fallback (illustrations.json autoPick).
export const FALLBACK_PLACEHOLDER: Placeholder = 'bowl'

// The words that name each drawing's dish (illustrations.json autoPick):
// the handoff's own keywords for pasta, bowl and breakfast, and each other
// dish's name with its common kin. The dishes of the images removed in ADR
// 0004 go where their Dishes went: curry to bowl, pizza to bread, porridge to
// breakfast, wrap to tacos. No word is listed twice.
const KEYWORDS: Record<Placeholder, string[]> = {
  pasta: ['pasta', 'spaghetti', 'nudel', 'nudeln', 'rigatoni', 'penne', 'linguine', 'tagliatelle', 'gnocchi', 'lasagne', 'carbonara', 'bolognese', 'pesto', 'mac'],
  ramen: ['ramen', 'pho', 'udon', 'soba', 'laksa', 'nudelsuppe'],
  bowl: ['salat', 'salad', 'bowl', 'buddha', 'poke', 'quinoa', 'couscous', 'bulgur', 'tabouleh', 'grain', 'reis', 'rice', 'curry', 'dal', 'chili', 'falafel'],
  breakfast: ['pancake', 'pfannkuchen', 'frühstück', 'breakfast', 'porridge', 'oats', 'haferflocken', 'müsli', 'granola', 'waffel', 'french toast', 'overnight', 'chia', 'crêpe', 'brunch'],
  burger: ['burger', 'patty'],
  tacos: ['taco', 'burrito', 'quesadilla', 'nachos', 'enchilada', 'fajita', 'wrap'],
  wok: ['wok', 'pfanne', 'stir fry', 'pad thai', 'bratnudeln', 'bratreis'],
  bread: ['brot', 'bread', 'brötchen', 'focaccia', 'baguette', 'toast', 'sandwich', 'pizza', 'flammkuchen'],
  cake: ['kuchen', 'cake', 'torte', 'tarte', 'muffin', 'brownie', 'cookie', 'keks', 'tiramisu', 'crumble', 'dessert'],
  dumplings: ['dumpling', 'gyoza', 'maultasche', 'knödel', 'kloß', 'klöße', 'momo', 'wonton', 'pierogi', 'teigtasche', 'baozi', 'bao'],
  smoothie: ['smoothie', 'shake', 'saft', 'juice', 'lassi'],
  eintopf: ['eintopf', 'suppe', 'soup', 'stew', 'gulasch', 'minestrone', 'ragout'],
}

// A word may carry a plural ending ("Pancakes", "Maultaschen"), and a keyword
// this long may also end a German compound ("Gemüsecurry", "Linsensuppe").
// Shorter ones ("dal", "mac") only count as whole words.
const PLURAL = ['', 's', 'n', 'e', 'en', 'es']
const COMPOUND_MIN = 4

// Lower case, without accents: "Crêpes" and "Crepes" are the same word.
function words(text: string): string[] {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean)
}

const PHRASES = PLACEHOLDERS.flatMap(placeholder =>
  KEYWORDS[placeholder].map(keyword => ({ placeholder, keyword: words(keyword) })))

// How well a word names a keyword's dish: the whole word, the end of it,
// or not at all.
function fit(word: string, keyword: string): number {
  for (const ending of PLURAL) {
    if (word === keyword + ending) return 2
  }
  if (keyword.length < COMPOUND_MIN) return 0
  return PLURAL.some(ending => word.endsWith(keyword + ending)) ? 1 : 0
}

// The first dish named in these words. At one word, a whole word wins over
// a compound's end ("Pfannkuchen" are no "Kuchen"), and of two ends the
// longer.
function named(text: string[]): Placeholder | null {
  for (let i = 0; i < text.length; i++) {
    let best: { placeholder: Placeholder, score: number } | null = null
    for (const { placeholder, keyword } of PHRASES) {
      const last = keyword.length - 1
      if (keyword.slice(0, last).some((part, j) => text[i + j] !== part)) continue
      const word = text[i + last]
      const quality = word === undefined ? 0 : fit(word, keyword[last]!)
      if (quality === 0) continue
      const score = quality * 1000 + keyword.join(' ').length
      if (!best || score > best.score) best = { placeholder, score }
    }
    if (best) return best.placeholder
  }
  return null
}

function pathWords(link: string): string[] {
  try {
    return words(decodeURIComponent(new URL(link).pathname))
  }
  catch {
    return []
  }
}

// The Placeholder Image a new Dish starts with (handoff illustrations.json
// autoPick): the dish its title names, else the one its link's path names
// (a blog's "/vegane-spaghetti-bolognese"), else the fallback.
export function autoPlaceholder(title: string, link: string | null): Placeholder {
  return named(words(title)) ?? (link ? named(pathWords(link)) : null) ?? FALLBACK_PLACEHOLDER
}
