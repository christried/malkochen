export type ThemePreference = 'light' | 'dark' | 'system'

// The theme a page actually shows.
export type ShownTheme = 'light' | 'dark'

const THEMES: readonly ThemePreference[] = ['light', 'dark', 'system']

// The theme a preference shows on a device that is dark or not.
function shownTheme(preference: ThemePreference, deviceDark: boolean): ShownTheme {
  if (preference !== 'system') return preference
  return deviceDark ? 'dark' : 'light'
}

// <html data-theme> for a preference: none for "system", so tokens.css
// follows the device.
function themeAttribute(preference: ThemePreference): ShownTheme | undefined {
  return preference === 'system' ? undefined : preference
}

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
      // At once, not when the head next renders: the Theme reveal pictures
      // the page right after (utils/theme-reveal.ts).
      if (import.meta.client) showTheme(value)
    },
  })

  return { preference, themes: THEMES }
}

// What useThemeAttribute renders, on the page as it is.
function showTheme(preference: ThemePreference) {
  const value = themeAttribute(preference)
  if (value) document.documentElement.dataset.theme = value
  else delete document.documentElement.dataset.theme
}

// The theme a preference shows on this device right now.
export function themeShownFor(preference: ThemePreference): ShownTheme {
  return shownTheme(preference, matchMedia('(prefers-color-scheme: dark)').matches)
}

// The theme actually shown: the preference, or the device's for "system".
// For what CSS can't switch by itself, like which clip file to play.
export function useResolvedTheme() {
  const { preference } = useTheme()
  const deviceDark = useMediaQuery('(prefers-color-scheme: dark)')
  return computed(() => shownTheme(preference.value, deviceDark.value))
}

// Called once, from app.vue: reflects the preference on <html>.
export function useThemeAttribute() {
  const { preference } = useTheme()
  useHead({
    htmlAttrs: {
      'data-theme': computed(() => themeAttribute(preference.value)),
    },
  })
}
