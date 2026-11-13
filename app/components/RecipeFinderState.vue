<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'
import { finderShown, type FinderNote } from '~/board/recipe-finder-view'

// What the Dish detail shows in place of a Recipe the Dish doesn't have yet
// (handoff RecipeFinderState, #504; which view: board/recipe-finder-view.ts).
// "Rezept finden" beside "Rezept hinzufügen" for a user with the Recipe
// Finder; "Rezept wird gesucht" for every Member while a search runs, with
// Topfbert stirring; "Kein Rezept gefunden" once it found nothing; and, for
// the user who searched, "Die Suche hat gerade nicht geklappt.", the note
// that the day's cap is reached, or that this Dish was searched twice within
// the hour (these last while the detail stays open).
// One view shows at a time, swapped with a fade. "Rezept finden" needs a
// connection, and a Dish the server has: it is greyed out without either.
// `leaving`: the search is over and a Recipe is coming, so the card goes
// (Topfbert hops, the card shrinks and fades) before the Recipe takes its
// place; RecipeSection holds the Recipe back for that long.
const props = defineProps<{ dish: DishView, mayEdit: boolean, leaving: boolean }>()
const emit = defineEmits<{ edit: [] }>()
const t = useStrings()
const boardModule = useBoardModule()
const syncNow = inject(boardSyncNowKey, () => {})
const { answering } = useConnection()
const finder = useRecipeFinder()

// The Recipe Finder's status is read when the first Dish detail opens, and
// again by Your Settings; it is one for the whole app.
onMounted(() => {
  if (!finder.status.value) void finder.refresh()
})

// What this user's search ended in; reopening the detail forgets it.
const note = ref<FinderNote | null>(null)
watch(() => props.dish.id, () => {
  note.value = null
})

const shown = computed(() => {
  const status = finder.status.value
  const view = finderShown({
    hasRecipe: !props.leaving && !!props.dish.recipe,
    hasSource: !!props.dish.source,
    search: props.leaving ? 'looking' : props.dish.recipeSearch,
    note: note.value,
    finderOn: status?.state === 'on' && status.available,
    mayEdit: props.mayEdit,
  })
  return props.leaving ? { ...view, add: false } : view
})
const mayPress = computed(() => answering.value && !boardModule.isUnsentAdd(props.dish.id))

// "Rezept finden" and "Noch mal suchen". The Board module shows the search
// at once; what it ended in decides what is said. A Dish that changed under
// us (another Member searched first, or changed its Source) is loaded
// afresh and says what it says; the Recipe Finder switched off or without a
// key is read again, so "Rezept finden" goes.
async function find() {
  if (!mayPress.value) return
  note.value = null
  const result = await boardModule.findRecipe(props.dish.id)
  if (result === 'failed' || result === 'quota' || result === 'tooSoon') note.value = result
  else if (result === 'conflict') syncNow()
  else if (result === 'refused') void finder.refresh()
}

const quietButton = 'transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
const buttonShape = 'flex h-[52px] min-w-0 items-center justify-center gap-2 whitespace-nowrap rounded-pill px-3.5 text-button-l text-text'
</script>

<template>
  <div
    class="flex flex-col"
    data-recipe-finder
    :data-view="shown.view"
  >
    <Transition
      name="swap"
      mode="out-in"
    >
      <div
        v-if="shown.view !== 'nothing'"
        :key="shown.view"
        class="flex flex-col gap-3.5"
      >
        <!-- Searching: for every Member. At least as tall as the two stacked
             buttons it replaces (52 + 10 + 52), so a detail scrolled to its end
             isn't pulled up by the swap. -->
        <div
          v-if="shown.view === 'searching'"
          role="status"
          class="flex min-h-[114px] items-center gap-3.5 rounded-card bg-surface py-3 pl-3 pr-[18px] shadow-card"
          :class="{ 'search-out': leaving }"
          data-recipe-searching
        >
          <div class="grid h-[66px] w-[66px] shrink-0 place-items-center rounded-blob bg-search-tint">
            <TopfbertSearch :leaving="leaving" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-[5px]">
            <span class="font-display text-title-s">{{ t.recipe.finder.searching }}</span>
            <span class="text-pretty text-small text-text-muted">{{ t.recipe.finder.searchingAbout }}</span>
          </div>
        </div>

        <!-- Nothing found, failed, daily cap. -->
        <div
          v-else-if="shown.view === 'none' || shown.view === 'failed' || shown.view === 'quota' || shown.view === 'tooSoon'"
          class="flex items-center gap-3"
          :data-recipe-note="shown.view"
        >
          <img
            v-if="shown.view !== 'none'"
            :src="shown.view === 'failed' ? '/illustrations/topfbert-oops.svg' : '/illustrations/topfbert-sleep.svg'"
            alt=""
            width="46"
            height="49"
            class="h-[49px] w-[46px] shrink-0"
          >
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <span class="text-pretty font-display text-title-s">{{ shown.view === 'none' ? t.recipe.finder.none : shown.view === 'failed' ? t.recipe.finder.failed : shown.view === 'tooSoon' ? t.recipe.finder.tooSoon : t.recipe.finder.quota }}</span>
            <span
              v-if="shown.view === 'none'"
              class="text-pretty text-small text-text-muted"
            >{{ t.recipe.finder.noneAbout }}</span>
          </div>
        </div>

        <div
          v-if="shown.find || shown.add"
          class="buttons grid gap-2.5"
        >
          <button
            v-if="shown.find"
            type="button"
            :class="[buttonShape, quietButton, 'bg-surface-muted disabled:opacity-[.35]']"
            :disabled="!mayPress"
            data-find-recipe
            @click="find"
          >
            <!-- The magnifier, and for "Noch mal suchen" the retry arrow (handoff RecipeFinderState). -->
            <svg
              v-if="shown.view === 'action'"
              viewBox="0 0 24 24"
              class="shrink-0"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              aria-hidden="true"
            ><circle
              cx="11"
              cy="11"
              r="6.5"
            /><path d="M16 16l4.5 4.5" /></svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              class="shrink-0"
              width="17"
              height="17"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v5h-5" /></svg>
            {{ shown.view === 'action' ? t.recipe.finder.find : t.recipe.finder.again }}
          </button>
          <button
            v-if="shown.add"
            type="button"
            :class="[buttonShape, quietButton, 'border-2 border-dashed border-line-strong']"
            data-edit-recipe
            @click="emit('edit')"
          >
            <AppIcon
              name="plus"
              :size="18"
            />
            {{ t.recipe.add }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* The buttons are equal in size and stack on a phone: a row only where two of
   them fit, from about 400px of screen (handoff: flex-wrap, 150px each). */
.buttons {
  grid-template-columns: repeat(auto-fit, minmax(184px, 1fr));
}
/* One view giving way to another: a fade (240ms). */
.swap-enter-active,
.swap-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.swap-enter-from,
.swap-leave-to {
  opacity: 0;
}
/* The card going when a Recipe is found (r13-out, loops.css). */
.search-out {
  animation: r13-out 300ms ease-in forwards;
}
</style>
