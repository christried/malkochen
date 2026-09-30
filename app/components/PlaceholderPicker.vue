<script setup lang="ts">
import { PLACEHOLDERS, type Placeholder } from '~~/shared/placeholders'

// A grid of Placeholder Images with the current one selected (handoff
// PlaceholderPicker, stills only until the loops land): all 16 by default, or
// the few the inline variant passes in.
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
      v-for="placeholder in options"
      ref="tiles"
      :key="placeholder"
      type="button"
      role="radio"
      :aria-checked="selected === placeholder"
      :aria-label="t.placeholders[placeholder]"
      :tabindex="tabStop === placeholder ? 0 : -1"
      class="relative aspect-square overflow-hidden rounded-thumb bg-surface-muted transition-transform duration-pop ease-pop focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :class="selected === placeholder ? '-rotate-[1.5deg] scale-105 ring-[3px] ring-inverse' : 'active:scale-95'"
      @click="selected = placeholder"
    >
      <PlaceholderStill :placeholder="placeholder" />
      <span
        v-if="selected === placeholder"
        aria-hidden="true"
        class="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-inverse text-on-inverse"
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
