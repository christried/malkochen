export type ThemePreference = 'light' | 'dark' | 'system'

export const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system']

// Light / dark / system, stored in a cookie so the server renders the right
// `data-theme` and the page never flashes the wrong theme. tokens.css does the
// rest: `[data-theme="dark"]` forces dark, `[data-theme="light"]` forces
// light, and no attribute follows prefers-color-scheme ("system").
// One shared state per request/app, so every caller sees the same value.
export function useTheme() {
  const cookie = useCookie<ThemePreference>('malkochen-theme', {
    default: () => 'system',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const state = useState<ThemePreference>('theme', () =>
    THEMES.includes(cookie.value) ? cookie.value : 'system')

  const preference = computed<ThemePreference>({
    get: () => state.value,
    set: (value) => {
      state.value = value
      cookie.value = value
    },
  })

  return { preference, themes: THEMES }
}

// Called once, from app.vue: reflects the preference on <html>.
export function useThemeAttribute() {
  const { preference } = useTheme()
  useHead({
    htmlAttrs: {
      'data-theme': computed(() => preference.value === 'system' ? undefined : preference.value),
    },
  })
}
