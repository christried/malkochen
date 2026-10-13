<script setup lang="ts">
import { boardLabel } from '~~/shared/board'

// A Board while it opens (handoff "Skeleton shimmer"; Board "States:
// loading"): its chrome at once, and in its Columns skeleton cards the size
// of a DishCard (128px high, an 86px thumb), so nothing jumps when its Dishes
// take their place and rise in. A light sweeps across them every 1.4s;
// reduced motion: they are still, at 60% opacity. Phones show the first
// Column's headline, the tabs and that Column, tablet and desktop every
// Column. The Board's name and Columns come from the Board switcher's list
// (useBoardListings); a Board not on it shows three nameless Columns. Tablet and desktop colour it as the
// Board (main.css), so a Board on that list keeps its colours as it opens.
// `address` is the Board's part of the page's address: its slug, or its id.
const props = defineProps<{ address: string }>()
const t = useStrings()

const listings = useBoardListings()
const listing = computed(() => listings.value.find(b => b.slug === props.address || b.id === props.address) ?? null)
const NAMELESS_COLUMNS = [{ id: 'a', name: '', subtitle: null }, { id: 'b', name: '', subtitle: null }, { id: 'c', name: '', subtitle: null }]
const columns = computed(() => listing.value?.columns ?? NAMELESS_COLUMNS)
// Fewer cards further along, as Boards tend to have.
const cardCount = (index: number) => Math.max(1, 3 - index)

useHead({ title: () => listing.value ? `${boardLabel(listing.value)} · ${t.app.name}` : t.app.name })
</script>

<template>
  <main
    class="board min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10 desktop:px-16"
    :style="{ '--tint': columnAccent(0), ...boardColours(columns.length) }"
    :aria-label="t.board.loading"
    aria-busy="true"
    data-board-skeleton
  >
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <BoardSwitcher
          v-if="listing"
          :board="listing"
        />
        <span
          v-else
          aria-hidden="true"
          class="name-pebble h-11 w-44 shadow-card"
        />
        <span
          v-for="icon in ['search', 'settings'] as const"
          :key="icon"
          aria-hidden="true"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-text-muted shadow-card"
        >
          <AppIcon
            :name="icon"
            :size="20"
          />
        </span>
      </div>
      <span
        aria-hidden="true"
        class="hidden h-11 w-11 shrink-0 rounded-full bg-surface-muted tablet:block"
      />
    </header>

    <ColumnHeadline
      v-if="listing"
      class="-mx-4 mt-5 px-4"
      :columns="columns"
      :active="0"
      :progress="0"
      :following="false"
    />
    <div
      v-else
      aria-hidden="true"
      class="mt-5 px-1 font-display tablet:hidden"
    >
      <span class="block text-display-xl leading-none"><span class="name-pebble w-40">&nbsp;</span></span>
      <span class="mt-1 block text-subline"><span class="name-pebble w-48">&nbsp;</span></span>
    </div>

    <ColumnTabs
      v-if="listing"
      class="-mx-4 mt-4 px-4 tablet:hidden"
      :columns="columns"
      :active="0"
      :progress="0"
      :following="false"
    />
    <div
      v-else
      aria-hidden="true"
      class="mt-4 flex gap-2 py-2 tablet:hidden"
    >
      <span
        v-for="column in columns"
        :key="column.id"
        class="rounded-pill bg-surface-muted px-4 py-2.5 text-button"
      ><span class="inline-block w-16">&nbsp;</span></span>
    </div>

    <div class="mt-2 overflow-x-clip tablet:mt-8 tablet:overflow-x-auto tablet:pb-4">
      <div class="flex items-start gap-4">
        <section
          v-for="(column, index) in columns"
          :id="`column-${column.id}`"
          :key="column.id"
          :aria-label="column.name || undefined"
          class="column w-full shrink-0 rounded-panel bg-surface-muted p-3 tablet:w-[340px] desktop:w-[330px] tablet:p-4"
          :style="{ '--accent': columnAccent(index) }"
          data-lane
        >
          <ColumnTitle
            class="hidden tablet:block"
            :subtitle="column.subtitle"
          >
            <template v-if="column.name">
              {{ column.name }}
            </template>
            <span
              v-else
              aria-hidden="true"
              class="name-pebble w-28"
            >&nbsp;</span>
          </ColumnTitle>
          <ol
            aria-hidden="true"
            class="skeleton-cards mt-3 flex flex-col gap-3"
            data-skeleton-cards
          >
            <li
              v-for="n in cardCount(index)"
              :key="n"
              class="skeleton-card relative flex h-32 gap-3 overflow-hidden rounded-card bg-surface p-2.5 shadow-card"
              data-skeleton-card
            >
              <span
                class="w-[86px] shrink-0 rounded-thumb bg-surface-muted"
                data-thumb
              />
              <span class="flex min-w-0 flex-1 flex-col gap-2 py-1.5 pr-1">
                <span class="h-4 w-4/5 rounded-pill bg-surface-muted" />
                <span class="h-4 w-1/2 rounded-pill bg-surface-muted" />
                <span class="mt-auto h-6 w-6 rounded-full bg-surface-muted" />
              </span>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Phones: the background takes the first Column's tint, as the Board's
   does, and only that Column shows. */
@media (max-width: 767.98px) {
  .board {
    background-color: color-mix(in oklch, var(--tint) 24%, var(--color-bg));
  }
  .column:not(:first-child) {
    display: none;
  }
}
/* What stands in for a name not known yet: a pebble a line of text high. */
.name-pebble {
  display: inline-block;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
}
/* The shimmer: a soft light sweeping across each card, all in step. */
.skeleton-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, color-mix(in srgb, var(--color-text) 7%, transparent) 50%, transparent 70%);
  translate: -100% 0;
  animation: shimmer 1.4s var(--ease-idle) infinite;
}
@keyframes shimmer {
  to {
    translate: 100% 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-cards {
    opacity: .6;
  }
  .skeleton-card::after {
    display: none;
  }
}
</style>
