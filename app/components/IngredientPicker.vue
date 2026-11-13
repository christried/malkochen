<script setup lang="ts">
// "Auf die Einkaufsliste" (#537): a Dish's Ingredients, all ticked, in the
// Recipe's order, inside a PickerSurface (a sheet on a phone, a popover on
// desktop). The Member unticks what they have at home; the confirm says how
// many go on and is off at 0. Each line is a big row to tap, like a line of
// the Shopping List itself.
const props = defineProps<{
  open: boolean
  // The Dish's title, under the picker's title.
  subtitle: string
  ingredients: string[]
}>()
const emit = defineEmits<{ pick: [lines: string[]] }>()
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
  emit('pick', props.ingredients.filter((_, i) => chosen.value[i]))
}
</script>

<template>
  <div
    class="flex min-h-0 flex-col"
    data-testid="ingredient-picker"
  >
    <p class="text-[14px] font-medium leading-snug text-text-muted">
      {{ subtitle }}. {{ t.shopping.pickText }}
    </p>
    <ul class="-mx-2 mt-2 max-h-[50dvh] overflow-y-auto">
      <li
        v-for="(line, i) in ingredients"
        :key="i"
      >
        <button
          type="button"
          role="checkbox"
          :aria-checked="chosen[i]"
          class="flex min-h-12 w-full items-center gap-3 rounded-[14px] px-2 py-1.5 text-left transition-transform duration-tap ease-tap active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
          data-ingredient
          @click="toggle(i)"
        >
          <span
            class="box flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
            :class="chosen[i] ? 'border-transparent bg-inverse text-on-inverse' : 'border-text-muted'"
            aria-hidden="true"
          >
            <AppIcon
              v-if="chosen[i]"
              name="check"
              :size="16"
            />
          </span>
          <span
            class="min-w-0 flex-1 break-words text-body leading-snug"
            :class="{ 'text-text-muted': !chosen[i] }"
          >{{ line }}</span>
        </button>
      </li>
    </ul>
    <button
      type="button"
      class="mt-3 h-12 w-full rounded-pill bg-inverse px-5 text-button text-on-inverse transition-[transform,opacity] duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40 disabled:active:scale-100"
      :disabled="count === 0"
      data-put-on-confirm
      @click="confirm"
    >
      {{ t.shopping.putOnConfirm(count) }}
    </button>
  </div>
</template>

<style scoped>
.box {
  transition: background-color var(--dur-fade) var(--ease-fade), border-color var(--dur-fade) var(--ease-fade);
}
</style>
