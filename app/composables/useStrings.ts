import { stringsFor, type Strings } from '~/strings'

// The single entry point for UI text: the strings of the language shown
// right now (useLanguage). Read as `t.section.key` while rendering (in a
// template, a computed, useHead's getters), so picking another language in
// Your Settings changes what is shown at once, without a reload. A section
// kept in a variable stays in the language it was read in.
export function useStrings(): Strings {
  const language = useLanguage()
  return new Proxy({} as Strings, {
    get: (_, section) => stringsFor(language.value)[section as keyof Strings],
  })
}
