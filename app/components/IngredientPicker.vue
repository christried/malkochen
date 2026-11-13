<script setup lang="ts">
// "Auf die Einkaufsliste" (#537): a Dish's Ingredients, all ticked, in the
// Recipe's order, inside a PickerSurface (a sheet on a phone, a popover on
// desktop; the Dish's header comes from the page). The Member unticks what
// they have at home; the confirm says how many go on and is off at 0. Each
// line is a big row to tap, like a line of the Shopping List itself.
const props = defineProps<{
  open: boolean
  ingredients: string[]
}>()
const emit = defineEmits<{ pick: [lines: { line: number, text: string }[]] }>()
const t = useStrings()

const chosen = ref<boolean[]>([])
// Every time it opens, all are ticked again.
watch(() => [props.open, props.ingredients] as const, ([open]) => {
  if (open) chosen.value = props.ingredients.map(() => true)
}, { immediate: true })
const count = computed(() => chosen.value.filter(Boolean).length)

function toggle(index: number) {
  hapticTick()
  chosen.value[index] = !chosen.value[index]
}
function confirm() {
  if (count.value === 0) return
  emit('pick', props.ingredients.flatMap((text, line) => chosen.value[line] ? [{ line, text }] : []))
}
</script>

<template>
  <div
    class="flex min-h-0 flex-col"
    data-testid="ingredient-picker"
  >
    <p class="text-[14px] font-medium leading-snug text-text-muted">
      {{ t.shopping.pickText }}
    </p>
    <ul class="-mx-2 mt-3 max-h-[50dvh] overflow-y-auto">
      <li
        v-for="(line, i) in ingredients"
        :key="i"
        class="row"
        :style="{ '--i': i }"
      >
        <button
          type="button"
          role="checkbox"
          :aria-checked="chosen[i]"
          class="flex min-h-[50px] w-full items-center gap-3 rounded-[14px] px-2 py-1.5 text-left transition-transform duration-tap ease-tap active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus desktop:min-h-[46px]"
          data-ingredient
          @click="toggle(i)"
        >
          <span
            class="pebble flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-blob border-2"
            :class="chosen[i] ? 'border-transparent bg-tick text-tick-ink' : 'border-text-muted'"
            aria-hidden="true"
          >
            <AppIcon
              v-if="chosen[i]"
              class="check"
              name="check"
              :size="15"
            />
          </span>
          <span
            class="min-w-0 flex-1 break-words text-[16px] font-medium leading-[1.35]"
            :class="{ 'text-text-muted': !chosen[i] }"
          >{{ line }}</span>
        </button>
      </li>
    </ul>
    <button
      type="button"
      class="mt-4 flex h-[54px] w-full items-center justify-center rounded-pill bg-inverse px-5 text-button-l text-on-inverse transition-[transform,opacity] duration-tap ease-tap active:scale-[.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-[.35] disabled:active:scale-100"
      :disabled="count === 0"
      data-put-on-confirm
      @click="confirm"
    >
      {{ t.shopping.putOnConfirm(count) }}
    </button>
  </div>
</template>

<style scoped>
/* On open the lines rise 14px, 40ms apart, the eighth and the rest together
   (settle). The animation starts again each time the popover or sheet shows,
   since a closed one is not rendered. */
.row {
  animation: picker-rise var(--dur-settle) var(--ease-settle) both;
  animation-delay: calc(min(var(--i), 7) * 40ms);
}
@keyframes picker-rise {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
}
.pebble {
  transition: background-color 180ms var(--ease-fade), border-color 180ms var(--ease-fade);
}
/* The check pops in when a line is ticked again (r15-check, loops.css). */
.check {
  animation: r15-check 200ms var(--ease-settle);
}

@media (prefers-reduced-motion: reduce) {
  .row,
  .check {
    animation: none;
  }
}
</style>
