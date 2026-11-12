<script setup lang="ts">
// The sticky "Zutaten 8 | Schritte 5" pill of a long Recipe (handoff
// RecipeSwitch, interaction "Recipe switch"): under the top bar while the
// Recipe is on screen, it names the list being read and jumps to the other.
// It takes no room of its own: a zero-height sticky row, with the pill
// hanging from it. `shown`: fades in 240ms and settles from 8px above (it
// only fades with reduced motion); hidden, it is out of reach.
defineProps<{ shown: boolean, active: 'ingredients' | 'steps', ingredients: number, steps: number }>()
const emit = defineEmits<{ go: [kind: 'ingredients' | 'steps'] }>()
const t = useStrings()

const KINDS = ['ingredients', 'steps'] as const
</script>

<template>
  <div
    class="recipe-switch sticky top-[4.5rem] z-[1] flex h-0 justify-center"
    :data-shown="shown || undefined"
    :inert="!shown"
    data-recipe-switch
  >
    <div
      class="switch-pill absolute top-0 flex gap-1 rounded-[24px] bg-glass p-1 shadow-card backdrop-blur-md"
      role="group"
      :aria-label="t.recipe.switchLabel"
    >
      <button
        v-for="kind in KINDS"
        :key="kind"
        type="button"
        class="flex h-[38px] items-center gap-[7px] rounded-[19px] px-[15px] text-[14.5px] font-semibold leading-none transition-colors duration-[200ms] ease-in-out focus-visible:outline-2 focus-visible:outline-focus"
        :class="active === kind ? 'bg-inverse text-on-inverse' : 'text-text'"
        :aria-pressed="active === kind"
        :data-recipe-switch-to="kind"
        @click="emit('go', kind)"
      >
        {{ kind === 'ingredients' ? t.recipe.ingredients : t.recipe.steps }}
        <span class="font-medium opacity-70">{{ kind === 'ingredients' ? ingredients : steps }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.switch-pill {
  opacity: 0;
  translate: 0 -8px;
  visibility: hidden;
  transition:
    opacity var(--dur-fade) var(--ease-fade),
    translate var(--dur-fade) var(--ease-fade),
    visibility 0s linear var(--dur-fade);
}
[data-shown] > .switch-pill {
  opacity: 1;
  translate: none;
  visibility: visible;
  transition:
    opacity var(--dur-fade) var(--ease-fade),
    translate var(--dur-fade) var(--ease-fade);
}
/* Reduced motion: it only fades. */
@media (prefers-reduced-motion: reduce) {
  .switch-pill,
  [data-shown] > .switch-pill {
    translate: none;
  }
}
</style>
