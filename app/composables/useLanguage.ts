import { chooseLanguage, type Language, type LanguageChoice } from '~~/shared/language'

// The user's stored choice under Sprache (/api/me's `language`), kept in step
// by the page guard (middleware/auth.global.ts) on every navigation and by
// Your Settings when it's changed. "auto" before sign-in: then only the
// browser's languages count.
export function useLanguageChoice() {
  return useState<LanguageChoice>('language-choice', () => 'auto')
}

// The browser's preferred languages: on the server its Accept-Language
// header, so the first render is already in the right language; the browser
// carries that on from the server's render, so both agree, and takes
// navigator.languages whenever the device's language changes
// (useLanguageAttribute).
function usePreferredLanguages() {
  return useState<string | readonly string[]>('preferred-languages', () => import.meta.server
    ? useRequestHeaders(['accept-language'])['accept-language'] ?? ''
    : navigator.languages)
}

// The language malkochen is shown in right now (shared/language.ts).
export function useLanguage(): ComputedRef<Language> {
  const choice = useLanguageChoice()
  const preferred = usePreferredLanguages()
  return computed(() => chooseLanguage(choice.value, preferred.value))
}

// Called once, from app.vue: <html lang> follows the language, and with
// "Automatisch" the app follows the device when its language is changed.
export function useLanguageAttribute() {
  const language = useLanguage()
  useHead({ htmlAttrs: { lang: language } })
  const preferred = usePreferredLanguages()
  const follow = () => (preferred.value = [...navigator.languages])
  onMounted(() => addEventListener('languagechange', follow))
  onBeforeUnmount(() => removeEventListener('languagechange', follow))
}
