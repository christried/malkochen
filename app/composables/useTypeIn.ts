// Imported, not auto-imported: its tests run in plain Node (the "client"
// Vitest project).
import { computed, onScopeDispose, ref, shallowRef, watch, type Ref } from 'vue'

// The longest a text takes to type in, however long it is, and the shortest
// step (about a frame).
const MAX_TYPING_MS = 500
const MIN_STEP_MS = 16

// A text typing into a field (handoff "Title types in"). The text itself is
// all there at once; only what the field shows grows, a character (a long
// text: a few) at a time. Any change to the text, typing into the field
// included, and `finish()` show all of it at once.
export function useTypeIn(text: Ref<string>) {
  // The characters while it types in, and how many of them show; null when
  // all of the text does.
  const characters = shallowRef<string[]>([])
  const count = ref<number | null>(null)
  let timer: ReturnType<typeof setTimeout> | undefined

  function finish() {
    clearTimeout(timer)
    count.value = null
  }

  // Types the text in as it is now: nothing for `delayMs`, then a character
  // every `perCharMs`. A long text would take ages that way, so it never
  // takes longer than MAX_TYPING_MS: then it steps about once a frame,
  // several characters at a time. With no time per character (reduced
  // motion), all of it shows at once.
  function start(delayMs: number, perCharMs: number) {
    finish()
    characters.value = graphemes(text.value)
    const total = characters.value.length
    if (perCharMs <= 0 || total === 0) return
    const duration = Math.min(total * perCharMs, MAX_TYPING_MS)
    const interval = Math.max(duration / total, MIN_STEP_MS)
    // One character a step, unless the steps are a frame long: then as many
    // as it takes to be done in `duration`.
    const perStep = Math.max(1, Math.ceil(total * MIN_STEP_MS / duration))
    let shown = 0
    count.value = 0
    const step = () => {
      shown += perStep
      if (shown >= total) return finish()
      count.value = shown
      timer = setTimeout(step, interval)
    }
    timer = setTimeout(step, delayMs + interval)
  }

  // Sync, so setting the text right before start() doesn't finish it.
  watch(text, finish, { flush: 'sync' })
  onScopeDispose(finish)

  const shown = computed({
    get: () => count.value === null ? text.value : characters.value.slice(0, count.value).join(''),
    set: (value: string) => (text.value = value),
  })
  const typing = computed(() => count.value !== null)
  return { shown, typing, finish, start }
}

// What a reader counts as characters, so an emoji (👩‍🍳) never shows in
// half. Browsers without Intl.Segmenter split by code point.
function graphemes(text: string): string[] {
  if (typeof Intl.Segmenter !== 'function') return Array.from(text)
  return Array.from(new Intl.Segmenter().segment(text), part => part.segment)
}
