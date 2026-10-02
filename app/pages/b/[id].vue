<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { BoardListing, BoardView } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView, SavedDish } from '~~/server/utils/dishes'
import { createBoardModule, type BoardResult } from '~/board/board-module'
import { httpTransport } from '~/board/http-transport'
import { boardLabel, dishOnBoard } from '~~/shared/board'
import { columnForNewDishes } from '~~/shared/placement'

// A Board: its Columns with their Dishes. Phones show one Column at a time,
// switched with the Column tabs or by swiping; tablet and desktop show all
// Columns side by side, scroll-snapping. Dishes can be dragged: within a
// Column, onto a Column tab (phones) or across lanes (from 768px).

const t = useStrings()
const route = useRoute()
const id = computed(() => String(route.params.id))

// Opening the Board first remembers it as the one to reopen next time and
// moves on what is marked "Neu" (PRD story 37); the Board then comes with
// its New Dishes. Deep: adding and editing Dishes change it in place.
const fetchPassingCookies = useFetchPassingCookies()
const { data: board, error } = await useAsyncData(() => `board-${id.value}`, async () => {
  await fetchPassingCookies(`/api/boards/${id.value}/open`, { method: 'POST' })
  return fetchPassingCookies<BoardView>(`/api/boards/${id.value}`)
}, { deep: true })
if (error.value) throw createError({ statusCode: error.value.statusCode ?? 500, statusMessage: error.value.statusMessage, fatal: true })
const newDishIds = computed(() => new Set(board.value?.newDishIds))

// You, for your photo in the header, which opens your settings. Phones have
// no room for it there: the Board switcher has it instead.
const { data: me } = await useMe()

useHead({ title: () => board.value ? `${boardLabel(board.value)} · ${t.app.name}` : t.app.name })

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
const tabBar = useTemplateRef<ComponentPublicInstance>('tabBar')

// One Toast at a time: notices, "Rückgängig" after deleting a Dish or a
// Cooking, and the Gekocht toast. While the Dish detail is open, it shows
// the Toast itself (the Board behind it is inert).
const toast = ref<Toast | null>(null)
function showToast(shown: Toast) {
  toast.value = shown
}
function showNotice(text: string) {
  showToast({ text, duration: NOTICE_MS })
}

// The Cooking note sheet, from the Gekocht toast or the Cooking History.
const noting = ref<{ dish: DishView, cooking: CookingView } | null>(null)
const notingCooking = computed({
  get: () => noting.value?.cooking ?? null,
  set: (cooking) => {
    if (!cooking) noting.value = null
  },
})
function addNote(dish: DishView, cooking: CookingView) {
  noting.value = { dish, cooking }
}

// The client Board module: deleting a Dish goes through it, and the page
// turns what it answers into Toasts, haptics and focus (showResult).
const boardModule = createBoardModule(board, httpTransport())
const { moveDish, moveToBoard, dropDish, cookDish } = useDishMove(board, showToast, { addNote, celebrateMilestone })
const { deleteCooking } = useCookingDelete(showToast)

// Just made with "Neues Board", the Board celebrates as it opens.
const justCreated = useJustCreatedBoard()
const celebratingBoard = ref(false)
onMounted(() => watch(id, () => {
  if (justCreated.value !== id.value) return
  justCreated.value = null
  celebratingBoard.value = true
}, { immediate: true }))

// A Dish's 10th Cooking (milestone-10x): once it is recorded, a moment
// after the Gekocht toast is in, over the Board or the Dish detail; once per
// Dish on this device. The toast shows over it, and undoing that Cooking
// there ends it.
const milestone = ref<{ dish: DishView, cooking: CookingView } | null>(null)
const milestoneOpen = computed({
  get: () => !!milestone.value,
  set: (open) => {
    if (!open) milestone.value = null
  },
})
async function celebrateMilestone(dish: DishView, recorded: Promise<CookingView | null>) {
  const [cooking] = await Promise.all([recorded, wait(motionMs('milestone-delay'))])
  if (!cooking || !dish.cookings.includes(cooking) || !claimMilestone(dish.id)) return
  milestone.value = { dish, cooking }
  hapticMilestone()
}
watch(() => milestone.value && !milestone.value.dish.cookings.includes(milestone.value.cooking), (undone) => {
  if (undone) milestone.value = null
})

// A Column's tab, or its name beside the others, reacting to a Dish coming
// in (ColumnCue): dropped on the tab, cooked, the Gekocht pebble landing.
const { shot: columnCue, fire: cueColumn } = useOneShot<ColumnCue>()

// "Gekocht ✓" on a card: the celebration, timed (useGekochtCelebration).
// The Gekocht Column's count shows on its tab on phones, else by its name.
const { cookFromCard, onCardLeave, flight, onFlightLanded } = useGekochtCelebration(board, {
  cookDish,
  target: columnId => isPhoneLayout()
    ? tabBar.value?.$el.querySelector(`[data-tab-column-id="${columnId}"]`) ?? null
    : document.querySelector<HTMLElement>(`#column-${CSS.escape(columnId)} .column-name`),
  cue: cueColumn,
})

// Tapping a card morphs it into its detail (utils/dish-morph.ts). Clicks
// for a new tab or window are left to the link; so is one swallowed after a
// drag, which never gets here.
function openDish(event: MouseEvent, dishId: string) {
  const onLink = (event.target as Element).closest('.card-link')
  if (!onLink || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const path = `/b/${id.value}/d/${dishId}`
  morphOpen(cardThumb(dishId), path, async () => {
    await navigateTo(path)
  })
}

// The Dish detail's cooking actions, for the Dish it shows.
function detailDish(dishId: string) {
  return board.value && dishOnBoard(board.value, dishId)?.dish
}
function noteFromDetail(dishId: string, cooking: CookingView) {
  const dish = detailDish(dishId)
  if (dish) addNote(dish, cooking)
}
function deleteCookingFromDetail(dishId: string, cooking: CookingView) {
  const dish = detailDish(dishId)
  if (dish) deleteCooking(dish, cooking)
}

const { drag, dragging, entries } = useDishDrag(columnsEl, {
  board: () => board.value,
  activeColumnId: () => activeColumnId.value,
  tabBar: () => tabBar.value?.$el ?? null,
  drop: (dishId, place, origin) => dropDish(dishId, place, { origin }),
  landed: columnId => cueColumn({ columnId, kind: 'drop' }),
})
// The one loop playing on the Board: the lifted card's Placeholder, the
// hovered card's, or one where the Board comes to rest, else an empty
// state's. None while the Dish detail or a sheet covers it.
const boardLoop = useBoardLoop(columnsEl, {
  liftedDishId: () => drag.value?.dish.id ?? null,
  covered: () => !!route.params.dishId || adding.value || menuOpen.value || !!noting.value,
})
// Others' changes, while the Board is open; not mid-drag.
useBoardSync(() => id.value, board, () => dragging.value)
// Each Column's cards as they show, with the slot while a Dish is dragged.
const lists = computed(() => new Map(board.value?.columns.map(c => [c.id, entries(c)])))
const listOf = (column: { id: string }) => lists.value.get(column.id) ?? []
// The Column a dragged Dish is over as a drop target (a tab or a lane).
const dropTarget = computed(() => drag.value?.tabColumnId ?? drag.value?.laneColumnId ?? null)
const dropTint = computed(() => {
  const index = board.value?.columns.findIndex(c => c.id === dropTarget.value) ?? -1
  return index === -1 ? undefined : columnAccent(index)
})

const { dx, progress, following } = useColumnSwipe(columnsEl, {
  count: () => board.value?.columns.length ?? 0,
  active: () => activeIndex.value,
  go: showColumn,
  blocked: () => dragging.value,
})

// While the Board slides (to another Column, or back after a short swipe),
// the Columns around show too; at rest, phones only lay out the active one.
const sliding = ref(false)
let slideEnd: ReturnType<typeof setTimeout> | undefined
function slide() {
  const ms = motionMs('settle')
  if (!ms) return
  sliding.value = true
  clearTimeout(slideEnd)
  slideEnd = setTimeout(() => (sliding.value = false), ms)
}
watch(following, isFollowing => isFollowing || slide())

// On phones, switching Columns slides the Board, and if the page was
// scrolled down the old Column, the new one starts at its top, just below
// the sticky tabs.
watch(activeIndex, () => {
  if (!isPhoneLayout() || !columnsEl.value) return
  const top = columnsEl.value.getBoundingClientRect().top + window.scrollY - (tabBar.value?.$el.offsetHeight ?? 0)
  if (window.scrollY > top) window.scrollTo({ top })
  slide()
  boardLoop.playWhenAtRest(motionMs('settle'))
})
const parked = (index: number) => index !== activeIndex.value && !following.value && !sliding.value

// Cards rise in (handoff DishCard "enter", "Board load"): 48px up and
// fading in, 80ms apart (from the 8th on, all at once), as the Board opens
// and as a tapped tab brings its Column in. Not after a swipe: the finger
// already brought those cards in. Reduced motion: they are just there.
const RISE_MS = 640 + 8 * 80
const risingColumnIds = ref(new Set(board.value?.columns.map(c => c.id)))
let riseEnd: ReturnType<typeof setTimeout> | undefined
function rise(columnIds: string[]) {
  clearTimeout(riseEnd)
  risingColumnIds.value = new Set()
  // A frame without, so the animation starts again.
  requestAnimationFrame(() => {
    risingColumnIds.value = new Set(columnIds)
    riseEnd = setTimeout(() => (risingColumnIds.value = new Set()), RISE_MS)
  })
}
onMounted(() => {
  riseEnd = setTimeout(() => (risingColumnIds.value = new Set()), RISE_MS)
})
onBeforeUnmount(() => clearTimeout(riseEnd))
function selectTab(index: number) {
  const column = board.value?.columns[index]
  if (column && column.id !== activeColumnId.value) rise([column.id])
  showColumn(index)
}

// Headline parallax: a Column's name drifts and fades as it slides away.
function titleMotion(index: number) {
  const offset = index - progress.value
  return { '--title-x': `${offset * 70}px`, '--title-fade': Math.max(0, 1 - Math.abs(offset) * 1.6) }
}
const tint = computed(() => accentAt(clampProgress(progress.value, board.value?.columns.length ?? 1)))
const isEmpty = computed(() => board.value?.columns.every(c => c.dishes.length === 0) ?? false)
// A Column showing no cards shows its empty state, whose clip is the Board
// loop's to play (useBoardLoop) by this id.
const isColumnEmpty = (column: { id: string }) => !listOf(column).some(e => e.state !== 'gone')
const emptyClipId = (column: { id: string }) => `empty:${column.id}`
// A Column emptied or filled changes which empty state may loop.
const emptyColumnIds = computed(() => board.value?.columns.filter(isColumnEmpty).map(c => c.id).join() ?? '')
watch(emptyColumnIds, () => boardLoop.playWhenAtRest())

// The Dish detail is a child route (/b/:id/d/:dishId) over the Board. On
// phones its Column comes to the front, so closing it lands there (in the
// Column it was moved to, if it was). Closing it puts focus back on the
// Dish's card (or, if it was deleted or moved to another Board, on what
// took its place).
const focusAfterDetail = ref<string | null>(null)
watch(() => route.params.dishId, async (dishId, closedId) => {
  const shown = board.value && dishOnBoard(board.value, dishId ?? closedId)
  if (shown) activeColumnId.value = shown.column.id
  if (dishId || typeof closedId !== 'string') return
  const focusId = focusAfterDetail.value
  focusAfterDetail.value = null
  await nextTick()
  document.getElementById(focusId ?? `dish-${closedId}`)?.focus()
}, { immediate: true })

const adding = ref(false)

// Search (PRD story 36): the magnifier opens a field; while it holds a
// query, what the search found takes the place of the Columns.
const searchOpen = ref(false)
const searchButton = useTemplateRef<ComponentPublicInstance>('searchButton')
const { query, answer, failed: searchFailed, active: searching } = useDishSearch(() => id.value, board)
async function closeSearch() {
  query.value = ''
  searchOpen.value = false
  await nextTick()
  searchButton.value?.$el.focus()
}

// A Dish saved to another Board doesn't show here. If a Source image
// couldn't be stored, a notice says which image the Dish has instead.
function onAdded(saved: SavedDish, boardId: string, from: DOMRect | null) {
  if (saved.imageNotStored) showNotice(t.addDish.imageNotStored(saved.title))
  const { imageNotStored: _, ...dish } = saved
  const first = board.value && columnForNewDishes(board.value.columns)
  if (!first || boardId !== board.value?.id) return
  const slides = isPhoneLayout() && activeColumnId.value !== first.id
  first.dishes.unshift(dish)
  activeColumnId.value = first.id
  if (from) flyIn(dish.id, from, { slides })
}
// A saved Dish flies in from Add Dish (useSavedDishFlight).
const { arrivingId, flyIn } = useSavedDishFlight(columnsEl)

function onEdited(saved: SavedDish) {
  if (saved.imageNotStored) showNotice(t.detail.imageNotStored(saved.title))
  const { imageNotStored: _, ...dish } = saved
  const edited = board.value && dishOnBoard(board.value, dish.id)
  if (edited) Object.assign(edited.dish, dish)
}

// The card's "…" menu: "Verschieben nach…", which lists the Board's other
// Columns and the user's other Boards in the same sheet, and "Löschen".
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
const menuColumnId = computed(() => board.value && menuDish.value && dishOnBoard(board.value, menuDish.value.id)?.column.id)
async function moveFromMenu(columnId: string, toBoard: BoardListing | null) {
  const dishId = menuDish.value?.id
  menuDish.value = null
  if (dishId) await moveAndFocus(dishId, columnId, toBoard)
}

// "Verschieben nach…", from the card's menu or the Dish detail: within this
// Board, or to another one. Focus goes to what took the card's place.
// From the Dish detail, the Board is inert until the detail closes, so a
// Dish gone to another Board has focus put on what took its place then.
async function moveAndFocus(dishId: string, columnId: string, toBoard: BoardListing | null) {
  const focusId = toBoard ? moveToBoard(dishId, columnId, toBoard) : moveDish(dishId, columnId)
  if (route.params.dishId) {
    if (toBoard) focusAfterDetail.value = focusId
    return
  }
  await nextTick()
  if (focusId) document.getElementById(focusId)?.focus()
}
function deleteFromMenu() {
  const dishId = menuDish.value?.id
  menuDish.value = null
  if (dishId) deleteDish(dishId)
}

// Deleting a Dish (PRD story 47), from the card's menu or the Dish detail:
// its card goes, and a Toast offers "Rückgängig". From the Dish detail, the
// Board is inert until the detail closes, so focus goes to what took the
// card's place then.
function deleteDish(dishId: string) {
  const result = boardModule.deleteDish(dishId)
  if (!result) return
  hapticReject()
  if (route.params.dishId && result.focus) focusAfterDetail.value = focusTargetId(result.focus)
  void showResult(result)
}

// Shows what an operation of the Board module answered: its notice, as a
// Toast offering "Rückgängig" if it comes with an undo (whose result shows
// the same way); then what its write ended in, once settled; and focus
// where it says, unless the Dish detail makes the Board inert.
async function showResult({ dish, notice, undo, focus, settled }: BoardResult) {
  if (notice) {
    const text = t.dish[notice](dish.title)
    showToast(undo
      ? { text, duration: UNDO_WINDOW_MS, actions: [{ label: t.dish.undo, run: () => void undo().then(showResult) }] }
      : { text, duration: NOTICE_MS })
  }
  void settled?.then(showResult)
  if (!focus || route.params.dishId) return
  await nextTick()
  document.getElementById(focusTargetId(focus))?.focus()
}
</script>

<template>
  <main
    v-if="board"
    class="board min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10 desktop:px-16"
    :class="{ following, dragging, 'drop-tinted': dropTint }"
    :style="{ '--tint': tint, '--drop-tint': dropTint }"
  >
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <BoardSwitcher :board="board" />
        <RoundButton
          v-if="!searchOpen"
          ref="searchButton"
          :aria-label="t.search.open"
          @click="searchOpen = true"
        >
          <AppIcon
            name="search"
            :size="20"
          />
        </RoundButton>
        <NuxtLink
          :to="`/b/${board.id}/settings`"
          :aria-label="t.settings.title"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <AppIcon
            name="settings"
            :size="20"
          />
        </NuxtLink>
      </div>
      <NuxtLink
        v-if="me"
        to="/settings"
        :aria-label="t.userSettings.open"
        class="hidden shrink-0 rounded-full transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus tablet:block"
      >
        <UserAvatar
          :name="me.name"
          :image="me.image"
          :size="44"
        />
      </NuxtLink>
    </header>

    <BoardSearchBar
      v-if="searchOpen"
      v-model="query"
      class="mx-auto mt-4 max-w-[560px]"
      @close="closeSearch"
    />
    <SearchResults
      v-if="searching"
      class="mx-auto mt-6 max-w-[560px]"
      :board="board"
      :answer="answer"
      :failed="searchFailed"
      data-testid="search-results"
    />

    <ColumnTabs
      v-show="!searching"
      ref="tabBar"
      class="tabs-bar sticky top-0 z-tabs -mx-4 mt-4 px-4 tablet:hidden"
      :columns="tabs"
      :active="activeIndex"
      :progress="progress"
      :following="following"
      :drop-target="drag?.tabColumnId"
      :cue="columnCue"
      @select="selectTab"
    />

    <div
      v-show="!searching"
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
          class="column w-full shrink-0 rounded-panel bg-surface-muted p-3 focus-visible:outline-2 focus-visible:outline-focus tablet:w-[340px] tablet:snap-start desktop:w-[330px] tablet:p-4"
          :class="{
            'parked': parked(index),
            'lane-target': drag?.laneColumnId === column.id,
            'lane-dimmed': drag?.laneColumnId && drag.laneColumnId !== column.id,
          }"
          :style="{ ...titleMotion(index), '--accent': columnAccent(index) }"
          :data-column-id="column.id"
          :data-gekocht="column.isGekocht || undefined"
        >
          <h2 class="column-title px-1 font-display text-title-s">
            <span
              :key="columnCue?.value.columnId === column.id ? columnCue.key : 0"
              class="column-name relative inline-block"
              :class="columnCue?.value.columnId === column.id && `cue-${columnCue.value.kind}`"
            >
              {{ column.name }}
              <PebbleBurst
                v-if="columnCue?.value.columnId === column.id && columnCue.value.kind !== 'bump'"
                class="name-burst"
                :color="columnAccent(index)"
              />
            </span>
          </h2>
          <TransitionGroup
            tag="ol"
            name="card"
            class="relative flex flex-col gap-3"
            :class="{ 'mt-3': listOf(column).length, 'rising': risingColumnIds.has(column.id) }"
            data-dish-list
            @before-leave="onCardLeave"
          >
            <li
              v-for="({ key, dish, state }, i) in listOf(column)"
              :key="key"
              :style="{ '--i': i }"
              class="relative"
              :class="{ 'drop-slot h-32 rounded-card': !dish, 'invisible': dish && dish.id === arrivingId }"
              :data-dish-id="dish?.id"
              :data-drag-state="state"
              :data-drop-slot="!dish || undefined"
              @click.capture="dish && openDish($event, dish.id)"
            >
              <template v-if="dish">
                <NuxtLink
                  :id="`dish-${dish.id}`"
                  :to="`/b/${board.id}/d/${dish.id}`"
                  :aria-label="dish.title"
                  class="card-link block rounded-card transition-transform duration-tap ease-tap active:scale-[.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <DishCard
                    :dish="dish"
                    :is-new="newDishIds.has(dish.id)"
                    :motion="state === 'card' ? boardLoop.motionOf(dish.id) : null"
                    @motion-ended="boardLoop.ended(dish.id)"
                  />
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
                <CookButton
                  class="absolute bottom-2.5 right-2.5 px-3.5 py-2"
                  :cooked="dish.cookings.length > 0"
                  :label="t.dish.cookLabel(dish.title)"
                  data-cook
                  @cook="origin => cookFromCard(dish.id, origin)"
                />
              </template>
            </li>
          </TransitionGroup>
          <template v-if="isColumnEmpty(column)">
            <EmptyBoard
              v-if="isEmpty && index === 0"
              :play="!!boardLoop.motionOf(emptyClipId(column))"
              :data-empty-clip="emptyClipId(column)"
            />
            <EmptyColumn
              v-else
              :play="!!boardLoop.motionOf(emptyClipId(column))"
              :data-empty-clip="emptyClipId(column)"
            />
          </template>
        </section>
      </div>
    </div>

    <!-- The dragged card, following the pointer above everything. -->
    <div
      v-if="drag"
      aria-hidden="true"
      class="drag-card pointer-events-none fixed left-0 top-0 z-drag"
      :class="[`is-${drag.phase}`, { 'near-tabs': drag.nearTabs }]"
      :style="{
        'translate': `${drag.x}px ${drag.y}px`,
        'width': `${drag.width}px`,
        '--grab-x': `${drag.grabX}px`,
        '--grab-y': `${drag.grabY}px`,
        '--width': `${drag.width}px`,
        '--tilt': `${drag.tilt}deg`,
      }"
      data-testid="drag-card"
    >
      <div class="drag-card-lift rounded-card">
        <DishCard
          :dish="drag.dish"
          :is-new="newDishIds.has(drag.dish.id)"
          :motion="boardLoop.motionOf(drag.dish.id)"
          seen
        />
      </div>
    </div>

    <FlyToTab
      v-if="flight"
      :key="flight.key"
      :from="flight.value.from"
      :to="flight.value.to"
      :accent="flight.value.accent"
      @landed="onFlightLanded"
    />

    <button
      type="button"
      class="fab fixed bottom-6 right-5 z-fab flex h-[66px] w-[66px] items-center justify-center text-on-inverse active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus tablet:bottom-8 tablet:right-8 tablet:h-[70px] tablet:w-[70px]"
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

    <VeggieConfetti v-if="!route.params.dishId" />
    <AppToast
      v-if="!route.params.dishId"
      v-model="toast"
    />

    <CookingNoteSheet
      v-model:cooking="notingCooking"
      :dish-title="noting?.dish.title ?? ''"
    />

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
          <MoveTargetPicker
            v-if="menuColumnId"
            :board="board"
            :from-column-id="menuColumnId"
            @move="moveFromMenu"
          />
        </template>
      </div>
    </AppSheet>

    <BoardCreatedCelebration
      v-model:open="celebratingBoard"
      :board="board"
    />
    <CelebrationDialog
      v-model:open="milestoneOpen"
      clip="milestone-10x"
      :headline="t.milestone.headline"
      :body="t.milestone.body(milestone?.dish.title ?? '', MILESTONE_COOKINGS)"
      :close-label="t.milestone.close"
      close-after="milestone-stay"
    >
      <template #toast>
        <AppToast v-model="toast" />
      </template>
    </CelebrationDialog>

    <NuxtPage
      v-model:toast="toast"
      :board="board"
      @edited="onEdited"
      @delete="deleteDish"
      @move="moveAndFocus"
      @cook="cookDish"
      @note="noteFromDetail"
      @delete-cooking="deleteCookingFromDetail"
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
    transition: background-color var(--dur-swoosh) var(--ease-fade);
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
/* Reduced motion: no sliding or parallax, and the tint cuts (tokens.css
   collapses --dur-swoosh); the new Column, name and all, cross-fades in. */
@media (max-width: 767.98px) and (prefers-reduced-motion: reduce) {
  .column-title {
    translate: none;
    opacity: 1;
  }
  .column {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .column.parked {
    opacity: 0;
  }
}
/* The FAB is a pebble, not a circle (handoff Button "FAB"), slowly changing
   its shape (8s) and breathing gently (3.6s). Only the pebble painted behind
   it moves: the button itself keeps still, so it is always a steady target. While a Toast
   shows, it moves up out of its way. */
.fab {
  isolation: isolate;
  border-radius: var(--radius-blob);
  transition: scale var(--dur-tap) var(--ease-tap), translate var(--dur-settle) var(--ease-settle);
}
.fab::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--color-inverse);
  box-shadow: var(--shadow-fab);
  animation: fab-breathe 3.6s var(--ease-idle) infinite, fab-morph 8s var(--ease-idle) infinite alternate;
}
@keyframes fab-breathe {
  50% { scale: 1.04; }
}
@keyframes fab-morph {
  50% { border-radius: 58% 42% 50% 50% / 46% 56% 44% 54%; }
  100% { border-radius: 44% 56% 46% 54% / 56% 44% 58% 42%; }
}
.fab-lifted {
  translate: 0 -76px;
}
/* On an empty Board the add action is highlighted: a butter ring breathes
   around it. Reduced motion (main.css) stops it after one pass. */
.fab-prompt {
  animation: fab-prompt var(--dur-idle) var(--ease-idle) infinite;
}
/* Cards rising in (see `rise`). */
.rising > li {
  animation: card-rise 640ms var(--ease-settle) calc(min(var(--i), 8) * 80ms) backwards;
}
@keyframes card-rise {
  from {
    translate: 0 48px;
    opacity: 0;
  }
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
  .card-enter-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
}
/* A card cooked with "Gekocht ✓" (handoff "Card leaves Column") swooshes
   out sideways instead, tilting, in 360ms. Reduced motion: it only fades. */
.card-leave-active.cooked {
  transition: translate var(--dur-cook-leave) var(--ease-swoosh), rotate var(--dur-cook-leave) var(--ease-swoosh), opacity var(--dur-cook-leave) var(--ease-fade);
}
.card-leave-to.cooked {
  translate: 440px 0;
  rotate: 8deg;
  scale: none;
}
@media (prefers-reduced-motion: reduce) {
  .card-leave-active.cooked {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .card-leave-to.cooked {
    translate: none;
    rotate: none;
  }
}
/* Dragging a Dish (handoff "Drag lift"). The card lifts under the pointer:
   it grows to 1.04, tilts (-2°, then with the pointer's sideways speed) and
   casts the lift shadow. Near the Column tabs it shrinks to half and hangs
   just below the finger, so the tabs stay visible. Letting go, it settles
   into its slot, upright, or on phones spins into a Column tab (--dur-drop-*
   in main.css). Reduced motion: no scale or tilt,
   an ink outline instead; it jumps into its slot, and fades into a tab. */
.drag-card {
  touch-action: none;
}
.drag-card-lift {
  transform-origin: var(--grab-x) var(--grab-y);
  scale: 1.04;
  rotate: var(--tilt);
  box-shadow: var(--shadow-lift);
  transition:
    rotate var(--dur-tap) var(--ease-tap),
    scale var(--dur-drop-shrink) var(--ease-settle),
    translate var(--dur-drop-shrink) var(--ease-settle),
    box-shadow var(--dur-lift) var(--ease-lift);
  animation: lift var(--dur-lift) var(--ease-lift);
}
.drag-card-lift :deep(article) {
  box-shadow: none;
}
.near-tabs .drag-card-lift {
  scale: .5;
  translate: calc((var(--grab-x) - var(--width) / 2) / 2) calc(var(--grab-y) / 2 + 24px);
}
.drag-card.is-settling {
  transition: translate var(--dur-drop-settle) var(--ease-settle);
}
.is-settling .drag-card-lift {
  scale: 1;
  rotate: 0deg;
  box-shadow: var(--shadow-card);
  transition-duration: var(--dur-drop-settle);
}
.drag-card.is-swallowing {
  transition: translate var(--dur-drop-swallow) var(--ease-swoosh);
}
.is-swallowing .drag-card-lift {
  scale: .05;
  rotate: -40deg;
  transition: scale var(--dur-drop-swallow) var(--ease-swoosh), rotate var(--dur-drop-swallow) var(--ease-swoosh);
}
@keyframes lift {
  from {
    scale: 1;
    rotate: 0deg;
    box-shadow: var(--shadow-card);
  }
}
@media (prefers-reduced-motion: reduce) {
  .drag-card-lift,
  .is-swallowing .drag-card-lift {
    scale: none;
    rotate: none;
    translate: none;
    outline: 2px solid var(--color-text);
    transition: none;
  }
  .near-tabs .drag-card-lift {
    scale: none;
    translate: 0 calc(var(--grab-y) + 24px);
  }
  .drag-card.is-settling,
  .drag-card.is-swallowing {
    transition: none;
  }
  .is-swallowing .drag-card-lift {
    opacity: 0;
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
}
/* A card can't be selected or called up as a link while it may be dragged. */
.card-link {
  -webkit-touch-callout: none;
  user-select: none;
}
.dragging {
  user-select: none;
  cursor: grabbing;
}
/* The dragged card's place in its Column: a dashed outline at its height.
   In another Column a slot in that Column's accent opens instead, and the
   card's own place closes. The cards around make room in 320ms. */
[data-drag-state="slot"] > * {
  visibility: hidden;
}
[data-drag-state="slot"]::after,
.drop-slot {
  border: 2.5px dashed color-mix(in srgb, var(--color-text) 25%, transparent);
  border-radius: var(--radius-card);
}
[data-drag-state="slot"]::after {
  content: '';
  position: absolute;
  inset: 0;
}
.drop-slot {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}
[data-drag-state="gone"] {
  height: 0;
  overflow: hidden;
  visibility: hidden;
  margin-bottom: -.75rem;
  animation: slot-collapse var(--dur-drop-collapse) var(--ease-settle);
}
/* Closing, the place shrinks from a card's height (128px) to nothing. */
@keyframes slot-collapse {
  from {
    height: 8rem;
    margin: 0;
    visibility: visible;
  }
}
[data-drag-state="gone"]:last-child {
  margin-bottom: 0;
  margin-top: -.75rem;
}
[data-drag-state="gone"]:only-child {
  margin: 0;
}
.dragging .card-move {
  transition-duration: calc(var(--dur-settle) * 2 / 3);
}
/* The drop slot comes and goes at once, and the dragged card, once it has
   landed, just is there: the flying card already showed the way. */
.drop-slot.card-enter-active,
.drop-slot.card-leave-active {
  transition: none;
}
.drop-slot.card-leave-active {
  visibility: hidden;
}
/* A lane a dragged Dish is over (handoff "Drop target", desktop): it grows
   a little, fills with its accent and glows, and wiggles once; the other
   lanes dim. The background tints toward it. Reduced motion: fill and ring. */
@media (min-width: 768px) {
  .column {
    transition: scale var(--dur-fade) var(--ease-pop), opacity var(--dur-fade) var(--ease-fade), box-shadow var(--dur-fade) var(--ease-fade), background-color var(--dur-fade) var(--ease-fade);
  }
  .column.lane-target {
    scale: 1.012;
    background-color: color-mix(in srgb, var(--accent) 30%, var(--color-surface-muted));
    box-shadow: 0 0 0 7px color-mix(in srgb, var(--accent) 35%, transparent);
    animation: lane-wiggle 600ms var(--ease-idle);
  }
  .column.lane-dimmed {
    opacity: .6;
  }
}
/* With the Columns side by side there are no tabs, so a Column's name
   reacts to a Dish coming in (ColumnCue) instead: cooked, it bumps to 1.22;
   the Gekocht pebble bursts on it. On phones the tabs do it. */
@media (min-width: 768px) {
  .column-name.cue-bump {
    animation: name-bump var(--dur-tab-bump) var(--ease-pop);
  }
}
@media (max-width: 767.98px) {
  .name-burst {
    display: none;
  }
}
@keyframes name-bump {
  40% { scale: 1.22; }
}
@keyframes lane-wiggle {
  25% { rotate: -.3deg; }
  75% { rotate: .3deg; }
}
@media (min-width: 768px) and (prefers-reduced-motion: reduce) {
  .column.lane-target {
    scale: none;
  }
}
.board.drop-tinted {
  background-color: color-mix(in oklch, var(--drop-tint) 22%, var(--color-bg));
  transition: background-color var(--dur-fade) var(--ease-fade);
}
@keyframes fab-prompt {
  0%, 100% { box-shadow: var(--shadow-fab), 0 0 0 2px var(--color-focus); }
  50% { box-shadow: var(--shadow-fab), 0 0 0 11px color-mix(in srgb, var(--color-butter) 0%, transparent); }
}
</style>
