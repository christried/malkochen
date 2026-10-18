// The languages malkochen speaks (#317). Italian joins with its strings
// (#327). German stays the source the others are translated from.
export const LANGUAGES = ['de', 'en'] as const
export type Language = typeof LANGUAGES[number]

// What a user picks under Sprache in Your Settings, stored on the user:
// a language, or "auto" (Automatisch, the default), which follows the
// browser's languages.
export const LANGUAGE_CHOICES = ['auto', ...LANGUAGES] as const
export type LanguageChoice = typeof LANGUAGE_CHOICES[number]

// What anyone gets whose browser asks for no language malkochen speaks.
export const FALLBACK_LANGUAGE: Language = 'en'

export function isLanguage(value: unknown): value is Language {
  return (LANGUAGES as readonly unknown[]).includes(value)
}

// A stored choice as the app takes it: anything it doesn't know is "auto".
export function languageChoice(value: unknown): LanguageChoice {
  return isLanguage(value) ? value : 'auto'
}

// The language malkochen shows: the user's stored choice; for "auto" (or
// nothing stored, before sign-in) the first of the browser's preferred
// languages it speaks, else English. `preferred` is the Accept-Language
// header (on the server) or navigator.languages (in the browser).
export function chooseLanguage(choice: string | null | undefined, preferred: string | readonly string[] | null | undefined): Language {
  if (isLanguage(choice)) return choice
  const tags = typeof preferred === 'string' ? acceptedLanguages(preferred) : preferred ?? []
  for (const tag of tags) {
    const primary = tag.split('-')[0]!.trim().toLowerCase()
    if (isLanguage(primary)) return primary
  }
  return FALLBACK_LANGUAGE
}

// An Accept-Language header's languages, the most wanted first ("en-GB;q=0.8,
// de" gives de, then en-GB); those weighted 0 left out.
function acceptedLanguages(header: string): string[] {
  return header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.split(';').map(p => p.trim())
      const weight = params.find(p => /^q=/i.test(p))
      return { tag, index, q: weight ? Number(weight.slice(2)) : 1 }
    })
    .filter(({ tag, q }) => tag !== '' && q > 0)
    .toSorted((a, b) => b.q - a.q || a.index - b.index)
    .map(({ tag }) => tag)
}
