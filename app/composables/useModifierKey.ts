// The key that, held, adds to a selection with a click: ⌘ on Apple devices,
// Strg everywhere else. Strg on the server and until mounted, so server and
// client render the same first.
export function useModifierKey(): Readonly<Ref<string>> {
  const t = useStrings()
  const key = ref(t.shortcuts.ctrl)
  onMounted(() => {
    const nav = navigator as Navigator & { userAgentData?: { platform: string } }
    if (/mac|iphone|ipad|ipod/i.test(nav.userAgentData?.platform ?? nav.platform)) key.value = '⌘'
  })
  return readonly(key)
}
