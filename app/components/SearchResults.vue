<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { SearchAnswer } from '~/composables/useDishSearch'
import { dishPath } from '~~/shared/address'
import { dishOnBoard } from '~~/shared/board'

// What a search of the Board found: one list of the matching Dishes, each
// under the name of its Column, or the no-results still. Each Dish shows as
// it is on the Board now, so one deleted meanwhile is gone at once.
const props = defineProps<{ board: BoardView, answer: SearchAnswer | null, failed: boolean }>()
const t = useStrings()
const address = useOpenBoardAddress()

const results = computed(() => props.answer?.dishes.flatMap((found) => {
  const on = dishOnBoard(props.board, found.id)
  if (!on) return []
  return [{ ...on, accent: columnAccent(props.board.columns.indexOf(on.column)) }]
}) ?? null)
const status = computed(() => {
  if (props.failed) return t.search.failed
  return results.value ? t.search.found(results.value.length) : ''
})
</script>

<template>
  <section :aria-label="t.search.resultsLabel">
    <p
      class="sr-only"
      role="status"
    >
      {{ status }}
    </p>
    <p
      v-if="failed"
      class="py-6 text-center text-small text-text-muted"
    >
      {{ t.search.failed }}
    </p>
    <template v-else-if="answer && results">
      <SearchEmpty
        v-if="results.length === 0"
        :query="answer.query"
      />
      <TransitionGroup
        v-else
        tag="ol"
        name="result"
        class="flex flex-col gap-4"
        data-dish-results
      >
        <li
          v-for="({ dish, column, accent }, i) in results"
          :key="`${answer.round}-${dish.id}`"
          :style="{ '--i': i }"
          class="relative"
        >
          <p class="mb-1.5 flex items-center gap-2 px-1 text-label text-text-muted">
            <span
              aria-hidden="true"
              class="h-2.5 w-2.5 shrink-0 rounded-full"
              :style="{ background: accent }"
            />
            {{ column.name }}
          </p>
          <NuxtLink
            :to="dishPath(address, dish)"
            :aria-label="`${dish.title}, ${column.name}`"
            class="block rounded-card transition-transform duration-tap ease-tap active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <DishCard
              :dish="dish"
              :new-in-history="board.newInHistoryDishIds.includes(dish.id)"
            />
          </NuxtLink>
          <!-- Who added it, over the picture the card draws. -->
          <CardPersonButton
            v-if="dish.addedBy"
            :person="dish.addedBy"
            :board-id="board.id"
          />
        </li>
      </TransitionGroup>
    </template>
  </section>
</template>

<style scoped>
/* Each new query's results pop in one after another (handoff "Search
   results re-stagger": 380ms + 50ms per item, pop); the last query's go at
   once. Reduced motion: results just replace. */
.result-enter-active {
  transition: scale 380ms var(--ease-pop), opacity 380ms var(--ease-fade);
  transition-delay: calc(min(var(--i), 8) * 50ms);
}
.result-enter-from {
  scale: .94;
  opacity: 0;
}
.result-leave-active {
  display: none;
}
@media (prefers-reduced-motion: reduce) {
  .result-enter-active {
    transition: none;
  }
}
</style>
