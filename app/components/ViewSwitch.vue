<script setup lang="ts">
import type { BoardViewChoice } from '~/composables/useBoardView'

// The switch between the Columns, the Week Plan and the Shopping List at the
// top of a Board (handoff ViewSwitch): three segments, "Spalten", "Woche" and
// "Einkauf", on a track, the thumb settling under the one shown (480ms). A
// radio group: ← and → move between them. On a phone 40px high on a row of
// its own, from 1200px 44px right after the Board switcher's pill.
const view = defineModel<BoardViewChoice>({ required: true })
const t = useStrings()
const segments = computed(() => [
  { id: 'columns', label: t.week.columns },
  { id: 'week', label: t.week.week },
  { id: 'shopping', label: t.shopping.tab },
] as const)
const order: BoardViewChoice[] = ['columns', 'week', 'shopping']

const buttons = useTemplateRef<HTMLElement>('buttons')

function choose(choice: BoardViewChoice) {
  if (view.value !== choice) {
    hapticTick()
    view.value = choice
  }
}

function onKeydown(event: KeyboardEvent) {
  const by = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
  const next = order[order.indexOf(view.value) + by]
  if (!by || !next) return
  event.preventDefault()
  choose(next)
  buttons.value?.querySelector<HTMLElement>(`[data-view="${next}"]`)?.focus()
}
</script>

<template>
  <div
    ref="buttons"
    role="radiogroup"
    :aria-label="t.week.view"
    class="view-switch relative flex h-10 w-[318px] max-w-full shrink-0 rounded-pill bg-view-track p-[3px] desktop:h-11 desktop:w-[348px]"
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
      class="segment relative z-[1] flex flex-1 items-center justify-center gap-1.5 rounded-pill text-label transition-colors duration-fade ease-fade focus-visible:outline-2 focus-visible:outline-focus"
      :class="view === segment.id ? 'text-text' : 'text-text-muted'"
      @click="choose(segment.id)"
    >
      <svg
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
        <template v-else-if="segment.id === 'week'">
          <rect
            x="4"
            y="5"
            width="16"
            height="15"
            rx="3"
          />
          <path d="M4 10h16M9 3v4M15 3v4" />
        </template>
        <template v-else>
          <path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.6" />
          <circle
            cx="9.5"
            cy="19.5"
            r="1.3"
          />
          <circle
            cx="17"
            cy="19.5"
            r="1.3"
          />
        </template>
      </svg>
      {{ segment.label }}
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
