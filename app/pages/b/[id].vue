<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { DishView } from '~~/server/utils/dishes'

// A Board: its Columns with their Dishes. Phones show one Column at a time
// with a simple switch (the real tabs and swiping come with #10); tablet and
// desktop show all Columns side by side.

const t = useStrings()
const { signOut } = useAuth()
const route = useRoute()
const id = computed(() => String(route.params.id))

const { data: board, error } = await useFetch<BoardView>(() => `/api/boards/${id.value}`)
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

// Remember this as the Board to reopen next time.
onMounted(() => $fetch(`/api/boards/${id.value}/open`, { method: 'POST' }))

useHead({ title: () => board.value ? `${board.value.emoji} ${board.value.name} · ${t.app.name}` : t.app.name })

const activeColumnId = ref(board.value?.columns[0]?.id)
const isEmpty = computed(() => board.value?.columns.every(c => c.dishes.length === 0) ?? false)

const adding = ref(false)
// A Dish saved to another Board doesn't show here.
function onAdded(dish: DishView, boardId: string) {
  const first = board.value?.columns[0]
  if (!first || boardId !== board.value?.id) return
  first.dishes.unshift(dish)
  activeColumnId.value = first.id
}
</script>

<template>
  <main
    v-if="board"
    class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10 desktop:px-16"
  >
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="font-display text-title-l tablet:text-display-m">
        <span aria-hidden="true">{{ board.emoji }}</span> {{ board.name }}
      </h1>
      <div class="flex flex-wrap items-center gap-3">
        <ThemePicker />
        <button
          type="button"
          class="rounded-pill px-4 py-2.5 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="signOut"
        >
          {{ t.board.signOut }}
        </button>
      </div>
    </header>

    <nav
      class="mt-6 flex gap-2 overflow-x-auto tablet:hidden"
      :aria-label="t.board.columns"
    >
      <button
        v-for="column in board.columns"
        :key="column.id"
        type="button"
        :aria-pressed="activeColumnId === column.id"
        class="shrink-0 rounded-pill px-4 py-2.5 text-button transition-colors duration-fade ease-fade focus-visible:outline-2 focus-visible:outline-focus"
        :class="activeColumnId === column.id ? 'bg-inverse text-on-inverse' : 'bg-surface-muted text-text'"
        @click="activeColumnId = column.id"
      >
        {{ column.name }} <span class="opacity-60">{{ column.dishes.length }}</span>
      </button>
    </nav>

    <div class="mt-4 tablet:mt-8 tablet:flex tablet:snap-x tablet:gap-4 tablet:overflow-x-auto tablet:pb-4">
      <section
        v-for="(column, index) in board.columns"
        :key="column.id"
        :aria-label="column.name"
        class="rounded-panel bg-surface-muted p-3 tablet:block tablet:w-[340px] tablet:shrink-0 tablet:snap-start tablet:p-4"
        :class="activeColumnId === column.id ? 'block' : 'hidden'"
        :data-gekocht="column.isGekocht || undefined"
      >
        <h2 class="px-1 font-display text-title-s">
          {{ column.name }}
        </h2>
        <ol
          v-if="column.dishes.length"
          class="mt-3 flex flex-col gap-3"
        >
          <li
            v-for="dish in column.dishes"
            :key="dish.id"
          >
            <DishCard :dish="dish" />
          </li>
        </ol>
        <EmptyBoard v-else-if="isEmpty && index === 0" />
        <EmptyColumn v-else />
      </section>
    </div>

    <button
      type="button"
      class="fab fixed bottom-6 right-5 z-fab flex h-[66px] w-[66px] items-center justify-center bg-inverse text-on-inverse shadow-fab transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus tablet:bottom-8 tablet:right-8 tablet:h-[70px] tablet:w-[70px]"
      :class="{ 'fab-prompt': isEmpty }"
      :aria-label="t.addDish.open"
      @click="adding = true"
    >
      <svg
        viewBox="0 0 24 24"
        width="28"
        height="28"
        fill="none"
        stroke="currentColor"
        stroke-width="2.5"
        stroke-linecap="round"
        aria-hidden="true"
      ><path d="M12 5v14M5 12h14" /></svg>
    </button>

    <AddDishSheet
      v-model:open="adding"
      :board-id="board.id"
      @added="onAdded"
    />
  </main>
</template>

<style scoped>
/* The FAB is a pebble, not a circle (handoff Button "FAB"). */
.fab {
  border-radius: var(--radius-blob);
}
/* On an empty Board the add action is highlighted: a butter ring breathes
   around it. Reduced motion (main.css) stops it after one pass. */
.fab-prompt {
  animation: fab-prompt var(--dur-idle) var(--ease-idle) infinite;
}
@keyframes fab-prompt {
  0%, 100% { box-shadow: var(--shadow-fab), 0 0 0 2px var(--color-focus); }
  50% { box-shadow: var(--shadow-fab), 0 0 0 11px color-mix(in srgb, var(--color-butter) 0%, transparent); }
}
</style>
