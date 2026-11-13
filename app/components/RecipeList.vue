<script setup lang="ts">
// One list of a Recipe in the Dish detail (handoff RecipeList; CONTEXT.md:
// Ingredient, Step): "Zutaten" with a butter pebble before each line, or
// "Schritte" with each numbered in a pebble of its own. A card with its
// heading and how many lines it holds. Static: no hover, no press, never
// folded or clamped, however long. Lines are plain text. `arriving`: a Recipe
// just found while the Member watched (RecipeSection): the card rises after
// `card` ms and its lines after `lines` ms, 60ms apart, the ninth and later
// with the eighth (handoff: A found Recipe arrives).
const props = defineProps<{ kind: 'ingredients' | 'steps', lines: readonly string[], arriving?: { card: number, lines: number } | null }>()
const t = useStrings()
const headingId = useId()
const ingredients = computed(() => props.kind === 'ingredients')
const cardArrival = computed(() => props.arriving ? { animation: `r13-card 480ms var(--ease-settle) ${props.arriving.card}ms both` } : undefined)
const lineArrival = (i: number) => props.arriving ? { animation: `r13-in 420ms var(--ease-settle) ${props.arriving.lines + Math.min(i, 7) * 60}ms both` } : undefined
</script>

<template>
  <section
    :aria-labelledby="headingId"
    class="bg-surface px-[18px] pb-1.5 pt-4 shadow-card"
    :class="ingredients ? 'rounded-card' : 'steps-card pb-2'"
    :style="cardArrival"
    :data-recipe-list="kind"
  >
    <div class="flex items-baseline gap-2 pb-1.5">
      <h3
        :id="headingId"
        class="font-display text-[21px] font-medium leading-[1.15]"
      >
        {{ ingredients ? t.recipe.ingredients : t.recipe.steps }}
      </h3>
      <span
        class="text-label text-text-muted"
        data-recipe-count
      >{{ lines.length }}</span>
    </div>
    <ul
      v-if="ingredients"
      class="m-0 list-none p-0"
    >
      <li
        v-for="(line, i) in lines"
        :key="i"
        class="flex gap-3 pb-[11px] pt-2.5"
        :class="{ 'border-t border-line': i > 0 }"
        :style="lineArrival(i)"
        data-recipe-line
      >
        <i
          aria-hidden="true"
          class="mt-[9px] h-2 w-2 shrink-0 rounded-blob bg-butter"
        />
        <span class="min-w-0 flex-1 text-recipe [overflow-wrap:anywhere] [text-wrap:pretty]">{{ line }}</span>
      </li>
    </ul>
    <ol
      v-else
      class="m-0 list-none p-0"
    >
      <li
        v-for="(line, i) in lines"
        :key="i"
        class="flex gap-3.5 pb-3.5 pt-[13px]"
        :class="{ 'border-t border-line': i > 0 }"
        :style="lineArrival(i)"
        data-recipe-line
      >
        <span
          aria-hidden="true"
          class="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-blob bg-surface-muted font-display text-recipe-num"
        >{{ i + 1 }}</span>
        <span class="min-w-0 flex-1 pt-1 text-recipe [overflow-wrap:anywhere] [text-wrap:pretty]">{{ line }}</span>
      </li>
    </ol>
    <!-- Below the lines, inside the card: the Zutaten card's "Auf die Einkaufsliste" (#537). -->
    <slot />
  </section>
</template>

<style scoped>
/* The Steps' card is the Ingredients' mirrored (handoff RecipeList). */
.steps-card {
  border-radius: 30px 26px 28px 24px;
}
</style>
