<script setup lang="ts">
import { PLACEHOLDERS, type Placeholder } from '~~/shared/placeholders'

// A grid of Placeholder Images with the current one selected (handoff
// PlaceholderPicker): all 16 by default, or the few the inline variant
// passes in. The selected one loops (handoff illustrations.json "picker
// selection"); the rest stay still. Its tiles pop in 40ms apart as it
// appears, and the selected one's check pops (handoff PlaceholderPicker).
const selected = defineModel<Placeholder>({ required: true })
const props = withDefaults(defineProps<{
  label: string
  options?: readonly Placeholder[]
}>(), { options: () => PLACEHOLDERS })
const t = useStrings()

// Radio-group keyboard behaviour: arrows move the selection, one tab stop.
// With the selection outside `options`, the first tile takes the tab stop.
const tiles = useTemplateRef<HTMLButtonElement[]>('tiles')
const tabStop = computed(() => props.options.includes(selected.value) ? selected.value : props.options[0])
function move(step: number) {
  const { options } = props
  const index = (Math.max(options.indexOf(selected.value), 0) + step + options.length) % options.length
  selected.value = options[index]!
  tiles.value?.[index]?.focus()
}
</script>

<template>
  <div
    role="radiogroup"
    :aria-label="label"
    class="grid grid-cols-4 gap-2.5"
    @keydown.right.prevent="move(1)"
    @keydown.down.prevent="move(4)"
    @keydown.left.prevent="move(-1)"
    @keydown.up.prevent="move(-4)"
  >
    <button
      v-for="(placeholder, i) in options"
      ref="tiles"
      :key="placeholder"
      type="button"
      role="radio"
      :aria-checked="selected === placeholder"
      :aria-label="t.placeholders[placeholder]"
      :tabindex="tabStop === placeholder ? 0 : -1"
      class="tile relative aspect-square overflow-hidden rounded-thumb bg-surface-muted transition-transform duration-pop ease-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :style="{ '--i': i }"
      :class="selected === placeholder ? '-rotate-[1.5deg] scale-105 ring-[3px] ring-inverse' : 'active:scale-95'"
      @click="selected = placeholder"
    >
      <PlaceholderClip
        :placeholder="placeholder"
        :motion="selected === placeholder ? 'loop' : null"
      />
      <span
        v-if="selected === placeholder"
        aria-hidden="true"
        class="check absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-inverse text-on-inverse"
      >
        <svg
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="3.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        ><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
    </button>
  </div>
</template>

<style scoped>
.tile {
  animation: tile-pop var(--dur-pop) var(--ease-pop) calc(var(--i) * 40ms) backwards;
}
@keyframes tile-pop {
  from {
    scale: .6;
    opacity: 0;
  }
}
.check {
  animation: check-pop var(--dur-pop) var(--ease-pop);
}
@keyframes check-pop {
  from { scale: 0; }
}
/* Not just shortened by main.css: the delays would still hide the tiles. */
@media (prefers-reduced-motion: reduce) {
  .tile,
  .check {
    animation: none;
  }
}
</style>
