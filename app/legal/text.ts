import type { Language } from '../../shared/language'

// A legal text as the pages show it (pages/impressum.vue, pages/datenschutz.vue,
// components/LegalText.vue). A block is a paragraph, or a list of items. Inside
// a paragraph or an item, **text** is set bold and nothing else is marked up.

export type LegalBlock = string | { list: string[] }

export interface LegalSection {
  heading: string
  blocks: LegalBlock[]
}

export interface LegalText {
  language: Language
  // Whether this text alone is legally binding (the German Datenschutz).
  binding: boolean
  // The page's heading, and under it a line on what this version is.
  title: string
  note: string
  sections: LegalSection[]
}
