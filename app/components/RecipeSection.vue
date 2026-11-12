<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'
import { siteOf } from '~/utils/link-guess'
import { prefersReducedMotion } from '~/utils/motion'

// A Dish's Recipe in its detail (handoff RecipeSection; CONTEXT.md: Recipe),
// after the share row and before the Dish History: "Rezept" with
// "Bearbeiten" (for a Member who may edit the Dish) and the Recipe's
// Ingredients and Steps as two lists, each only if it has lines. Under them,
// "Rezept von <site>" for a Recipe found at another page than the Source.
// Without a Recipe a Member who may edit sees only the dashed "Rezept
// hinzufügen", and anyone else nothing at all, not even a gap. A Recipe
// edited while malkochen didn't answer carries "Noch nicht gesendet" on its
// header (`unsent`). Editing is its own mode, which the page opens (`edit`).
// A Recipe taller than two screens with both lists gets the sticky switch
// between them (RecipeSwitch).
const props = defineProps<{ dish: DishView, mayEdit: boolean, unsent: boolean }>()
const emit = defineEmits<{ edit: [] }>()
const t = useStrings()
const headingId = useId()

const recipe = computed(() => props.dish.recipe)
const source = computed(() => recipe.value?.link ? siteOf(recipe.value.link) : '')
// "Rezept von " and what follows the site in the language's sentence, so the
// site alone can be the link.
const sourceLine = computed(() => {
  const text = t.recipe.from(source.value)
  const at = text.lastIndexOf(source.value)
  return { before: text.slice(0, at), after: text.slice(at + source.value.length) }
})

// The sticky switch. It shows once the Ingredients' card has passed under
// the top bar and until the end of the Recipe goes by, and names the list
// being read: the Steps once their card is within 60px of the switch. Read
// from where things are on each scroll of the detail, which is the dialog
// around the section.
const root = useTemplateRef<HTMLElement>('root')
const ingredientsCard = useTemplateRef<HTMLElement>('ingredientsCard')
const stepsCard = useTemplateRef<HTMLElement>('stepsCard')
const end = useTemplateRef<HTMLElement>('end')
// Where the switch sticks (RecipeSwitch: 4.5rem) and how tall it is.
const SWITCH_TOP = 72
const SWITCH_HEIGHT = 46
const bothLists = computed(() => !!recipe.value && recipe.value.ingredients.length > 0 && recipe.value.steps.length > 0)
const tall = ref(false)
const switchShown = ref(false)
const switchActive = ref<'ingredients' | 'steps'>('ingredients')
let scroller: HTMLElement | null = null

function follow() {
  const section = root.value
  const first = ingredientsCard.value
  const second = stepsCard.value
  if (!section || !first || !second || !scroller) {
    switchShown.value = false
    return
  }
  tall.value = section.offsetHeight > 2 * scroller.clientHeight
  const top = scroller.getBoundingClientRect().top
  const line = top + SWITCH_TOP
  switchShown.value = tall.value && first.getBoundingClientRect().top <= line && (end.value?.getBoundingClientRect().bottom ?? 0) > line + SWITCH_HEIGHT
  switchActive.value = second.getBoundingClientRect().top <= line + SWITCH_HEIGHT + 60 ? 'steps' : 'ingredients'
}

let observer: ResizeObserver | undefined
onMounted(() => {
  scroller = root.value?.closest('dialog') ?? null
  scroller?.addEventListener('scroll', follow, { passive: true })
  if (root.value && typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(follow)
    observer.observe(root.value)
  }
  follow()
})
onBeforeUnmount(() => {
  scroller?.removeEventListener('scroll', follow)
  observer?.disconnect()
})
watch(recipe, async () => {
  await nextTick()
  follow()
})

// A tap scrolls to the list's card, 12px under the switch.
function goTo(kind: 'ingredients' | 'steps') {
  const card = kind === 'ingredients' ? ingredientsCard.value : stepsCard.value
  if (!card || !scroller) return
  const top = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - SWITCH_TOP - SWITCH_HEIGHT - 12
  scroller.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

const quietButton = 'transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <section
    v-if="recipe || mayEdit"
    ref="root"
    :aria-labelledby="recipe ? headingId : undefined"
    :aria-label="recipe ? undefined : t.recipe.heading"
    class="flex flex-col gap-3.5 pt-1"
    data-recipe-section
  >
    <!-- Where the Recipe Finder's states go (#504): "Rezept finden" beside
         "Rezept hinzufügen", the search card, none found, failed, quota.
         Nothing fills it yet. -->
    <slot name="finder" />

    <button
      v-if="!recipe"
      type="button"
      class="flex h-[52px] items-center justify-center gap-2 rounded-pill border-2 border-dashed border-line-strong text-button-l text-text"
      :class="quietButton"
      data-edit-recipe
      @click="emit('edit')"
    >
      <AppIcon
        name="plus"
        :size="18"
      />
      {{ t.recipe.add }}
    </button>

    <template v-else>
      <div class="flex min-h-10 items-center gap-2.5">
        <h2
          :id="headingId"
          class="min-w-0 flex-1 font-display text-title-m"
        >
          {{ t.recipe.heading }}
        </h2>
        <Transition name="mark">
          <span
            v-if="unsent"
            class="shrink-0 truncate rounded-pill bg-surface-muted px-2 py-0.5 text-caption text-text-muted"
            data-recipe-unsent
          >{{ t.unsent.notSent }}</span>
        </Transition>
        <button
          v-if="mayEdit"
          type="button"
          class="flex h-[38px] shrink-0 items-center gap-[7px] rounded-pill bg-surface-muted pl-[11px] pr-3.5 text-label text-text"
          :class="quietButton"
          data-edit-recipe
          @click="emit('edit')"
        >
          <svg
            viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            stroke-width="2.3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13 7l4 4" /></svg>
          {{ t.recipe.edit }}
        </button>
      </div>

      <RecipeSwitch
        v-if="bothLists"
        class="-mb-3.5"
        :shown="switchShown"
        :active="switchActive"
        :ingredients="recipe.ingredients.length"
        :steps="recipe.steps.length"
        @go="goTo"
      />
      <div
        v-if="recipe.ingredients.length"
        ref="ingredientsCard"
      >
        <RecipeList
          kind="ingredients"
          :lines="recipe.ingredients"
        />
      </div>
      <div
        v-if="recipe.steps.length"
        ref="stepsCard"
      >
        <RecipeList
          kind="steps"
          :lines="recipe.steps"
        />
      </div>
      <div
        ref="end"
        class="flex min-h-1 items-center gap-[7px] pl-1 text-small text-text-muted"
      >
        <template v-if="source && recipe.link">
          <AppIcon
            name="link"
            :size="15"
            class="shrink-0"
          />
          <span class="min-w-0">{{ sourceLine.before }}<a
            :href="recipe.link"
            target="_blank"
            rel="noopener noreferrer"
            class="font-semibold text-text underline underline-offset-[3px] focus-visible:outline-2 focus-visible:outline-focus"
            data-recipe-source
          >{{ source }}</a>{{ sourceLine.after }}</span>
        </template>
      </div>
    </template>
  </section>
</template>

<style scoped>
/* The unsent mark fades in and out (240ms). */
.mark-enter-active,
.mark-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.mark-enter-from,
.mark-leave-to {
  opacity: 0;
}
</style>
