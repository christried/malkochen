// The key that, held, adds to a selection with a click: ⌘ on Apple devices,
// Strg everywhere else (in the app's language: Ctrl in English). Strg on the
// server and until mounted, so server and client render the same first.
export function useModifierKey(): Readonly<Ref<string>> {
  const t = useStrings()
  const apple = ref(false)
  onMounted(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform: string } }
    apple.value = /mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform ?? nav.platform)
  })
  return computed(() => apple.value ? '⌘' : t.shortcuts.ctrl)
}
