import { parseChangelog, type Changelog } from '~~/shared/changelog'
import type { Language } from '~~/shared/language'
import english from '~~/CHANGELOG.md?raw'
import german from '~~/CHANGELOG.de.md?raw'
import italian from '~~/CHANGELOG.it.md?raw'

// The Changelog files at the repo root, parsed when the app is built: what
// the Changelog page and the Changelog Popup both read, so they never differ.
const CHANGELOGS: Record<Language, Changelog> = {
  en: parseChangelog(english),
  de: parseChangelog(german),
  it: parseChangelog(italian),
}

export function changelogFor(language: Language): Changelog {
  return CHANGELOGS[language]
}
