import type { DishView } from '~~/server/utils/dishes'

// PROTOTYPE #330: throwaway, never merge. Dev only. Three design questions
// of the Dish life spec (#318), each answered by variants on the real pages,
// switched from a floating bar (Prototype330Bar) or by ?card= / ?verlauf= /
// ?toast=. ?bar=0 hides the bar (for screenshots). The choice lives in
// sessionStorage, so it survives opening a Dish and going back.
//
// Votes and Comments don't exist yet: what the card and the Verlauf show of
// them is made up per Dish (fakeLife, fakeHistory), from its title, so the
// same Dish always looks the same.

export type P330Question = 'card' | 'verlauf' | 'toast'

export const P330_QUESTIONS: { key: P330Question, label: string, where: string, variants: { key: string, name: string }[] }[] = [
  {
    key: 'card',
    label: 'Karte',
    where: 'Board',
    variants: [
      { key: 'A', name: 'Leise Zeile: Symbole unten' },
      { key: 'B', name: 'Auf dem Bild: Glas-Chip' },
      { key: 'C', name: 'Kiesel: bunte Zähler unten' },
    ],
  },
  {
    key: 'verlauf',
    label: 'Verlauf',
    where: 'Dish öffnen, ganz unten',
    variants: [
      { key: 'A', name: 'Chat: Sprechblasen' },
      { key: 'B', name: 'Zeitleiste: Linie mit Punkten' },
      { key: 'C', name: 'Karten: wie der Kochverlauf heute' },
    ],
  },
  {
    key: 'toast',
    label: 'Gekocht-Toast',
    where: 'Gekocht ✓ auf einer Karte',
    variants: [
      { key: 'A', name: 'Eine Pille, darf umbrechen' },
      { key: 'B', name: 'Zwei Zeilen: „Wie war’s?“' },
      { key: 'C', name: 'Eine Zeile, Kommentieren als Symbol' },
    ],
  },
]

const STORAGE_KEY = 'prototype-330-picks'

function stored(): Partial<Record<P330Question, string>> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}')
  }
  catch {
    return {}
  }
}

export function useP330() {
  // The address's picks already on the server, so the page renders with them.
  const state = useState<Record<P330Question, string>>('prototype-330', () => {
    const query = useRoute().query
    const pick = (key: P330Question) => {
      const asked = query[key]
      return typeof asked === 'string' && P330_QUESTIONS.find(q => q.key === key)!.variants.some(v => v.key === asked) ? asked : 'A'
    }
    return { card: pick('card'), verlauf: pick('verlauf'), toast: pick('toast') }
  })
  const question = useState<P330Question>('prototype-330-question', () => 'card')
  const barShown = useState('prototype-330-bar', () => useRoute().query.bar !== '0')

  function set(key: P330Question, variant: string) {
    state.value = { ...state.value, [key]: variant }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state.value))
    }
    catch {
      // Without storage the pick lasts until the page reloads.
    }
  }

  function restore(query: Record<string, unknown>) {
    const saved = stored()
    for (const q of P330_QUESTIONS) {
      const asked = typeof query[q.key] === 'string' ? query[q.key] as string : null
      const pick = asked ?? saved[q.key]
      if (pick && q.variants.some(v => v.key === pick)) set(q.key, pick)
    }
    if (query.bar === '0') barShown.value = false
  }

  return { state, question, barShown, set, restore }
}

// For the components: the variant of one question, null outside dev (then
// the app is as it is today).
export function useP330Variant(key: P330Question) {
  if (!import.meta.dev) return computed(() => null)
  const { state } = useP330()
  return computed(() => state.value[key])
}

// What a Dish's card shows of its life: its Votes (how many up, how many
// down), its Comments and whether there's anything new in its Verlauf since
// you last opened it.
export interface FakeLife {
  up: number
  down: number
  comments: number
  unread: boolean
}

// The screenshot Board's Dishes (tests/e2e/prototype330.spec.ts) get a life
// picked for them; any other Dish one from its title.
const PICKED: Record<string, FakeLife> = {
  'Cremige Pilzpasta': { up: 4, down: 1, comments: 3, unread: true },
  'Linsen-Dal mit Kokosmilch': { up: 3, down: 0, comments: 0, unread: false },
  'Shakshuka': { up: 0, down: 0, comments: 2, unread: true },
  'Ofengemüse mit Tahini und einer sehr langen Beschreibung': { up: 2, down: 2, comments: 12, unread: false },
  'Kimchi-Pfannkuchen': { up: 0, down: 0, comments: 0, unread: false },
  'Gnocchi aus dem Ofen': { up: 1, down: 3, comments: 1, unread: true },
}

function hash(text: string): number {
  let h = 0
  for (const char of text) h = (h * 31 + char.charCodeAt(0)) >>> 0
  return h
}

export function fakeLife(dish: Pick<DishView, 'title' | 'cookings'>): FakeLife {
  const picked = PICKED[dish.title]
  const cooked = dish.cookings.length > 0
  if (picked) return cooked ? picked : { ...picked, up: 0, down: 0 }
  const h = hash(dish.title)
  return {
    up: cooked ? h % 4 : 0,
    down: cooked ? (h >> 3) % 2 : 0,
    comments: (h >> 5) % 5,
    unread: (h >> 7) % 3 === 0,
  }
}

// The Dish History's entries, oldest first.
export interface Person { name: string, image: string | null }
export type HistoryEntry =
  | { kind: 'added', at: Date, by: Person | null }
  | { kind: 'cooking', at: Date, by: Person | null, cookingId: string }
  | { kind: 'vote', at: Date, by: Person, up: boolean, mine: boolean }
  | { kind: 'comment', at: Date, by: Person | null, text: string, edited: boolean, mine: boolean, unread: boolean }

const OTHERS: Person[] = [
  { name: 'Ada', image: null },
  { name: 'Ben', image: null },
  { name: 'Mira', image: null },
  { name: 'Jo', image: null },
]

const TEXTS = [
  'Hab statt Sahne Hafercuisine genommen, klappt super.',
  'Nächstes Mal mehr Knoblauch!',
  'Wollen wir das am Freitag machen?',
  'War mir ein bisschen zu salzig, aber die Soße war der Hammer.',
  'Mit frischem Koriander obendrauf noch besser.',
  'Die Kinder haben zweimal nachgenommen 😄',
  'Bei mir hat es 10 Minuten länger im Ofen gebraucht.',
  'Lecker, aber viel Abwasch.',
  'Hat jemand die Tahini-Soße ohne Zitrone probiert?',
  'Unbedingt wieder!',
  'Rezept halbiert, reicht für zwei.',
  'Ich bring nächstes Mal Brot mit.',
]

// Made up around what the Dish really has (added, its Cookings): Comments
// and Votes by other Members and by you, as many as fakeLife says, between
// them. The last ones are "unread" when fakeLife says so.
export function fakeHistory(dish: DishView, me: Person | null): HistoryEntry[] {
  const life = fakeLife(dish)
  const added = new Date(dish.createdAt)
  const cookings = [...dish.cookings].reverse()
  const entries: HistoryEntry[] = [{ kind: 'added', at: added, by: dish.addedBy }]
  for (const c of cookings) entries.push({ kind: 'cooking', at: new Date(c.cookedAt), by: c.recordedBy, cookingId: c.id })

  const h = hash(dish.title)
  const start = added.getTime()
  const end = Date.now() - 20 * 60_000
  const firstCooking = cookings[0] ? new Date(cookings[0].cookedAt).getTime() : null
  const span = Math.max(end - start, 60_000)
  const comments = Math.min(life.comments, 6)
  for (let i = 0; i < comments; i++) {
    const at = new Date(start + span * ((i + 1) / (comments + 1)) + ((h >> i) % 50) * 60_000)
    const mine = me && i === 1
    entries.push({
      kind: 'comment',
      at,
      by: mine ? me : OTHERS[(h + i) % OTHERS.length]!,
      text: TEXTS[(h + i * 5) % TEXTS.length]!,
      edited: i === 0 && comments > 1,
      mine: !!mine,
      unread: life.unread && i === comments - 1,
    })
  }
  if (firstCooking) {
    const votes = Math.min(life.up + life.down, 5)
    const after = Math.max(end - firstCooking, 60_000)
    for (let i = 0; i < votes; i++) {
      const mine = me && i === 0
      entries.push({
        kind: 'vote',
        at: new Date(firstCooking + after * ((i + 0.5) / (votes + 1)) + 30 * 60_000),
        by: mine ? me : OTHERS[(h + i + 1) % OTHERS.length]!,
        up: i < life.up,
        mine: !!mine,
      })
    }
  }
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime())
}

// "18:42", for an entry of today; else the day ("3. Okt.").
const TIME = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
export function p330Time(at: Date): string {
  return TIME.format(at)
}
export function p330IsToday(at: Date): boolean {
  return new Date().toDateString() === at.toDateString()
}

// The prototype's own Vote on a Dish (the Verlauf and the Gekocht toast),
// per Dish id; kept until the page reloads.
export function useP330MyVote(dishId: () => string) {
  const votes = useState<Record<string, 'up' | 'down' | null>>('prototype-330-votes', () => ({}))
  return computed({
    get: () => votes.value[dishId()] ?? null,
    set: (vote) => {
      votes.value = { ...votes.value, [dishId()]: vote }
    },
  })
}
