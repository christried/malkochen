<script setup lang="ts">
// The menu on a Planned Dish (handoff PlannedDishMenu), opened by its "⋯": move
// it to another day, up or down within its day, or take it off the plan. The
// Dish stays on the Board, so taking it off asks nothing; the toast offers
// "Rückgängig". "Nach oben" is off on the day's first, "Nach unten" on its
// last; both still work on a past day. "Wer kocht?" comes first (the
// `before` slot) with the next ticket (#518).
//
// A menu (WAI-ARIA APG): the arrows go round the rows, Home and End jump,
// Enter or Space choose.
defineProps<{
  // The day it lies on, in words, for the line under the sheet's title.
  subtitle: string
  first: boolean
  last: boolean
}>()
const emit = defineEmits<{
  move: []
  up: []
  down: []
  remove: []
}>()
const t = useStrings()
const menu = useTemplateRef<HTMLElement>('menu')

const rows = () => [...menu.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []]
function onKeydown(event: KeyboardEvent) {
  const all = rows()
  const current = all.indexOf(document.activeElement as HTMLButtonElement)
  const to = event.key === 'ArrowDown' ? (current + 1) % all.length
    : event.key === 'ArrowUp' ? (current - 1 + all.length) % all.length
      : event.key === 'Home' ? 0
        : event.key === 'End' ? all.length - 1 : -1
  if (to === -1) return
  event.preventDefault()
  all[to]?.focus()
}
function focusFirst() {
  rows()[0]?.focus()
}
defineExpose({ focusFirst })
</script>

<template>
  <div data-testid="planned-dish-menu">
    <p class="mt-1 truncate text-body text-text-muted">
      {{ subtitle }}
    </p>
    <div
      ref="menu"
      role="menu"
      class="mt-3 flex flex-col"
      @keydown="onKeydown"
    >
      <slot name="before" />
      <button
        type="button"
        role="menuitem"
        class="item"
        data-menu-move
        @click="emit('move')"
      >
        <span class="icon">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><rect
            x="4"
            y="5"
            width="16"
            height="15"
            rx="3"
          /><path d="M4 10h16M9 3v4M15 3v4" /></svg>
        </span>
        {{ t.week.moveToDay }}
      </button>
      <button
        type="button"
        role="menuitem"
        class="item"
        :disabled="first"
        data-menu-up
        @click="emit('up')"
      >
        <span class="icon"><AppIcon
          name="up"
          :size="18"
        /></span>
        {{ t.week.moveUp }}
      </button>
      <button
        type="button"
        role="menuitem"
        class="item"
        :disabled="last"
        data-menu-down
        @click="emit('down')"
      >
        <span class="icon"><AppIcon
          name="down"
          :size="18"
        /></span>
        {{ t.week.moveDown }}
      </button>
      <button
        type="button"
        role="menuitem"
        class="item"
        data-menu-remove
        @click="emit('remove')"
      >
        <span class="icon">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            aria-hidden="true"
          ><circle
            cx="12"
            cy="12"
            r="8.5"
          /><path d="M8.5 12h7" /></svg>
        </span>
        {{ t.week.remove }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.item {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 54px;
  padding: 0 4px;
  border-radius: 16px;
  text-align: left;
  font-size: 15.5px;
  font-weight: 600;
  transition: scale var(--dur-tap) var(--ease-tap);
}
.item:active:not(:disabled) {
  scale: .98;
}
.item:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: -2px;
}
.item:disabled {
  opacity: .35;
}
.icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--color-surface-muted);
}
</style>
