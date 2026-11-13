<script setup lang="ts">
import type { BoardViewChoice } from '~/composables/useBoardView'
import { iconsFit } from '~/utils/view-switch'

// The switch between the Columns, the Week Plan and the Shopping List at the
// top of a Board (handoff ViewSwitch): three segments, "Spalten", "Woche" and
// "Einkauf" (a bag), on a track, the thumb settling under the one shown
// (480ms). A radio group: ← and → cycle through the three. On a phone the
// whole 328px row, 40px high, from 1200px 348 × 44 right after the Board
// switcher's pill. The icons hide, in every segment at once, when a label
// would not fit its third of the track (a long word in some locale).
const view = defineModel<BoardViewChoice>({ required: true })
const t = useStrings()
const language = useLanguage()
const segments = computed(() => [
  { id: 'columns', label: t.week.columns },
  { id: 'week', label: t.week.week },
  { id: 'shopping', label: t.shopping.tab },
] as const)
const order: BoardViewChoice[] = ['columns', 'week', 'shopping']

const buttons = useTemplateRef<HTMLElement>('buttons')

// The server renders the icons; the client takes them away only when a label
// does not fit beside its icon.
const iconsShown = ref(true)
// A 16px icon and the 6px gap after it.
const ICON_SPACE = 22

function measure() {
  const track = buttons.value
  // Not on screen (the other instance of the switch at this width): nothing
  // to measure, and the next resize measures it.
  if (!track || track.clientWidth === 0) return
  // A segment is a third of the track less its 3px padding each side.
  const room = (track.clientWidth - 6) / 3
  const labels = [...track.querySelectorAll<HTMLElement>('.segment-label')]
  iconsShown.value = iconsFit(labels.map(label => ({ content: label.offsetWidth + ICON_SPACE, room })))
}

let observer: ResizeObserver | undefined
onMounted(() => {
  measure()
  observer = new ResizeObserver(() => measure())
  if (buttons.value) observer.observe(buttons.value)
  // A label measured before its font is in is too narrow.
  void document.fonts?.ready.then(measure)
})
onBeforeUnmount(() => observer?.disconnect())
watch(language, measure, { flush: 'post' })

function choose(choice: BoardViewChoice) {
  if (view.value !== choice) {
    hapticTick()
    view.value = choice
  }
}

function onKeydown(event: KeyboardEvent) {
  const by = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  if (!by) return
  event.preventDefault()
  // Past the last segment comes the first, and back.
  const next = order[(order.indexOf(view.value) + by + order.length) % order.length]!
  choose(next)
  buttons.value?.querySelector<HTMLElement>(`[data-view="${next}"]`)?.focus()
}
</script>

<template>
  <div
    ref="buttons"
    role="radiogroup"
    :aria-label="t.week.view"
    class="view-switch relative flex h-10 w-[328px] max-w-full shrink-0 rounded-pill bg-view-track p-[3px] desktop:h-11 desktop:w-[348px]"
    @keydown="onKeydown"
  >
    <span
      aria-hidden="true"
      class="thumb absolute bottom-[3px] left-[3px] top-[3px] w-[calc((100%-6px)/3)] rounded-pill bg-surface shadow-small"
      :class="view"
    />
    <button
      v-for="segment in segments"
      :key="segment.id"
      type="button"
      role="radio"
      :aria-checked="view === segment.id"
      :tabindex="view === segment.id ? 0 : -1"
      :data-view="segment.id"
      class="segment relative z-[1] flex flex-1 items-center justify-center gap-1.5 rounded-pill text-label whitespace-nowrap transition-colors duration-fade ease-fade focus-visible:outline-2 focus-visible:outline-focus"
      :class="view === segment.id ? 'text-text' : 'text-text-muted'"
      @click="choose(segment.id)"
    >
      <template v-if="iconsShown">
        <AppIcon
          v-if="segment.id === 'shopping'"
          name="bag"
          :size="16"
          stroke-width="2.2"
        />
        <svg
          v-else
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <template v-if="segment.id === 'columns'">
            <rect
              x="4"
              y="5"
              width="4.5"
              height="14"
              rx="1.5"
            />
            <rect
              x="10.5"
              y="5"
              width="4.5"
              height="9"
              rx="1.5"
            />
            <rect
              x="17"
              y="5"
              width="3"
              height="12"
              rx="1.5"
            />
          </template>
          <template v-else>
            <rect
              x="4"
              y="5"
              width="16"
              height="15"
              rx="3"
            />
            <path d="M4 10h16M9 3v4M15 3v4" />
          </template>
        </svg>
      </template>
      <span class="segment-label">{{ segment.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.thumb {
  transition: translate var(--dur-settle) var(--ease-settle);
}
.thumb.week {
  translate: 100% 0;
}
.thumb.shopping {
  translate: 200% 0;
}
</style>
