<script setup lang="ts">
// The handoff's ColumnTabs on phones: a pebble per Column with its Dish
// count. The accent pebble behind the active tab follows a swipe as it
// happens (`progress` is the Column index, fractional mid-swipe) and springs
// into place on release. While a Dish is dragged up to them, the tab under
// it is a drop target. A Dish coming in (`cue`) makes a tab react: dropped
// in, it squashes and bursts; cooked, the Gekocht tab bumps; the Gekocht
// pebble bursts as it lands. A Board still loading (BoardSkeleton) has no
// counts yet.
const props = defineProps<{
  columns: { id: string, name: string, count?: number }[]
  active: number
  progress: number
  // True while a finger drags the Board: the pebble follows without easing.
  following: boolean
  // The Column whose tab a dragged Dish is over, if any.
  dropTarget?: string | null
  // The latest cue; its key changes every time, so a tab reacts again.
  cue?: { value: ColumnCue, key: number } | null
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

// The tab reacting, while it does.
const reacting = ref<ColumnCue | null>(null)
let reactionEnd: ReturnType<typeof setTimeout> | undefined
watch(() => props.cue, async (cue) => {
  reacting.value = null
  clearTimeout(reactionEnd)
  if (!cue) return
  await nextTick()
  reacting.value = cue.value
  reactionEnd = setTimeout(() => (reacting.value = null), motionMs(cue.value.kind === 'bump' ? 'tab-bump' : 'drop-burst'))
})
onBeforeUnmount(() => clearTimeout(reactionEnd))

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
      :data-tab-column-id="column.id"
      data-tour="column"
      :data-tour-column-id="column.id"
      class="tab relative shrink-0 px-4 py-2.5 text-button transition-[scale,rotate,color] duration-settle ease-settle focus-visible:outline-2 focus-visible:outline-focus"
      :class="[
        active === index ? 'is-active text-on-accent' : 'text-text',
        dropTarget && (dropTarget === column.id ? 'is-drop-target text-on-accent' : 'is-dimmed'),
        reacting?.columnId === column.id && `cue-${reacting.kind}`,
      ]"
      :style="{ borderRadius: tabRadius(index), '--accent': columnAccent(index) }"
      @click="emit('select', index)"
    >
      <PebbleBurst
        v-if="reacting?.columnId === column.id && reacting.kind !== 'bump'"
        color="var(--accent)"
      />
      {{ column.name }}
      <RollingCount
        v-if="column.count !== undefined"
        class="opacity-60"
        :value="column.count"
      />
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
/* Under a mouse (a narrow window on a computer), a tab that isn't the
   active one darkens a little. */
@media (hover: hover) and (pointer: fine) {
  .tab:not(.is-active, .is-drop-target):hover::before {
    background: color-mix(in srgb, var(--color-text) 10%, var(--color-surface-muted));
  }
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
/* A dragged Dish over a tab (handoff "Drop target (tab / lane)"): the tab
   grows and fills with its Column's accent, with a glow ring, and wiggles
   every 1.2s; the other tabs dim. Leaving reverses in 200ms. Reduced motion:
   fill and ring only. */
.tab {
  transition-property: scale, rotate, color, opacity;
}
.tab.is-drop-target {
  scale: 1.16;
  box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 35%, transparent);
  animation: tab-wiggle 1.2s var(--ease-idle) infinite;
  transition-duration: var(--dur-fade);
  transition-timing-function: var(--ease-pop);
}
.tab.is-drop-target::before {
  background: var(--accent);
}
.tab.is-dimmed {
  opacity: .45;
  transition-duration: var(--dur-fade);
}
@keyframes tab-wiggle {
  0%, 50%, 100% { rotate: 0deg; }
  12.5% { rotate: -3deg; }
  37.5% { rotate: 3deg; }
}
@media (prefers-reduced-motion: reduce) {
  .tab.is-drop-target {
    scale: 1;
    animation: none;
  }
}
/* A Dish dropped in: the tab squashes (1.32/.84, then .9/1.1, then back)
   and five pebbles burst out of it. Cooked: it bumps to 1.22 (pop). The
   pebble landing: the burst alone. Reduced motion (main.css) skips them. */
.tab.cue-drop {
  animation: tab-squash var(--dur-drop-swallow) var(--ease-settle);
}
.tab.cue-bump {
  animation: tab-bump var(--dur-tab-bump) var(--ease-pop);
}
@keyframes tab-squash {
  30% { scale: 1.32 .84; }
  65% { scale: .9 1.1; }
}
@keyframes tab-bump {
  40% { scale: 1.22; }
}
</style>
