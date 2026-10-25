// PROTOTYPE #392: throwaway, never merge. Dev only. The new screens of
// spec #388 (Changelog page after Winnie's CL-a, Changelog Popup, Notification
// Prompt, Dish Link page, and where the share buttons sit in the Dish detail),
// each in two or three variants on the real pages or on /prototype392/dish.
// The variant of each question lives in the address (?cl= ?popup= ?prompt=
// ?pv= ?share=), switched from the floating bar (Prototype392Bar) too.
// Copy is German and fixed; nothing here is wired to data.

export type P392Question = 'changelog' | 'popup' | 'prompt' | 'dish' | 'share'

export const P392_QUESTIONS: { key: P392Question, label: string, where: string, variants: { key: string, name: string }[] }[] = [
  {
    key: 'changelog',
    label: 'Changelog',
    where: '/changelog',
    variants: [
      { key: 'A', name: 'Heute: Karten mit Versionsname-Zeile' },
      { key: 'B', name: 'Winnie CL-a: große Zahl, Schiene links' },
      { key: 'C', name: 'Winnie CL-a ohne Schiene: Sprungleiste oben' },
    ],
  },
  {
    key: 'popup',
    label: 'Was ist neu',
    where: 'Board, nach neuer Version',
    variants: [
      { key: 'A', name: 'Blatt von unten' },
      { key: 'B', name: 'Mittig mit Topfbert' },
      { key: 'C', name: 'Streifen oben, zusammengefasst' },
    ],
  },
  {
    key: 'prompt',
    label: 'Hinweis',
    where: 'Board, Topfbert fragt',
    variants: [
      { key: 'A', name: 'Karte unten, Topfbert links' },
      { key: 'B', name: 'Karte oben im Board' },
    ],
  },
  {
    key: 'dish',
    label: 'Dish Link',
    where: '/prototype392/dish, ausgeloggt',
    variants: [
      { key: 'A', name: 'Zentrierte Karte, Bild oben' },
      { key: 'B', name: 'Vollbild-Bild, Text darüber' },
      { key: 'C', name: 'Bild oben, Blatt überlappt' },
    ],
  },
  {
    key: 'share',
    label: 'Teilen',
    where: 'Dish-Detail',
    variants: [
      { key: 'A', name: 'Symbole in der Kopfzeile' },
      { key: 'B', name: 'Zwei Pillen unter dem Titel' },
    ],
  },
]

export const P392_PROMPTS = ['push', 'digest'] as const
export type P392Prompt = typeof P392_PROMPTS[number]

// The Changelog's Versions for the popup and the Dish Link prototype (the
// popup's entries come from the real Changelog page's file in the real app).
export const P392_POPUP_ENTRIES = [
  { version: '1.1.0', date: '28.10.26', entries: [
    'Dish Links: Ein Gericht teilen, den Link schicken, auch ohne Anmeldung ansehen.',
    'Kommentare und Bewertungen: Jeder kann sein Urteil zu einem Gericht geben.',
    'Neue Datenschutzerklärung, mit allem, was seit 1.0.0 dazugekommen ist.',
  ] },
  { version: '1.0.1', date: '20.10.26', entries: [
    'Die Schieberegler in den Einstellungen bleiben auch beim Ziehen offen.',
  ] },
]

const KEY = 'prototype-392-picks'

// The variant of one question: the address's, else the one picked before
// (kept for the page's visit), else the first.
export function p392Variant(question: P392Question, query: Record<string, unknown>): string {
  const q = P392_QUESTIONS.find(x => x.key === question)!
  const asked = typeof query[question] === 'string' ? query[question] as string : null
  const pick = asked ?? stored()[question] ?? q.variants[0]!.key
  return q.variants.some(v => v.key === pick) ? pick : q.variants[0]!.key
}

export function p392Remember(question: P392Question, variant: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...stored(), [question]: variant }))
  }
  catch {
    // Without storage the pick lasts until the page reloads.
  }
}

function stored(): Partial<Record<P392Question, string>> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  }
  catch {
    return {}
  }
}
