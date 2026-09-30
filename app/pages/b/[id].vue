<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { DishView, SavedDish } from '~~/server/utils/dishes'
import { dishOnBoard } from '~~/shared/board'

// A Board: its Columns with their Dishes. Phones show one Column at a time,
// switched with the Column tabs or by swiping; tablet and desktop show all
// Columns side by side as lanes that scroll-snap.

const t = useStrings()
const { signOut } = useAuth()
const route = useRoute()
const id = computed(() => String(route.params.id))

// Deep: adding and editing Dishes change the Board in place.
const { data: board, error } = await useFetch<BoardView>(() => `/api/boards/${id.value}`, { deep: true })
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })

// Remember this as the Board to reopen next time.
onMounted(() => $fetch(`/api/boards/${id.value}/open`, { method: 'POST' }))

useHead({ title: () => board.value ? `${board.value.emoji} ${board.value.name} · ${t.app.name}` : t.app.name })

const activeColumnId = ref(board.value?.columns[0]?.id)
const activeIndex = computed(() => Math.max(0, board.value?.columns.findIndex(c => c.id === activeColumnId.value) ?? 0))
const tabs = computed(() => board.value?.columns.map(c => ({ id: c.id, name: c.name, count: c.dishes.length })) ?? [])

function showColumn(index: number) {
  const column = board.value?.columns[index]
  if (!column || column.id === activeColumnId.value) return
  activeColumnId.value = column.id
  hapticTick()
}

const columnsEl = useTemplateRef<HTMLElement>('columns')
const { dx, progress, following } = useColumnSwipe(columnsEl, {
  count: () => board.value?.columns.length ?? 0,
  active: () => activeIndex.value,
  go: showColumn,
})

// The handoff's settle duration (--dur-settle): how long the Board slides.
const SETTLE_MS = 480

// While the Board slides to another Column, the Columns in between show too;
// at rest, phones only lay out the active one. If the page was scrolled down
// the old Column, the new one starts at its top.
const sliding = ref(false)
let slideEnd: ReturnType<typeof setTimeout> | undefined
watch(activeIndex, () => {
  const top = columnsEl.value && columnsEl.value.getBoundingClientRect().top + window.scrollY - 72
  if (top !== null && window.scrollY > top) window.scrollTo({ top })
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  sliding.value = true
  clearTimeout(slideEnd)
  slideEnd = setTimeout(() => (sliding.value = false), SETTLE_MS)
})
const parked = (index: number) => index !== activeIndex.value && !following.value && !sliding.value

// Headline parallax: a Column's name drifts and fades as it slides away.
function titleMotion(index: number) {
  const offset = index - progress.value
  return { '--title-x': `${offset * 70}px`, '--title-fade': Math.max(0, 1 - Math.abs(offset) * 1.6) }
}
const lastIndex = computed(() => Math.max(0, (board.value?.columns.length ?? 1) - 1))
const tint = computed(() => accentAt(Math.max(0, Math.min(progress.value, lastIndex.value))))
const isEmpty = computed(() => board.value?.columns.every(c => c.dishes.length === 0) ?? false)

// One Toast at a time: notices, and "Rückgängig" after deleting a Dish.
const toast = ref<Toast | null>(null)
function showToast(shown: Toast) {
  toast.value = shown
}
function showNotice(text: string) {
  showToast({ text, duration: NOTICE_MS })
}

const { deleteDish, focusCard } = useDishDelete(board, showToast)
const { moveDish } = useDishMove(board, showToast)

// The Dish detail is a child route (/b/:id/d/:dishId) over the Board. On
// phones its Column comes to the front, so closing it lands there.
// Closing it puts focus back on the Dish's card (or, if it was deleted, on
// what took its place).
watch(() => route.params.dishId, async (dishId, closedId) => {
  const opened = board.value && dishOnBoard(board.value, dishId)
  if (opened) activeColumnId.value = opened.column.id
  if (dishId || typeof closedId !== 'string') return
  await nextTick()
  focusCard(closedId)
}, { immediate: true })

const adding = ref(false)

// A Dish saved to another Board doesn't show here. If a Source image
// couldn't be stored, a notice says which image the Dish has instead.
function onAdded(saved: SavedDish, boardId: string) {
  if (saved.imageNotStored) showNotice(t.addDish.imageNotStored(saved.title))
  const { imageNotStored: _, ...dish } = saved
  const first = board.value?.columns[0]
  if (!first || boardId !== board.value?.id) return
  first.dishes.unshift(dish)
  activeColumnId.value = first.id
}

function onEdited(saved: SavedDish) {
  if (saved.imageNotStored) showNotice(t.detail.imageNotStored(saved.title))
  const { imageNotStored: _, ...dish } = saved
  const edited = board.value && dishOnBoard(board.value, dish.id)
  if (edited) Object.assign(edited.dish, dish)
}

// The card's "…" menu: "Verschieben nach…", which lists the Board's other
// Columns in the same sheet, and "Löschen".
const menuDish = ref<DishView | null>(null)
const menuOpen = computed({
  get: () => menuDish.value !== null,
  set: (open) => {
    if (!open) menuDish.value = null
  },
})
const choosingColumn = ref(false)
watch(menuDish, () => (choosingColumn.value = false))
const menuSteps = useTemplateRef<HTMLElement>('menuSteps')
async function chooseColumn(choosing: boolean) {
  choosingColumn.value = choosing
  await nextTick()
  menuSteps.value?.querySelector('button')?.focus()
}
const moveTargets = computed(() => {
  const from = board.value && menuDish.value && dishOnBoard(board.value, menuDish.value.id)
  return board.value?.columns
    .map((column, index) => ({ column, accent: columnAccent(index) }))
    .filter(({ column }) => from && column !== from.column) ?? []
})
async function moveFromMenu(columnId: string) {
  const dishId = menuDish.value?.id
  menuDish.value = null
  if (!dishId) return
  const focusId = moveDish(dishId, columnId)
  await nextTick()
  if (focusId) document.getElementById(focusId)?.focus()
}
async function deleteFromMenu() {
  const dishId = menuDish.value?.id
  menuDish.value = null
  if (!dishId) return
  deleteDish(dishId)
  await nextTick()
  focusCard(dishId)
}
</script>

<template>
  <main
    v-if="board"
    class="board min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10 desktop:px-16"
    :class="{ following }"
    :style="{ '--tint': tint }"
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

    <ColumnTabs
      class="tabs-bar sticky top-0 z-tabs -mx-4 mt-4 px-4 tablet:hidden"
      :columns="tabs"
      :active="activeIndex"
      :progress="progress"
      :following="following"
      @select="showColumn"
    />

    <div
      ref="columns"
      data-testid="columns"
      class="columns mt-2 tablet:mt-8 tablet:snap-x tablet:snap-mandatory tablet:overflow-x-auto tablet:pb-4"
    >
      <div
        class="track flex items-start gap-4"
        :class="{ following }"
        :style="{ '--active': activeIndex, '--dx': `${dx}px` }"
      >
        <section
          v-for="(column, index) in board.columns"
          :id="`column-${column.id}`"
          :key="column.id"
          :aria-label="column.name"
          tabindex="-1"
          class="column w-full shrink-0 rounded-panel bg-surface-muted p-3 focus-visible:outline-2 focus-visible:outline-focus tablet:w-[340px] tablet:snap-start tablet:p-4"
          :class="{ parked: parked(index) }"
          :style="titleMotion(index)"
          :data-gekocht="column.isGekocht || undefined"
        >
          <h2 class="column-title px-1 font-display text-title-s">
            {{ column.name }}
          </h2>
          <TransitionGroup
            tag="ol"
            name="card"
            class="relative flex flex-col gap-3"
            :class="{ 'mt-3': column.dishes.length }"
          >
            <li
              v-for="dish in column.dishes"
              :key="dish.id"
              class="relative"
            >
              <NuxtLink
                :id="`dish-${dish.id}`"
                :to="`/b/${board.id}/d/${dish.id}`"
                :aria-label="dish.title"
                class="block rounded-card transition-transform duration-tap ease-tap active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <DishCard :dish="dish" />
              </NuxtLink>
              <button
                type="button"
                class="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap hover:bg-surface-muted active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                :aria-label="t.dish.menu(dish.title)"
                aria-haspopup="dialog"
                @click="menuDish = dish"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  fill="currentColor"
                  aria-hidden="true"
                ><circle
                  cx="5"
                  cy="12"
                  r="2"
                /><circle
                  cx="12"
                  cy="12"
                  r="2"
                /><circle
                  cx="19"
                  cy="12"
                  r="2"
                /></svg>
              </button>
            </li>
          </TransitionGroup>
          <template v-if="!column.dishes.length">
            <EmptyBoard v-if="isEmpty && index === 0" />
            <EmptyColumn v-else />
          </template>
        </section>
      </div>
    </div>

    <button
      type="button"
      class="fab fixed bottom-6 right-5 z-fab flex h-[66px] w-[66px] items-center justify-center bg-inverse text-on-inverse shadow-fab active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus tablet:bottom-8 tablet:right-8 tablet:h-[70px] tablet:w-[70px]"
      :class="{ 'fab-prompt': isEmpty, 'fab-lifted': toast }"
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

    <AppToast v-model="toast" />

    <AddDishSheet
      v-model:open="adding"
      :board-id="board.id"
      @added="onAdded"
    />

    <AppSheet
      v-model:open="menuOpen"
      :title="menuDish?.title ?? ''"
      :close-label="t.dish.closeMenu"
    >
      <div
        ref="menuSteps"
        class="mt-5 flex flex-col gap-2"
      >
        <template v-if="!choosingColumn">
          <button
            type="button"
            class="rounded-pill bg-surface-muted px-5 py-3.5 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            @click="chooseColumn(true)"
          >
            {{ t.dish.moveTo }}
          </button>
          <DangerButton @click="deleteFromMenu">
            {{ t.dish.delete }}
          </DangerButton>
        </template>
        <template v-else>
          <button
            type="button"
            class="flex items-center gap-2 self-start rounded-pill px-3 py-2 text-label text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
            @click="chooseColumn(false)"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            ><path d="M15 6l-6 6 6 6" /></svg>
            {{ t.dish.back }}
          </button>
          <p class="px-1 text-overline uppercase text-text-muted">
            {{ t.dish.moveTo }}
          </p>
          <button
            v-for="{ column, accent } in moveTargets"
            :key="column.id"
            type="button"
            class="flex items-center gap-3 rounded-field bg-surface-muted px-5 py-3.5 text-left text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            @click="moveFromMenu(column.id)"
          >
            <span
              aria-hidden="true"
              class="h-3 w-3 shrink-0 rounded-full"
              :style="{ background: accent }"
            />
            {{ column.name }}
          </button>
        </template>
      </div>
    </AppSheet>

    <NuxtPage
      :board="board"
      @edited="onEdited"
      @delete="deleteDish"
    />
  </main>
</template>

<style scoped>
/* Phones: the Columns sit in a row, one screen wide each, and the row slides
   to the active one (and with the finger while swiping). At rest only the
   active Column is laid out, so a short Column doesn't leave the page as long
   as the longest. The background takes the active Column's tint. */
@media (max-width: 767.98px) {
  .board {
    background-color: color-mix(in oklch, var(--tint) 24%, var(--color-bg));
    transition: background-color 600ms var(--ease-fade);
  }
  .board.following {
    transition: none;
  }
  .tabs-bar {
    background-color: inherit;
  }
  .columns {
    overflow-x: clip;
    touch-action: pan-y;
  }
  .track {
    translate: calc(var(--active) * -1 * (100% + 1rem) + var(--dx)) 0;
    transition: translate var(--dur-settle) var(--ease-settle);
  }
  .track.following,
  .track.following .column-title {
    transition: none;
  }
  .column.parked {
    visibility: hidden;
    height: 0;
    padding-block: 0;
    overflow: hidden;
  }
  .column-title {
    translate: var(--title-x) 0;
    opacity: var(--title-fade);
    transition: translate var(--dur-settle) var(--ease-settle), opacity var(--dur-settle) var(--ease-fade);
  }
}
/* Reduced motion: no sliding, parallax or tint fade; the new Column fades in. */
@media (max-width: 767.98px) and (prefers-reduced-motion: reduce) {
  .board {
    transition: none;
  }
  .column-title {
    translate: none;
    opacity: 1;
  }
  .column:not(.parked) {
    animation: column-in 150ms var(--ease-fade);
  }
}
@keyframes column-in {
  from { opacity: 0; }
}
/* The FAB is a pebble, not a circle (handoff Button "FAB"). While a Toast
   shows, it moves up out of its way. */
.fab {
  border-radius: var(--radius-blob);
  transition: scale var(--dur-tap) var(--ease-tap), translate var(--dur-settle) var(--ease-settle);
}
.fab-lifted {
  translate: 0 -76px;
}
/* On an empty Board the add action is highlighted: a butter ring breathes
   around it. Reduced motion (main.css) stops it after one pass. */
.fab-prompt {
  animation: fab-prompt var(--dur-idle) var(--ease-idle) infinite;
}
/* Deleting a Dish (handoff "Delete collapse + undo"): its card shrinks and
   fades while the list closes up; "Rückgängig" brings it back with a little
   overshoot. Reduced motion: it only fades. */
.card-leave-active {
  position: absolute;
  inset-inline: 0;
  transition: scale 260ms var(--ease-settle), opacity 260ms var(--ease-fade);
}
.card-enter-active {
  transition: scale 380ms var(--ease-settle), opacity 380ms var(--ease-fade);
}
.card-leave-to,
.card-enter-from {
  scale: .9;
  opacity: 0;
}
.card-move {
  transition: transform var(--dur-settle) var(--ease-settle);
}
@media (prefers-reduced-motion: reduce) {
  .card-leave-to,
  .card-enter-from {
    scale: none;
  }
}
@keyframes fab-prompt {
  0%, 100% { box-shadow: var(--shadow-fab), 0 0 0 2px var(--color-focus); }
  50% { box-shadow: var(--shadow-fab), 0 0 0 11px color-mix(in srgb, var(--color-butter) 0%, transparent); }
}
</style>
