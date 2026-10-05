import type { Ref } from 'vue'

// Whether a line-clamped element cuts its text off. That changes with the
// element's width, its text and the font arriving, so it is measured again
// on each. One ResizeObserver and one font listener serve every element: a
// Board can show hundreds of cards.
const measures = new Map<Element, () => void>()
let resizes: ResizeObserver | undefined

function measureAll() {
  for (const measure of measures.values()) measure()
}

function watchElement(el: Element, measure: () => void) {
  if (!resizes) {
    resizes = new ResizeObserver(entries => entries.forEach(entry => measures.get(entry.target)?.()))
    document.fonts.addEventListener('loadingdone', measureAll)
  }
  measures.set(el, measure)
  resizes.observe(el)
}

function unwatchElement(el: Element) {
  measures.delete(el)
  resizes?.unobserve(el)
}

export function useTextCut(el: Readonly<Ref<HTMLElement | null>>, text: () => string) {
  const cut = ref(false)
  // A clamped element overflows by at least a line; its rounded heights can
  // differ by 1px without any line cut off.
  const measure = () => {
    if (el.value) cut.value = el.value.scrollHeight > el.value.clientHeight + 1
  }
  let watched: Element | undefined
  onMounted(() => {
    watched = el.value ?? undefined
    if (watched) watchElement(watched, measure)
  })
  watch(text, measure, { flush: 'post' })
  onBeforeUnmount(() => {
    if (watched) unwatchElement(watched)
  })
  return cut
}
