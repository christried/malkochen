// Every language's strings, looked up by language (#328): the app reads them
// through useStrings, the server (emails, Push Notifications, its messages)
// through stringsFor. Relative imports, so the server can import it too.
import type { Language } from '../../shared/language'
import { de, type Strings } from './de'
import { en } from './en'
import { it } from './it'

export type { Strings }

const STRINGS: Record<Language, Strings> = { de, en, it }

export function stringsFor(language: Language): Strings {
  return STRINGS[language]
}
