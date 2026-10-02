// A text typing into a field (handoff "Title types in"). The text itself is
// all there at once; only what the field shows grows, one character after
// another. Any change to the text, typing into the field included, and
// `finish()` show all of it at once.
export function useTypeIn(text: Ref<string>) {
  // The characters (graphemes, so an emoji never shows half) while it
  // types in, and how many of them show; null when all of the text does.
  let characters: string[] = []
  const count = ref<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function finish() {
    clearTimeout(timer)
    count.value = null
  }

  // Types the text in as it is now: nothing for `delayMs`, then a character
  // every `perCharMs`. With no time per character (reduced motion), all of
  // it shows at once.
  function start(delayMs: number, perCharMs: number) {
    finish()
    characters = Array.from(new Intl.Segmenter().segment(text.value), part => part.segment)
    if (perCharMs <= 0 || characters.length === 0) return
    count.value = 0
    const step = () => {
      count.value = count.value! + 1
      if (count.value >= characters.length) finish()
      else timer = setTimeout(step, perCharMs)
    }
    timer = setTimeout(step, delayMs + perCharMs)
  }

  // Sync, so setting the text right before start() doesn't finish it.
  watch(text, finish, { flush: 'sync' })
  onScopeDispose(finish)

  const shown = computed({
    get: () => count.value === null ? text.value : characters.slice(0, count.value).join(''),
    set: (value: string) => (text.value = value),
  })
  const typing = computed(() => count.value !== null)
  return { shown, typing, finish, start }
}
