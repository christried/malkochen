<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { BoardListing, BoardView } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'
import { boardModuleKey, createBoardModule, type BoardResult, type Notice } from '~/board/board-module'
import { httpTransport } from '~/board/http-transport'
import { boardPath, boardSettingsPath, dishAt, dishPath } from '~~/shared/address'
import { boardLabel, dishOnBoard } from '~~/shared/board'

// A Board: its Columns with their Dishes. Phones show one Column at a time,
// its name large above the Column tabs (ColumnHeadline), switched with the
// tabs or by swiping; tablet and desktop show all
// Columns side by side, scroll-snapping, desktop with an add lane after the
// last one (AddColumnLane). Dishes can be dragged: within a
// Column, onto a Column tab (phones) or across lanes (from 768px). The Board
// page (pages/b/[board].vue) shows it once it has loaded, its skeleton until
// then.

const t = useStrings()
const route = useRoute()

// The Board at this address; an outdated address forwards first, and the
// Board isn't opened there (useBoardAddress). Opening the Board first
// remembers it as the one to reopen next time and moves on what is marked
// "Neu" (PRD story 37); the Board then comes with its New Dishes. The
// client Board module changes it in place.
const fetchPassingCookies = useFetchPassingCookies()
const opened = await useBoardAddress('', async (boardId) => {
  await fetchPassingCookies(`/api/boards/${boardId}/open`, { method: 'POST' })
  return fetchPassingCookies<BoardView>(`/api/boards/${boardId}`)
})
const id = opened?.boardId ?? ''
const board = opened?.loaded ?? ref<BoardView>()
const address = useOpenBoardAddress()
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

// The Cooking note sheet, from the Gekocht toast.
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

// The client Board module: adding, editing, moving, cooking and deleting a
// Dish, and a Cooking's note and delete, go through it, and the page turns
// what it answers into Toasts, the Gekocht celebration, haptics and focus
// (showResult). The forms under the page get it injected (useBoardModule).
const boardModule = createBoardModule(board, httpTransport())
provide(boardModuleKey, boardModule)
const confetti = useConfetti()
const gekochtPill = useGekochtPill()

// Just made with "Neues Board", the Board celebrates as it opens.
const justCreated = useJustCreatedBoard()
const celebratingBoard = ref(false)
onMounted(() => {
  if (justCreated.value !== id) return
  justCreated.value = null
  celebratingBoard.value = true
})

// A Dish's 10th Cooking (milestone-10x): once it is recorded, a moment
// after the Gekocht pill is in, over the Board or the Dish detail; once per
// Dish on this device. The pill and the toast show over it, and undoing that
// Cooking there ends it.
const milestone = ref<{ dish: DishView, cooking: CookingView } | null>(null)
const milestoneOpen = computed({
  get: () => !!milestone.value,
  set: (open) => {
    if (!open) milestone.value = null
  },
})
async function celebrateMilestone(dish: DishView, recorded: Promise<CookingView | null>) {
  const [cooking] = await Promise.all([recorded, wait(motionMs('milestone-delay'))])
  if (!cooking || !hasCooking(dish, cooking) || !claimMilestone(dish.id)) return
  milestone.value = { dish, cooking }
  hapticMilestone()
}
watch(() => milestone.value && !hasCooking(milestone.value.dish, milestone.value.cooking), (undone) => {
  if (undone) milestone.value = null
})
// While it shows, the toast's countdown waits, and runs on once it closes:
// a slow server can't use up "Rückgängig" behind it (#229).
const toastPaused = useToastPaused()
watch(milestoneOpen, (open) => {
  toastPaused.value = open
})
onBeforeUnmount(() => {
  toastPaused.value = false
})
// By id: settling to the server's answer brings the Cookings afresh.
function hasCooking(dish: DishView, cooking: CookingView) {
  return dish.cookings.some(c => c.id === cooking.id)
}

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
function openDish(event: MouseEvent, dish: DishView) {
  const onLink = (event.target as Element).closest('.card-link')
  if (!onLink || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const path = dishPath(address.value, dish)
  morphOpen(cardThumb(dish.id), path, async () => {
    await navigateTo(path)
  })
}

// "Gekocht ✓" on a card (useGekochtCelebration, which set its confetti off
// already).
function cookDish(dishId: string) {
  const result = boardModule.cookDish(dishId)
  if (result) void showResult(result, { origin: null })
}

const { drag, dragging, entries } = useDishDrag(columnsEl, {
  board: () => board.value,
  activeColumnId: () => activeColumnId.value,
  tabBar: () => tabBar.value?.$el ?? null,
  // Into the Gekocht Column, its confetti bursts where it landed.
  drop: (dishId, place, at) => {
    const result = boardModule.moveDish(dishId, place)
    if (result) void showResult(result, { origin: at, moveFocus: false })
  },
  landed: columnId => cueColumn({ columnId, kind: 'drop' }),
})
// What plays on the Board: the lifted card's Placeholder, the hovered
// card's, or one where the Board comes to rest; and beside it an empty
// state's loop. None while the Dish detail or a sheet covers it.
const boardLoop = useBoardLoop(columnsEl, {
  liftedDishId: () => drag.value?.dish.id ?? null,
  covered: () => !!route.params.dish || adding.value || menuOpen.value || !!noting.value || showingShortcuts.value,
})
// Others' changes, while the Board is open; not mid-drag.
useBoardSync(() => id, boardModule, () => dragging.value)
// Each Column's cards as they show, with the slot while a Dish is dragged.
const lists = computed(() => new Map(board.value?.columns.map(c => [c.id, entries(c)])))
const listOf = (column: { id: string }) => lists.value.get(column.id) ?? []
// The Column a dragged Dish is over as a drop target (a tab or a lane).
const dropTarget = computed(() => drag.value?.tabColumnId ?? drag.value?.laneColumnId ?? null)
const dropTint = computed(() => {
  const index = board.value?.columns.findIndex(c => c.id === dropTarget.value) ?? -1
  return index === -1 ? undefined : columnAccent(index)
})
// With every Column showing, the page's wash fades out on drop in the tint
// it had, not toward none; a new drag fades it in from the background, not
// from the last drag's tint.
const dropWash = ref<string>()
watch(dropTint, (tint) => {
  if (tint) dropWash.value = tint
})
watch(dragging, (isDragging) => {
  if (isDragging) dropWash.value = undefined
}, { flush: 'sync' })
const colours = computed(() => boardColours(board.value?.columns.length ?? 0))

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

const tint = computed(() => accentAt(clampProgress(progress.value, board.value?.columns.length ?? 1)))
const isEmpty = computed(() => board.value?.columns.every(c => c.dishes.length === 0) ?? false)
// A Column showing no cards shows its empty state, whose clip is the Board
// loop's to play (useBoardLoop) by this id.
const isColumnEmpty = (column: { id: string }) => !listOf(column).some(e => e.state !== 'gone')
const emptyClipId = (column: { id: string }) => `empty:${column.id}`
// A Column emptied or filled changes which empty state may loop.
const emptyColumnIds = computed(() => board.value?.columns.filter(isColumnEmpty).map(c => c.id).join() ?? '')
watch(emptyColumnIds, () => boardLoop.playWhenAtRest())

// The Dish detail is a child route (/b/:board/:dish) over the Board. On
// phones its Column comes to the front, so closing it lands there (in the
// Column it was moved to, if it was). Closing it puts focus back on the
// Dish's card (or, if it was deleted or moved to another Board, on what
// took its place), as the Board module says. Its Dish is remembered by id
// while it shows, as it may be gone from the Board by the time it closes.
let detailDishId: string | null = null
// What waits for the detail to close (detailClosed): told true once it
// has, false if the Board goes first.
const detailWaiters = new Set<(closed: boolean) => void>()
onBeforeUnmount(() => {
  for (const waiter of detailWaiters) waiter(false)
  detailWaiters.clear()
})
watch(() => route.params.dish, (dish) => {
  if (!dish) {
    for (const waiter of detailWaiters) waiter(true)
    detailWaiters.clear()
  }
  const opened = board.value && dish ? dishAt(board.value, dish) : null
  const closedId = detailDishId
  detailDishId = opened?.dish.id ?? null
  const shown = opened ?? (board.value && closedId ? dishOnBoard(board.value, closedId) : null)
  if (shown) activeColumnId.value = shown.column.id
  if (dish || !closedId) return
  const focus = boardModule.focusAfterDetail(closedId)
  if (focus) void focusOn(focus)
}, { immediate: true })

const adding = ref(false)

// Something shared to malkochen (pages/share.vue) arrives as ?add=<link>,
// empty if nothing shared was a web link: Add Dish opens with it filled in.
// The address drops it at once, so going back or reloading doesn't open
// Add Dish again; the link goes once the sheet has closed.
const sharedLink = ref<string | null>(null)
onMounted(() => {
  const { add, ...rest } = route.query
  if (typeof add !== 'string') return
  sharedLink.value = add
  adding.value = true
  void navigateTo({ path: route.path, query: rest, hash: route.hash }, { replace: true })
})
watch(adding, (isOpen) => {
  if (!isOpen) sharedLink.value = null
})

// Search (PRD story 36): the magnifier opens a field; while it holds a
// query, what the search found takes the place of the Columns.
const searchOpen = ref(false)
const searchButton = useTemplateRef<ComponentPublicInstance>('searchButton')
const { query, answer, failed: searchFailed, active: searching } = useDishSearch(() => id, board)
async function closeSearch() {
  query.value = ''
  searchOpen.value = false
  await nextTick()
  searchButton.value?.$el.focus()
}

// The keyboard shortcuts (utils/shortcuts.ts), once the Board is there and
// not mid-drag: "?" lists them; Esc closes the search (what else is open
// closes itself); 1–9 open the user's Boards in the Board switcher's order,
// fetched afresh as the switcher does (a number with no Board does nothing).
const listings = useBoardListings()
const showingShortcuts = ref(false)
const searchBar = useTemplateRef<{ focus: () => void }>('searchBar')
useBoardShortcuts((shortcut) => {
  switch (shortcut.action) {
    case 'addDish':
      adding.value = true
      return true
    case 'search':
      if (searchOpen.value) searchBar.value?.focus()
      else searchOpen.value = true
      return true
    case 'close':
      if (!searchOpen.value) return false
      void closeSearch()
      return true
    case 'boardSettings':
      void navigateTo(boardSettingsPath(board.value!))
      return true
    case 'switchBoard':
      void switchBoard(shortcut.board)
      return true
    case 'help':
      showingShortcuts.value = true
      return true
  }
}, () => !board.value || dragging.value)
// Only the last number pressed counts, however the fetches come back.
let switching = 0
async function switchBoard(index: number) {
  const press = ++switching
  const boards = await $fetch<BoardListing[]>('/api/boards').catch(() => listings.value)
  if (press !== switching) return
  listings.value = boards
  const target = boards[index]
  if (target && target.id !== board.value?.id) await navigateTo(boardPath(target))
}

// A Dish saved here shows where the server put it (the Board module put
// it there), and its Column comes into view as it flies in from Add Dish;
// one saved to another Board doesn't show. If a Source image couldn't be
// stored, a notice says which image the Dish has instead.
function onAdded(result: BoardResult, from: DOMRect | null) {
  void showResult(result)
  const shown = board.value && dishOnBoard(board.value, result.dish.id)
  if (!shown) return
  const slides = isPhoneLayout() && activeColumnId.value !== shown.column.id
  activeColumnId.value = shown.column.id
  if (from) flyIn(shown.dish.id, from, { slides })
}
// A saved Dish flies in from Add Dish (useSavedDishFlight).
const { arrivingId, flyIn } = useSavedDishFlight(columnsEl)


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
function moveFromMenu(columnId: string, toBoard: BoardListing | null) {
  const dishId = menuDish.value?.id
  menuDish.value = null
  const result = dishId && moveToPicked(boardModule, dishId, columnId, toBoard)
  if (result) void showResult(result, { moved: { toBoard } })
}
function deleteFromMenu() {
  const dishId = menuDish.value?.id
  menuDish.value = null
  const result = dishId && boardModule.deleteDish(dishId)
  if (result) void showResult(result)
}

// Shows what an operation of the Board module answered, from a card or the
// Dish detail: haptics for a Dish or Cooking deleted (PRD stories 47, 48);
// for a Dish moved with "Verschieben nach…", a Toast saying where to; its
// notice, as a Toast offering "Rückgängig" if it comes with an undo (whose
// result shows the same way), or for a Cooking recorded the Gekocht
// celebration (its confetti from `origin`); then what its write ended in,
// once settled; and focus where it says, unless dragging moved it
// (`moveFocus: false`) or the Dish detail makes the Board inert (focus goes
// back as it closes). A Dish moved into another Board's Gekocht Column from
// its detail leaves the screen with the detail: it celebrates over the
// Board once the detail has closed, unless its move has failed by then,
// and focus is left to the detail's closing.
async function showResult(result: BoardResult, { origin, moved, moveFocus = true }: ResultContext & { moveFocus?: boolean } = {}) {
  const { notice, undo, settled } = result
  const inDetail = !!route.params.dish
  let ended: BoardResult | undefined
  void settled?.then(r => (ended = r))
  if (notice === 'deleted' || notice === 'cookingDeleted') hapticReject()
  if (moved && !notice) {
    const text = movedText(result, moved.toBoard)
    if (text) showNotice(text)
  }
  if (notice === 'cook') {
    const shown = moved?.toBoard ? await detailClosed() : true
    if (shown && !ended?.notice) celebrateCooking(result, origin, moved?.toBoard)
  }
  else if (notice) {
    const text = noticeText(notice, result)
    showToast(undo
      ? { text, duration: UNDO_WINDOW_MS, actions: [{ label: t.dish.undo, run: () => void undo().then(r => showResult(r)) }] }
      : { text, duration: NOTICE_MS })
  }
  void settled?.then(r => showResult(r))
  if (moveFocus && result.focus && !inDetail && !route.params.dish) await focusOn(result.focus)
}

// Where "Verschieben nach…" moved a Dish to: a Column of this Board, or of
// `toBoard` (into a Gekocht Column, the Gekocht celebration says so
// instead).
function movedText({ dish, placement }: BoardResult, toBoard: BoardListing | null) {
  const column = (toBoard ?? board.value)?.columns.find(c => c.id === placement?.columnId)
  if (!column) return null
  return toBoard ? t.dish.movedToBoard(dish.title, boardLabel(toBoard), column.name) : t.dish.moved(dish.title, column.name)
}

// A notice's text in the UI strings: about the result's Cooking, or its Dish.
function noticeText(notice: Exclude<Notice, 'cook'>, { dish, cooking }: BoardResult) {
  switch (notice) {
    case 'cookingDeleted': return t.cooking.deleted(new Date(cooking!.cookedAt))
    case 'cookingDeleteFailed': return t.cooking.deleteFailed
    case 'cookingRestoreFailed': return t.cooking.restoreFailed
    case 'imageNotStored': return t.addDish.imageNotStored(dish.title)
    case 'photoNotStored': return t.addDish.photoNotStored(dish.title)
    case 'imageNotReplaced': return t.detail.imageNotStored(dish.title)
    default: return t.dish[notice](dish.title)
  }
}

// Resolves once the Dish detail has closed and the Board shows its own
// Toast, pill and confetti again (at once if it isn't open): true, or
// false if the Board went first.
async function detailClosed(): Promise<boolean> {
  const closed = route.params.dish ? await new Promise<boolean>(resolve => detailWaiters.add(resolve)) : true
  await nextTick()
  return closed
}

// A Cooking recorded (PRD stories 49–55), as decided on #105: haptics,
// confetti from `origin` (from the Gekocht pill without one; none if
// `null`, as the caller set it off already), the Gekocht pill at the top
// with Topfbert (naming `toBoard`, for a Dish moved into its Gekocht
// Column), and the Gekocht toast at the bottom, offering "Notiz
// hinzufügen" once the Cooking is recorded, and "Rückgängig". The Cooking
// that makes the Dish a Klassiker (the 10th) celebrates that too.
function celebrateCooking({ dish, undo, settled }: BoardResult, origin?: Point | null, toBoard?: BoardListing | null) {
  const recorded = settled?.then(r => r.cooking ?? null) ?? Promise.resolve(null)
  hapticCelebrate()
  gekochtPill.show({ cheer: nextCheer(t.dish.cheers), ...toBoard && { board: boardLabel(toBoard) } })
  if (origin !== null) confetti.fire(origin ?? gekochtPill.origin())
  showToast({
    text: t.dish.cook,
    ...toBoard && { unseen: t.dish.cookedOn(boardLabel(toBoard)) },
    duration: UNDO_WINDOW_MS,
    actions: [
      { label: t.dish.addNote, run: async () => {
        const cooking = await recorded
        if (cooking) addNote(dish, cooking)
      } },
      ...undo ? [{ label: t.dish.undo, run: () => void undo().then(r => showResult(r)) }] : [],
    ],
  })
  if (dish.cookings.length === MILESTONE_COOKINGS) void celebrateMilestone(dish, recorded)
}
</script>

<template>
  <main
    v-if="board"
    class="board min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10 desktop:px-16"
    :class="{ following, dragging, 'drop-tinted': dropTint }"
    :style="{ '--tint': tint, '--drop-tint': dropTint, '--drop-wash': dropWash, ...colours }"
  >
    <header class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-3">
        <BoardSwitcher :board="board" />
        <RoundButton
          v-if="!searchOpen"
          ref="searchButton"
          raised
          :aria-label="t.search.open"
          :data-tooltip="t.search.open"
          @click="searchOpen = true"
        >
          <AppIcon
            name="search"
            :size="20"
          />
        </RoundButton>
        <NuxtLink
          :to="boardSettingsPath(board)"
          :aria-label="t.settings.title"
          :data-tooltip="t.settings.title"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-text shadow-card transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <AppIcon
            name="settings"
            :size="20"
          />
        </NuxtLink>
      </div>
      <UserMenu
        v-if="me"
        :me="me"
        class="hidden shrink-0 tablet:block"
      />
    </header>

    <BoardSearchBar
      v-if="searchOpen"
      ref="searchBar"
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

    <!-- Phones: the active Column's name and subtitle, large. -->
    <ColumnHeadline
      v-show="!searching"
      class="-mx-4 mt-5 px-4"
      :columns="board.columns"
      :active="activeIndex"
      :progress="progress"
      :following="following"
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
      class="columns mt-2 tablet:-mx-4 tablet:-mb-6 tablet:mt-5 tablet:snap-x tablet:snap-mandatory tablet:scroll-px-4 tablet:overflow-x-auto tablet:px-4 tablet:pb-10 tablet:pt-3"
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
          :style="{ '--accent': columnAccent(index) }"
          :data-column-id="column.id"
          data-lane
          :data-gekocht="column.isGekocht || undefined"
        >
          <!-- Phones show it above the tabs (ColumnHeadline) instead. -->
          <ColumnTitle
            class="hidden tablet:block"
            :subtitle="column.subtitle"
          >
            <span
              :key="columnCue?.value.columnId === column.id ? columnCue.key : 0"
              class="column-name relative inline-block"
              :class="columnCue?.value.columnId === column.id && `cue-${columnCue.value.kind}`"
            >
              {{ column.name }}
              <PebbleBurst
                v-if="columnCue?.value.columnId === column.id && columnCue.value.kind !== 'bump'"
                :color="columnAccent(index)"
              />
            </span>
          </ColumnTitle>
          <!-- Never shorter than with only the empty state in it. -->
          <div class="min-h-[var(--height-empty-column)]">
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
                @click.capture="dish && openDish($event, dish)"
              >
                <template v-if="dish">
                  <NuxtLink
                    :id="`dish-${dish.id}`"
                    :to="dishPath(address, dish)"
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
                    :data-tooltip="t.dish.more"
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
                :accent="columnAccentName(index)"
                :illustration="emptyColumnIllustration(board.id, index)"
                :play="!!boardLoop.motionOf(emptyClipId(column))"
                :data-empty-clip="emptyClipId(column)"
              />
            </template>
          </div>
        </section>
        <!-- Desktop: a new Column is added here, after the last one. -->
        <AddColumnLane
          class="hidden desktop:block"
          @failed="showNotice(t.settings.failed)"
        />
      </div>
    </div>

    <!-- The dragged card, following the pointer above everything. -->
    <DragCard
      v-if="drag"
      :drag="drag"
      :is-new="newDishIds.has(drag.dish.id)"
      :motion="boardLoop.motionOf(drag.dish.id)"
    />

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
      :data-tooltip="t.addDish.open"
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

    <template v-if="!route.params.dish">
      <VeggieConfetti />
      <GekochtPill below-tabs />
      <AppToast v-model="toast" />
    </template>

    <CookingNoteSheet
      v-model:cooking="notingCooking"
      :dish="noting?.dish ?? null"
    />

    <AddDishSheet
      v-model:open="adding"
      :board-id="board.id"
      :shared-link="sharedLink"
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
          <p class="section-heading px-1">
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

    <ShortcutsDialog v-model:open="showingShortcuts" />

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
        <GekochtPill below-tabs />
        <AppToast v-model="toast" />
      </template>
    </CelebrationDialog>

    <NuxtPage
      v-model:toast="toast"
      :board="board"
      @result="showResult"
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
  .track.following {
    transition: none;
  }
  .column.parked {
    visibility: hidden;
    height: 0;
    padding-block: 0;
    overflow: hidden;
  }
}
/* Reduced motion: no sliding, and the tint cuts (tokens.css collapses
   --dur-swoosh); the new Column cross-fades in. */
@media (max-width: 767.98px) and (prefers-reduced-motion: reduce) {
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
  transition: scale var(--dur-tap) var(--ease-tap), rotate var(--dur-tap) var(--ease-tap), translate var(--dur-settle) var(--ease-settle);
}
/* Under a mouse its pebble lightens, and with motion it grows and tilts as
   the primary pill does (handoff Button "hover"); not while pressed. */
@media (hover: hover) and (pointer: fine) {
  .fab:not(:active):hover::before {
    background: color-mix(in srgb, var(--color-inverse) 84%, var(--color-bg));
  }
}
@media (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference) {
  .fab:not(:active):hover {
    scale: 1.05;
    rotate: -1deg;
  }
}
.fab::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  border-radius: inherit;
  background: var(--color-inverse);
  box-shadow: var(--shadow-fab);
  transition: background-color var(--dur-fade) var(--ease-fade);
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
/* Dragging a Dish: the dragged card is DragCard. */
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
   lanes dim. The page tints toward it. Reduced motion: fill and ring.
   The lanes scroll sideways, which clips them, so they have room around them
   for the ring (12px above, 16px beside, for a long lane's wiggle, 40px
   below), and a lane grows from its top, however long it is. */
@media (min-width: 768px) {
  .column {
    transform-origin: top;
    transition: scale var(--dur-fade) var(--ease-pop), opacity var(--dur-fade) var(--ease-fade), box-shadow var(--dur-fade) var(--ease-fade), background-color var(--dur-fade) var(--ease-fade);
  }
  .column.lane-target {
    scale: 1.012;
    background-color: color-mix(in oklab, var(--accent) var(--wash-lane-target), var(--color-bg));
    /* Pulled further than at rest (main.css), for AA on the fuller fill. */
    --color-text-muted: color-mix(in oklab, var(--color-text) 40%, var(--board-muted));
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
/* A Dish dragged over a Column tints the page in its accent, and dropping
   it brings the page back: on phones its background colour (over the active
   Column's tint), with every Column showing a wash over the gradient
   (main.css), which fades in and out. Reduced motion: the tint cuts. */
@media (max-width: 767.98px) {
  .board.drop-tinted {
    background-color: color-mix(in oklch, var(--drop-tint) 22%, var(--color-bg));
    transition: background-color var(--dur-fade) var(--ease-fade);
  }
}
@media (min-width: 768px) {
  .board {
    isolation: isolate;
  }
  .board::before {
    content: '';
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background-color: color-mix(in oklch, var(--drop-wash, var(--color-bg)) 22%, var(--color-bg));
    opacity: 0;
    transition: opacity var(--dur-fade) var(--ease-fade), background-color var(--dur-fade) var(--ease-fade);
  }
  .board.drop-tinted::before {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .board.drop-tinted,
  .board::before {
    transition: none;
  }
}
@keyframes fab-prompt {
  0%, 100% { box-shadow: var(--shadow-fab), 0 0 0 2px var(--color-focus); }
  50% { box-shadow: var(--shadow-fab), 0 0 0 11px color-mix(in srgb, var(--color-butter) 0%, transparent); }
}
</style>
