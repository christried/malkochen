<script setup lang="ts">
// The handoff's ColumnTabs on phones: a pebble per Column with its Dish
// count. The accent pebble behind the active tab follows a swipe as it
// happens (`progress` is the Column index, fractional mid-swipe) and springs
// into place on release.
const props = defineProps<{
  columns: { id: string, name: string, count: number }[]
  active: number
  progress: number
  // True while a finger drags the Board: the pebble follows without easing.
  following: boolean
}>()
const emit = defineEmits<{ select: [index: number] }>()

const t = useStrings()

// Each tab by its Column's index, and where it sits in the row, measured so
// the pebble can go between them. Measured again whenever a tab changes size.
const tabs: HTMLButtonElement[] = []
function setTab(index: number, el: unknown) {
  if (el instanceof HTMLButtonElement) tabs[index] = el
}
const rects = ref<{ left: number, width: number }[]>([])
function measure() {
  tabs.length = props.columns.length
  rects.value = tabs.map(tab => ({ left: tab.offsetLeft, width: tab.offsetWidth }))
}
let observer: ResizeObserver | undefined
function observeTabs() {
  observer?.disconnect()
  observer = new ResizeObserver(measure)
  for (const tab of tabs.slice(0, props.columns.length)) observer.observe(tab)
  measure()
}
onMounted(observeTabs)
onBeforeUnmount(() => observer?.disconnect())
watch(() => props.columns.map(c => c.id).join(), () => nextTick(observeTabs))

const pebble = computed(() => {
  const at = clampProgress(props.progress, props.columns.length)
  const from = Math.floor(at)
  const along = at - from
  const a = rects.value[from]
  const b = rects.value[from + 1] ?? a
  if (!a || !b) return null
  return {
    left: `${a.left + (b.left - a.left) * along}px`,
    width: `${a.width + (b.width - a.width) * along}px`,
    background: accentAt(at),
    borderRadius: tabRadius(Math.round(at)),
  }
})

// Keep the active tab in view when the row is wider than the phone.
watch(() => props.active, index => tabs[index]?.scrollIntoView({
  block: 'nearest',
  inline: 'nearest',
  behavior: prefersReducedMotion() ? 'instant' : 'smooth',
}))
</script>

<template>
  <nav
    class="relative flex gap-2 overflow-x-auto py-2"
    :aria-label="t.board.columns"
  >
    <span
      v-if="pebble"
      aria-hidden="true"
      class="tab-pebble absolute inset-y-2"
      :class="{ following }"
      :style="pebble"
    />
    <button
      v-for="(column, index) in columns"
      :ref="el => setTab(index, el)"
      :key="column.id"
      type="button"
      :aria-pressed="active === index"
      :aria-controls="`column-${column.id}`"
      class="tab relative shrink-0 px-4 py-2.5 text-button transition-[scale,rotate,color] duration-settle ease-settle focus-visible:outline-2 focus-visible:outline-focus"
      :class="active === index ? 'is-active text-on-accent' : 'text-text'"
      :style="{ borderRadius: tabRadius(index) }"
      @click="emit('select', index)"
    >
      {{ column.name }}
      <span class="relative inline-block overflow-hidden align-bottom opacity-60">
        <Transition name="count">
          <span
            :key="column.count"
            class="inline-block"
          >{{ column.count }}</span>
        </Transition>
      </span>
    </button>
  </nav>
</template>

<style scoped>
/* Three layers: the tabs' own pebbles at the back, the accent pebble over
   them (so it can slide across the next tab mid-swipe), the labels on top. */
nav {
  isolation: isolate;
}
.tab::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -2;
  border-radius: inherit;
  background: var(--color-surface-muted);
}
/* The active tab is the accent pebble, a little bigger and tilted (handoff:
   active · scale 1.06, −1.5°). Tilting makes it a layer of its own, so its
   own pebble would cover the accent one: it has none. */
.tab.is-active {
  scale: 1.06;
  rotate: -1.5deg;
}
.tab.is-active::before {
  background: transparent;
}
.tab-pebble {
  z-index: -1;
  scale: 1.06;
  rotate: -1.5deg;
  transition:
    left var(--dur-settle) var(--ease-settle),
    width var(--dur-settle) var(--ease-settle),
    background-color var(--dur-settle) var(--ease-fade);
}
.tab-pebble.following {
  transition: none;
}
/* A count that changes rolls 16px up: the new number pops in from below as
   the old one leaves above (handoff: count change · pop). Reduced motion:
   the number just swaps. */
.count-enter-active,
.count-leave-active {
  transition: translate var(--dur-pop) var(--ease-pop), opacity var(--dur-pop) var(--ease-fade);
}
.count-leave-active {
  position: absolute;
  inset-inline-start: 0;
}
.count-leave-to {
  translate: 0 -16px;
  opacity: 0;
}
.count-enter-from {
  translate: 0 16px;
  opacity: 0;
}
</style>
