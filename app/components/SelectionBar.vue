<script setup lang="ts">
// The bar at the bottom while Dishes are selected (#218): how many, and
// what can be done with all of them at once, "Gekocht ✓" and "Verschieben"
// (both for whoever may move Dishes) and "Archivieren". Its × ends the
// selection. Shaped like the Toast (handoff Toast colours), which it takes
// the place of; a Toast still showing pushes it up. Each action only if the
// user may take it on all of them (their Permissions). On phones three
// actions leave little room, so the count shows as its number alone there;
// screen readers hear it in full.
defineProps<{ count: number, lifted?: boolean, canMove: boolean, canDelete: boolean }>()
defineEmits<{ cook: [origin: Point], move: [], delete: [], close: [] }>()
const t = useStrings()
</script>

<template>
  <div
    role="toolbar"
    :aria-label="t.selection.label"
    class="selection-bar fixed inset-x-2 bottom-6 z-fab mx-auto flex max-w-md items-center gap-0.5 rounded-pill bg-inverse p-1.5 text-on-inverse shadow-fab tablet:inset-x-3 tablet:bottom-8 tablet:max-w-lg tablet:gap-1 tablet:p-2"
    :class="{ lifted }"
    data-selection-bar
  >
    <button
      type="button"
      class="flex h-10 w-9 shrink-0 items-center justify-center rounded-full transition-[scale,background-color] duration-tap ease-tap hover:bg-on-inverse/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      :aria-label="t.selection.close"
      :data-tooltip="t.selection.close"
      @click="$emit('close')"
    >
      <AppIcon
        name="close"
        :size="20"
      />
    </button>
    <p
      class="min-w-0 flex-1 truncate px-1 text-small tabular-nums"
      aria-live="polite"
      data-selection-count
    >
      <span
        class="tablet:hidden"
        aria-hidden="true"
      >{{ count }}</span>
      <span class="sr-only tablet:not-sr-only tablet:whitespace-nowrap">{{ t.selection.count(count) }}</span>
    </p>
    <button
      v-if="canMove"
      type="button"
      class="shrink-0 rounded-pill px-1.5 py-2 text-button tablet:px-3.5 transition-[scale,background-color] duration-tap ease-tap hover:bg-on-inverse/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      :aria-label="t.selection.cookLabel(count)"
      @click="$emit('cook', centreOf(($event.currentTarget as HTMLElement).getBoundingClientRect()))"
    >
      {{ t.selection.cook }}
    </button>
    <button
      v-if="canMove"
      type="button"
      class="shrink-0 rounded-pill px-1.5 py-2 text-button tablet:px-3.5 transition-[scale,background-color] duration-tap ease-tap hover:bg-on-inverse/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      aria-haspopup="dialog"
      @click="$emit('move')"
    >
      {{ t.selection.move }}
    </button>
    <button
      v-if="canDelete"
      type="button"
      class="danger-fill shrink-0 rounded-pill px-2 py-2 text-button tablet:px-3.5 transition-[scale,background-color] duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      @click="$emit('delete')"
    >
      {{ t.selection.delete }}
    </button>
  </div>
</template>

<style scoped>
/* In: up from below, as the Toast comes in. */
.selection-bar {
  transition: translate var(--dur-settle) var(--ease-settle);
  animation: bar-in 380ms var(--ease-sheet);
}
.lifted {
  translate: 0 -76px;
}
@keyframes bar-in {
  from {
    translate: 0 150px;
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes bar-in {
    from {
      opacity: 0;
    }
  }
}
</style>
