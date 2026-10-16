<script setup lang="ts">
// The bar at the bottom while Dishes are selected (#218): how many, and
// what can be done with all of them at once, "Verschieben" and "Löschen".
// No "Gekocht": cooking stays one Dish at a time. Its × ends the
// selection. Shaped like the Toast (handoff Toast colours), which it takes
// the place of; a Toast still showing pushes it up.
defineProps<{ count: number, lifted?: boolean }>()
defineEmits<{ move: [], delete: [], close: [] }>()
const t = useStrings()
</script>

<template>
  <div
    role="toolbar"
    :aria-label="t.selection.label"
    class="selection-bar fixed inset-x-3 bottom-6 z-fab mx-auto flex max-w-md items-center gap-1 rounded-pill bg-inverse py-2 pl-2 pr-2 text-on-inverse shadow-fab tablet:bottom-8"
    :class="{ lifted }"
    data-selection-bar
  >
    <button
      type="button"
      class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[scale,background-color] duration-tap ease-tap hover:bg-on-inverse/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
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
      class="min-w-0 flex-1 truncate px-1 text-small"
      aria-live="polite"
      data-selection-count
    >
      {{ t.selection.count(count) }}
    </p>
    <button
      type="button"
      class="shrink-0 rounded-pill px-3.5 py-2 text-button transition-[scale,background-color] duration-tap ease-tap hover:bg-on-inverse/15 active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      aria-haspopup="dialog"
      @click="$emit('move')"
    >
      {{ t.selection.move }}
    </button>
    <button
      type="button"
      class="delete shrink-0 rounded-pill px-3.5 py-2 text-button transition-[scale,background-color] duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
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
/* "Löschen": a filled danger-red pill with white text, darker on hover
   (#280). The light theme's danger red in both themes: dark's coral is too
   light to carry white text (5.3:1 here, 2.3:1 on the coral). */
.delete {
  --fill: #C23B22;
  color: #FFFFFF;
  background: var(--fill);
}
@media (hover: hover) and (pointer: fine) {
  .delete:hover {
    background: color-mix(in oklab, var(--fill) 80%, black);
  }
}
</style>
