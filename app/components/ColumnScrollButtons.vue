<script setup lang="ts">
// The edge indicators (#208), where the window is too narrow for every
// Column: a button on the Board's left or right edge while Columns are cut off
// that way, which scrolls one Column there. Laid over `scroller` (the
// Columns, scrolling sideways) by a positioned parent; `count` is how many
// Columns there are. Halfway down the window while the Columns reach that
// far, and only as wide as the room beside a Column's cards, so no card is
// under them once the Columns have snapped. Clicks and drags elsewhere pass
// through. Reduced motion: the scroll jumps.
const props = defineProps<{ scroller: HTMLElement | null, count: number }>()

const t = useStrings()

// Whether Columns are cut off before (left) and after (right).
const before = ref(false)
const after = ref(false)
function measure() {
  const el = props.scroller
  if (!el) return
  before.value = el.scrollLeft > 1
  after.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 1
}

// Where a step is scrolling to, until it has arrived: a second click on the
// way goes on from there, not from wherever the scroll is by then.
let heading: number | undefined
function arrived() {
  heading = undefined
}

watch(() => props.scroller, (el, _, onCleanup) => {
  if (!el) return
  const resized = new ResizeObserver(measure)
  resized.observe(el)
  el.addEventListener('scroll', measure, { passive: true })
  el.addEventListener('scrollend', arrived)
  onCleanup(() => {
    resized.disconnect()
    el.removeEventListener('scroll', measure)
    el.removeEventListener('scrollend', arrived)
  })
}, { immediate: true })
// A Column added or removed changes what is cut off, not the Columns' box.
watch(() => props.count, measure, { flush: 'post' })

// One Column on: to the next place a Column snaps to that way, or to the end.
function step(direction: -1 | 1) {
  const el = props.scroller
  if (!el) return
  const max = el.scrollWidth - el.clientWidth
  const from = heading ?? el.scrollLeft
  const start = el.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(el).scrollPaddingLeft || '0') - el.scrollLeft
  const stops = Array.from(el.querySelectorAll('[data-lane]'), lane => lane.getBoundingClientRect().left - start)
  const left = direction === 1
    ? Math.min(max, stops.find(stop => stop > from + 1) ?? max)
    : stops.findLast(stop => stop < from - 1) ?? 0
  const smooth = !prefersReducedMotion()
  // Without `scrollend`, nothing would say when it has arrived.
  heading = smooth && 'onscrollend' in window ? left : undefined
  el.scrollTo({ left, behavior: smooth ? 'smooth' : 'instant' })
}

// An indicator that goes while it has focus hands it to the other one, so
// the keyboard isn't left with nothing.
const previous = useTemplateRef<HTMLButtonElement>('previous')
const next = useTemplateRef<HTMLButtonElement>('next')
watch([before, after], async ([isBefore, isAfter]) => {
  const focused = document.activeElement
  const other = !isBefore && focused === previous.value ? next : !isAfter && focused === next.value ? previous : null
  if (!other) return
  await nextTick()
  other.value?.focus({ preventScroll: true })
})

const edgeButton = 'pointer-events-auto flex h-16 w-7 items-center justify-center bg-surface text-text-muted shadow-card transition-[scale,color] duration-tap ease-tap hover:text-text active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-[1]">
    <div class="sticky top-[calc(50vh-2rem)] flex h-16">
      <Transition name="edge">
        <button
          v-if="before"
          ref="previous"
          type="button"
          class="hover-grow origin-left rounded-r-full"
          :class="edgeButton"
          :aria-label="t.board.previousColumn"
          :data-tooltip="t.board.previousColumn"
          @click="step(-1)"
        >
          <AppIcon name="back" />
        </button>
      </Transition>
      <Transition name="edge">
        <button
          v-if="after"
          ref="next"
          type="button"
          class="hover-grow ml-auto origin-right rounded-l-full"
          :class="edgeButton"
          :aria-label="t.board.nextColumn"
          :data-tooltip="t.board.nextColumn"
          @click="step(1)"
        >
          <AppIcon
            name="back"
            class="-scale-x-100"
          />
        </button>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.edge-enter-active,
.edge-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.edge-enter-from,
.edge-leave-to {
  opacity: 0;
}
</style>
