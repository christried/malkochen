<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { BoardView } from '~~/server/utils/boards'
import type { DishView } from '~~/server/utils/dishes'
import type { PlanEntry } from '~/board/board-module'
import { addWeeks, isCurrentWeek, isPastDay, weekDays, weekStart } from '~/board/week-days'
import { dishPath } from '~~/shared/address'
import { NOTICE_MS, type Toast } from '~/utils/toast'

// The Week Plan (CONTEXT.md: Week Plan, Planned Dish; ADR 0014; handoff R14):
// the Board's week, Monday to Sunday, one week at a time, a view beside the
// Columns. Each day lists its Planned Dishes in order. "+" on a day opens the
// Dish picker. Planned Dishes open the Dish detail; they are reordered and
// moved by dragging (with the day strip on phones), from their "⋯" menu, or
// with Alt and the arrow keys. Every change except planning from "+" comes
// with a toast offering "Rückgängig", which is the opposite write through
// the Board module. A Member who may not move Dishes sees the plan with
// nothing to change. The week to browse is this component's own; the choice
// of view is the Board's (useBoardView).
//
// Who cooks a Planned Dish is set from its cook's Profile Picture or "Wer
// kocht?" in its menu (CookPicker). "Gekocht ✓" is on today's only, for a
// Member who may move Dishes, and goes up to the Board page (`cook`), which
// does what a card's "Gekocht ✓" does. A Planned Dish is ticked when its Dish
// has a Cooking that day, from wherever it was recorded. "Einplanen" is in
// the Dish detail.
const props = defineProps<{
  board: BoardView
  // The Week Plan is the view showing (and not covered by the search).
  visible: boolean
  // The Member may move Dishes, which covers the Week Plan.
  canChange: boolean
}>()
const emit = defineEmits<{
  toast: [Toast]
  dragging: [boolean]
  // "Gekocht ✓" on today's Planned Dish: the Board page cooks the Dish as it
  // does for a card, with the confetti bursting from `origin`.
  cook: [dishId: string, origin: Point]
}>()

const t = useStrings()
const boardModule = useBoardModule()
const address = useOpenBoardAddress()
const today = useToday()
const wide = useMediaQuery('(min-width: 1200px)')

const titleId = useId()
const surface = useTemplateRef<HTMLElement>('surface')
const strip = useTemplateRef<ComponentPublicInstance>('strip')

// ---- The week shown ----

const shownMonday = ref(weekStart(today.value))
const days = computed(() => weekDays(shownMonday.value))
const plan = computed(() => boardModule.weekPlan(days.value))
const isEmpty = computed(() => days.value.every(day => (plan.value[day] ?? []).length === 0))
const current = computed(() => isCurrentWeek(shownMonday.value, today.value))
const pastWeek = computed(() => isPastDay(days.value.at(-1)!, today.value))
const isPast = (day: string) => isPastDay(day, today.value)
// A Planned Dish of the shown week as it is now, if it is still there.
const entryById = (id: string) => Object.values(plan.value).flat().find(e => e.id === id)
// The way the week slid in, for its animation.
const direction = ref<'next' | 'previous'>('next')

function browse(weeks: number) {
  direction.value = weeks > 0 ? 'next' : 'previous'
  shownMonday.value = addWeeks(shownMonday.value, weeks)
  void settleScroll()
}
function goToday() {
  const monday = weekStart(today.value)
  if (monday === shownMonday.value) return void settleScroll()
  direction.value = monday > shownMonday.value ? 'next' : 'previous'
  shownMonday.value = monday
  void settleScroll()
}

// A phone shows the whole week in one scroll: it opens on today (the current
// week) or at the top of the week (any other).
async function settleScroll(smooth = false) {
  if (wide.value || !props.visible) return
  await nextTick()
  // Another week starts with its title and arrows, so browsing on is at hand.
  const target = current.value ? surface.value?.querySelector<HTMLElement>('[data-today]') : surface.value
  target?.scrollIntoView({ block: 'start', behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'instant' })
}

// Shown anew (switched to from the Columns): the days arrive one after the
// other, and a phone is on today.
const entering = ref(false)
let enteringTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.visible, async (visible) => {
  if (!visible) return
  entering.value = true
  clearTimeout(enteringTimer)
  enteringTimer = setTimeout(() => (entering.value = false), 1000)
  await settleScroll()
})
onMounted(() => void settleScroll())
onBeforeUnmount(() => clearTimeout(enteringTimer))

// ---- "Woche auf die Einkaufsliste" (#537) ----

// For the current and later weeks, for every Member: puts the Dishes planned
// from today (or the shown week's Monday) to its Sunday on the Shopping List.
// The toast says how many went on once the server has answered.
const puttingWeek = ref(false)
async function putWeekOn() {
  if (puttingWeek.value) return
  puttingWeek.value = true
  try {
    const result = await boardModule.putWeekOn(shownMonday.value)
    if (!result) return
    if (result.notice) {
      hapticReject()
      emit('toast', { text: result.notice === 'shoppingFull' ? t.shopping.full : t.shopping.failed, duration: NOTICE_MS })
      return
    }
    hapticConfirm()
    emit('toast', {
      text: result.unsent ? t.shopping.weekLater : result.dishes === 0 ? t.shopping.weekNothing : t.shopping.weekDone(result.dishes),
      duration: NOTICE_MS / 2,
    })
  }
  finally {
    puttingWeek.value = false
  }
}

// ---- Showing what a write answered ----

const { showPlanResult } = usePlanResult(toast => emit('toast', toast))

// Said to screen readers: where a Planned Dish is now.
const live = ref('')
function announce(entry: PlanEntry, day: string) {
  const list = plan.value[day] ?? boardModule.weekPlan([day])[day] ?? []
  const place = list.findIndex(e => e.id === entry.id) + 1
  live.value = ''
  void nextTick(() => (live.value = t.week.nowAt(entry.dish.title, day, place, list.length)))
}

// ---- Changing the plan ----

// The place of a Planned Dish in its day, to put it back there.
const placeIn = (entry: PlanEntry) => (plan.value[entry.day] ?? []).findIndex(e => e.id === entry.id)

// Moves a Planned Dish to a day (`index` among that day's others, else the
// end). To another day it says so, with "Rückgängig" moving it back.
function moveEntry(entry: PlanEntry, day: string, index?: number) {
  const was = { day: entry.day, index: placeIn(entry) }
  const result = boardModule.movePlannedDish(entry.id, day, index)
  if (!result) return
  announce(entry, day)
  showPlanResult(result, day === was.day
    ? undefined
    : { text: t.week.moved(day, today.value), undo: () => boardModule.movePlannedDish(entry.id, was.day, was.index) })
}

// One step up or down within its day.
function step(entry: PlanEntry, by: -1 | 1) {
  const at = placeIn(entry)
  const total = (plan.value[entry.day] ?? []).length
  if (at + by < 0 || at + by >= total) return
  moveEntry(entry, entry.day, at + by)
}

// Alt and ←/→: the day before or after in this week, a past one skipped.
function sideways(entry: PlanEntry, by: -1 | 1) {
  const index = days.value.indexOf(entry.day) + by
  const day = days.value[index]
  if (day && !isPast(day)) moveEntry(entry, day)
}

// Taking a Planned Dish off the plan. "Rückgängig" plans the Dish again where
// it was (a new Planned Dish: the Dish stays, so nothing is lost).
function remove(entry: PlanEntry) {
  const at = placeIn(entry)
  const { dish, day, cookId } = entry
  const result = boardModule.unplanDish(entry.id)
  if (!result) return
  showPlanResult(result, {
    text: t.week.removed,
    undo: () => {
      const again = boardModule.planDish(dish.id, day, at)
      if (again && cookId) boardModule.setPlannedDishCook(again.plannedDish.id, cookId)
      return again
    },
  })
}

// A Dish picked in the picker goes to the end of the day. No toast: it lands
// in view.
function planFrom(dish: DishView, day: string) {
  const result = boardModule.planDish(dish.id, day)
  if (!result) return
  showPlanResult(result)
  void nextTick(() => {
    surface.value?.querySelector(`[data-planned-card="${CSS.escape(result.plannedDish.id)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'instant' : 'smooth' })
  })
}

// ---- The pickers ----

// What a picker on a Planned Dish holds: whether it is open, its Planned Dish
// and the button it opened from.
const entryPicker = () => reactive({ open: false, entry: null as PlanEntry | null, anchor: null as HTMLElement | null })
const dishPicker = reactive({ open: false, day: today.value, anchor: null as HTMLElement | null })
const dayPicker = entryPicker()
const menu = entryPicker()
const cookPicker = entryPicker()

// Opens the picker from `anchor` with `fields`; its own button again closes it.
function toggleAt<T extends { open: boolean, anchor: HTMLElement | null }>(picker: T, anchor: HTMLElement | null, fields: Partial<T>) {
  if (picker.open && picker.anchor === anchor) {
    picker.open = false
    return
  }
  Object.assign(picker, { open: true, anchor, ...fields })
}

const openDishPicker = (day: string, anchor: HTMLElement | null) => toggleAt(dishPicker, anchor, { day })
function pickDish(dish: DishView) {
  const { day, anchor } = dishPicker
  dishPicker.open = false
  planFrom(dish, day)
  if (wide.value) anchor?.focus({ preventScroll: true })
}
// The empty week's button: today, or the Monday of a later week.
function openEmptyPicker(anchor: HTMLElement) {
  openDishPicker(current.value ? today.value : shownMonday.value, anchor)
}

const openMenu = (entry: PlanEntry, anchor: HTMLElement) => toggleAt(menu, anchor, { entry })
// A picker's or the menu's entry as it is now (it may have moved, or been
// taken off).
const entryNow = (entry: PlanEntry | null) => entry && entryById(entry.id) || entry
const menuEntry = computed(() => entryNow(menu.entry))

// After a move the focus stays on the Planned Dish's "⋯".
async function focusMore(entry: PlanEntry) {
  await nextTick()
  surface.value?.querySelector<HTMLElement>(`[data-planned-card="${CSS.escape(entry.id)}"] [data-planned-more]`)?.focus({ preventScroll: true })
}
function menuStep(by: -1 | 1) {
  const entry = menuEntry.value
  menu.open = false
  if (!entry) return
  step(entry, by)
  void focusMore(entry)
}
function menuRemove() {
  const entry = menuEntry.value
  menu.open = false
  if (entry) remove(entry)
}
function menuMove() {
  const { entry, anchor } = menu
  menu.open = false
  if (entry) Object.assign(dayPicker, { open: true, entry, anchor })
}
function pickDayFor(day: string) {
  const entry = dayPicker.entry && entryById(dayPicker.entry.id)
  dayPicker.open = false
  if (entry) moveEntry(entry, day)
}

// ---- Who cooks ----

const cookEntry = computed(() => entryNow(cookPicker.entry))

// The cook's Profile Picture on a Planned Dish opens the picker.
const openCookPicker = (entry: PlanEntry, anchor: HTMLElement) => toggleAt(cookPicker, anchor, { entry })
function menuCook() {
  const { entry, anchor } = menu
  menu.open = false
  if (entry) Object.assign(cookPicker, { open: true, entry, anchor })
}
// A Member picked, or "Offen lassen" (null). The picture on the Planned Dish
// pops in or fades out; no toast, but a screen reader is told.
function pickCook(memberId: string | null) {
  const entry = cookEntry.value
  cookPicker.open = false
  if (!entry) return
  const member = props.board.members.find(m => m.id === memberId)
  const result = boardModule.setPlannedDishCook(entry.id, memberId)
  if (!result) return
  showPlanResult(result)
  if (result.notice) return
  live.value = ''
  void nextTick(() => (live.value = member ? t.week.cooksNow(member.name) : t.week.cooksNobody))
}

// ---- Dragging ----

const quiet = ref(false)
const { drag, dragging, entries } = useWeekDrag(surface, {
  entriesOf: day => plan.value[day] ?? [],
  isPast,
  strip: () => (strip.value?.$el as HTMLElement | undefined) ?? null,
  drop: (plannedId, day, index) => {
    const entry = entryById(plannedId)
    if (!entry) return
    // The dragged card has settled into its slot: nothing arrives anew.
    quiet.value = true
    setTimeout(() => (quiet.value = false), 100)
    moveEntry(entry, day, index)
  },
  paused: () => dishPicker.open || dayPicker.open || menu.open,
  pinned: () => !props.canChange,
})
watch(dragging, value => emit('dragging', value))
const lists = computed(() => Object.fromEntries(days.value.map(day => [day, entries(day)])))
// The day a lifted Planned Dish is over, if not its own: tinted.
const targetDay = computed(() => drag.value?.over && drag.value.over.day !== drag.value.fromDay ? drag.value.over.day : null)

// ---- Opening a Dish, keys and swipes ----

// Tapping a Planned Dish morphs its image into the Dish detail (the same
// morph as a card's, utils/dish-morph.ts). Clicks for a new tab or window are
// left to the link; so is one swallowed after a drag, which never gets here.
function onItemClick(event: MouseEvent, entry: PlanEntry) {
  const onLink = (event.target as Element).closest('.planned-link')
  if (!onLink || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const path = dishPath(address.value, entry.dish)
  const thumb = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-thumb]')
  void morphOpen(thumb, path, async () => {
    await navigateTo(path)
  })
}

// On the week: ← and → browse and T goes to today; on a Planned Dish, Alt with
// the arrows moves it (↑ ↓ within its day, ← → to the day before or after).
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, dialog, [popover]')) return
  const card = target.closest<HTMLElement>('[data-planned-id]')
  if (event.altKey && card && props.canChange && !event.ctrlKey && !event.metaKey) {
    const entry = entryById(card.dataset.plannedId!)
    const arrow: Record<string, () => void> = {
      ArrowUp: () => step(entry!, -1),
      ArrowDown: () => step(entry!, 1),
      ArrowLeft: () => sideways(entry!, -1),
      ArrowRight: () => sideways(entry!, 1),
    }
    if (!entry || !arrow[event.key]) return
    event.preventDefault()
    arrow[event.key]!()
    void nextTick(() => surface.value?.querySelector<HTMLElement>(`[data-planned-id="${CSS.escape(entry.id)}"] .planned-link`)?.focus({ preventScroll: true }))
    return
  }
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    browse(event.key === 'ArrowRight' ? 1 : -1)
  }
  else if (event.key === 't' || event.key === 'T') {
    event.preventDefault()
    goToday()
  }
}

// A finger swiping sideways over the list browses the weeks (phones).
let swipe: { id: number, x: number, y: number } | null = null
function onSwipeStart(event: PointerEvent) {
  swipe = event.pointerType === 'touch' && event.isPrimary ? { id: event.pointerId, x: event.clientX, y: event.clientY } : null
}
function onSwipeEnd(event: PointerEvent) {
  const started = swipe
  swipe = null
  if (!started || event.pointerId !== started.id || dragging.value) return
  const dx = event.clientX - started.x
  const dy = event.clientY - started.y
  if (Math.abs(dx) < Math.max(60, innerWidth * 0.18) || Math.abs(dx) < 1.2 * Math.abs(dy)) return
  hapticTick()
  browse(dx < 0 ? 1 : -1)
}
</script>

<template>
  <section
    ref="surface"
    class="week-plan relative pb-24 desktop:pb-10"
    :aria-labelledby="titleId"
    data-testid="week-plan"
    @keydown="onKeydown"
    @pointerdown="onSwipeStart"
    @pointerup="onSwipeEnd"
    @pointercancel="swipe = null"
  >
    <div class="flex min-h-12 items-center gap-2 desktop:min-h-[60px] desktop:gap-3">
      <Transition
        name="title"
        mode="out-in"
      >
        <h2
          :id="titleId"
          :key="shownMonday"
          class="min-w-0 flex-1 text-balance font-display text-[23px] font-medium leading-[1.12] desktop:flex-none desktop:text-[30px]"
          data-testid="week-title"
        >
          {{ t.week.title(shownMonday) }}
        </h2>
      </Transition>
      <span class="hidden flex-1 desktop:block" />
      <Transition name="today">
        <button
          v-if="!current"
          type="button"
          class="hidden h-10 shrink-0 items-center rounded-pill bg-inverse px-5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus desktop:flex"
          data-today-button
          @click="goToday"
        >
          {{ t.week.today }}
        </button>
      </Transition>
      <button
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-small transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.week.previous"
        data-week-previous
        @click="browse(-1)"
      >
        <AppIcon
          name="back"
          :size="18"
        />
      </button>
      <button
        type="button"
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-small transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.week.next"
        data-week-next
        @click="browse(1)"
      >
        <AppIcon
          name="back"
          :size="18"
          class="rotate-180"
        />
      </button>
    </div>

    <!-- "Woche auf die Einkaufsliste" (#537): left out on weeks gone by. -->
    <button
      v-if="!pastWeek"
      type="button"
      class="mt-2 flex h-10 items-center gap-2 rounded-pill bg-surface px-4 text-button shadow-small transition-[transform,opacity] duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
      :disabled="puttingWeek"
      data-put-week-on
      @click="putWeekOn"
    >
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="2.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"
      ><path d="M3 4h2.5l2.2 10.5a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.6" /><circle
        cx="9.5"
        cy="19.5"
        r="1.3"
      /><circle
        cx="17"
        cy="19.5"
        r="1.3"
      /></svg>
      {{ t.shopping.putWeekOn }}
    </button>

    <div
      class="relative"
      :class="{ 'desktop:min-h-[calc(100dvh-250px)]': true }"
    >
      <EmptyWeek
        v-if="isEmpty && !drag"
        class="mt-3 desktop:mt-0"
        :past="pastWeek"
        :can-plan="canChange && !pastWeek"
        @pick="openEmptyPicker"
      />
      <Transition :name="`week-${direction}`">
        <div
          :key="shownMonday"
          class="days mt-4 flex flex-col gap-4 desktop:mt-0 desktop:grid desktop:grid-cols-week desktop:items-stretch desktop:gap-3"
          :class="{ entering }"
          data-testid="week-days"
        >
          <WeekDay
            v-for="(day, i) in days"
            :key="day"
            :day="day"
            :today="today"
            :past="isPast(day)"
            :can-plan="canChange"
            :target="targetDay === day"
            :list-name="quiet || drag ? 'none' : 'planned'"
            :style="{ '--i': i }"
            @plan="anchor => openDishPicker(day, anchor)"
          >
            <li
              v-for="item in lists[day]"
              :key="item.key"
              class="planned-item relative list-none"
              :data-planned-id="item.entry?.id"
              :data-drag-state="item.state"
              :data-drop-slot="!item.entry || undefined"
              @click.capture="item.entry && onItemClick($event, item.entry)"
            >
              <PlannedDish
                v-if="item.entry"
                :entry="item.entry"
                :to="dishPath(address, item.entry.dish)"
                :can-change="canChange"
                :cookable="canChange && item.entry.day === today"
                @menu="anchor => openMenu(item.entry!, anchor)"
              >
                <template #cook>
                  <PlannedCook
                    v-if="item.entry.cook"
                    :key="item.entry.cook.id"
                    :member="item.entry.cook"
                    :can-change="canChange"
                    @open="anchor => openCookPicker(item.entry!, anchor)"
                  />
                </template>
                <template #action>
                  <CookButton
                    :filled="item.entry.cooked"
                    @cook="origin => emit('cook', item.entry!.dish.id, origin)"
                  />
                </template>
              </PlannedDish>
            </li>
          </WeekDay>
        </div>
      </Transition>
    </div>

    <!-- Browsed away from this week: a phone has "Heute" floating at the
         bottom, desktop has it in the header. -->
    <Transition name="today">
      <button
        v-if="!current && visible"
        type="button"
        class="fixed bottom-[calc(26px+var(--offline-bar,0px))] left-1/2 z-fab flex h-[46px] -translate-x-1/2 items-center rounded-pill bg-inverse px-6 text-button text-on-inverse shadow-fab transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus desktop:hidden"
        data-today-floating
        @click="goToday"
      >
        {{ t.week.today }}
      </button>
    </Transition>

    <DayStrip
      v-if="drag && !wide"
      ref="strip"
      :days="days"
      :today="today"
      :target="drag.stripDay"
    />
    <DragPlanned
      v-if="drag"
      :drag="drag"
      :to="dishPath(address, drag.entry.dish)"
      :tall="!wide && canChange && drag.entry.day === today && !drag.entry.cooked"
    />

    <PickerSurface
      v-model:open="dishPicker.open"
      :title="t.week.pickTitle(dishPicker.day, today)"
      :close-label="t.dish.closeMenu"
      :anchor="dishPicker.anchor"
      tall
      :width="400"
    >
      <template #default="{ popover }">
        <DishPicker
          :open="dishPicker.open"
          :title="t.week.pickTitle(dishPicker.day, today)"
          :close-label="t.dish.closeMenu"
          :columns="board.columns"
          :popover="popover"
          @pick="pickDish"
          @close="dishPicker.open = false"
        />
      </template>
    </PickerSurface>

    <PickerSurface
      v-model:open="menu.open"
      :title="menuEntry?.dish.title ?? ''"
      :close-label="t.dish.closeMenu"
      :anchor="menu.anchor"
      align="end"
    >
      <PlannedDishMenu
        v-if="menuEntry"
        :subtitle="t.week.dayName(menuEntry.day)"
        :first="placeIn(menuEntry) === 0"
        :last="placeIn(menuEntry) === (plan[menuEntry.day]?.length ?? 1) - 1"
        @cook="menuCook"
        @move="menuMove"
        @up="menuStep(-1)"
        @down="menuStep(1)"
        @remove="menuRemove"
      />
    </PickerSurface>

    <PickerSurface
      v-model:open="cookPicker.open"
      :title="t.week.whoCooks"
      :close-label="t.dish.closeMenu"
      :anchor="cookPicker.anchor"
    >
      <CookPicker
        v-if="cookEntry"
        :subtitle="t.week.whoCooksOn(cookEntry.dish.title, cookEntry.day)"
        :members="board.members"
        :cook-id="cookEntry.cookId"
        @pick="pickCook"
      />
    </PickerSurface>

    <PickerSurface
      v-model:open="dayPicker.open"
      :title="t.week.moveToDay"
      :close-label="t.dish.closeMenu"
      :anchor="dayPicker.anchor"
      align="end"
      :width="370"
    >
      <DayPicker
        v-if="dayPicker.entry"
        :open="dayPicker.open"
        :subtitle="dayPicker.entry.dish.title"
        :today="today"
        :from="shownMonday"
        :lies="dayPicker.entry.day"
        :dishes-on="boardModule.dishesOn"
        @pick="pickDayFor"
      />
    </PickerSurface>

    <p
      class="sr-only"
      role="status"
      aria-live="polite"
      data-testid="week-live"
    >
      {{ live }}
    </p>
  </section>
</template>

<style scoped>
/* The page scrolls vertically; a finger's sideways swipe is the list's. */
.week-plan {
  touch-action: pan-y;
}
/* The title crosses over to the next week's (fade, 240ms). */
.title-enter-active,
.title-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.title-enter-from,
.title-leave-to {
  opacity: 0;
}
/* "Heute" pops in (460ms) and fades out (150ms). */
.today-enter-active {
  animation: r14-pop var(--dur-pop) var(--ease-pop);
}
.today-leave-active {
  transition: opacity 150ms var(--ease-fade);
}
.today-leave-to {
  opacity: 0;
}

/* Browsing: the week's days leave sideways (40px, fading, 160ms) and the
   next arrive from the other side (settle, 480ms), each a little after the
   one before. Reduced motion: a crossfade. */
.week-next-leave-active,
.week-previous-leave-active {
  position: absolute;
  inset-inline: 0;
  top: 0;
  transition: translate 160ms ease-in, opacity 160ms ease-in;
}
.week-next-enter-active,
.week-previous-enter-active {
  transition: translate var(--dur-settle) var(--ease-settle), opacity var(--dur-fade) var(--ease-fade);
}
.week-next-enter-from,
.week-previous-leave-to {
  translate: 40px 0;
  opacity: 0;
}
.week-previous-enter-from,
.week-next-leave-to {
  translate: -40px 0;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .week-next-enter-from,
  .week-previous-leave-to,
  .week-previous-enter-from,
  .week-next-leave-to {
    translate: none;
  }
  .week-next-enter-active,
  .week-previous-enter-active,
  .week-next-leave-active,
  .week-previous-leave-active {
    transition: opacity 200ms var(--ease-fade);
  }
}

/* Switched to from the Columns: the days arrive one after the other (14px
   up, 40ms apart, from 140ms). */
.entering :deep(.week-day) {
  animation: day-in var(--dur-settle) var(--ease-settle) calc(140ms + var(--i, 0) * 40ms) backwards;
}
@keyframes day-in {
  from {
    opacity: 0;
    translate: 0 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .entering :deep(.week-day) {
    animation: none;
  }
}

/* A Planned Dish's place in a day's list. --h is its height, for the
   slots opening and closing. */
.planned-item {
  --h: var(--size-pd);
}
@media (min-width: 1200px) {
  .planned-item {
    --h: var(--size-pd-desktop);
  }
}
/* Where a lifted one came from, or would land: a dashed slot. */
.planned-item[data-drag-state='slot'],
.planned-item[data-drag-state='drop-slot'] {
  border: 2px dashed var(--color-line-strong);
  border-radius: var(--radius-planned);
}
.planned-item[data-drag-state='slot'] > *,
.planned-item[data-drag-state='drop-slot'] > * {
  visibility: hidden;
}
.planned-item[data-drag-state='drop-slot'] {
  height: var(--h);
  animation: r14-grow 240ms var(--ease-settle);
}
/* The dragged one over another day: its place closes, but stays in the page
   so the finger's touches reach the list. */
.planned-item[data-drag-state='gone'] {
  position: absolute;
  height: 0;
  overflow: hidden;
  visibility: hidden;
  pointer-events: none;
}

/* Arriving: its slot opens (settle, 380ms) and it drops in from 14px above
   (settle, 520ms, from 120ms). Leaving: it slides 44px out fading (260ms),
   then its slot closes (settle, 420ms). Reduced motion: it fades. */
.planned-enter-active {
  animation: r14-grow 380ms var(--ease-settle);
  overflow: hidden;
}
.planned-enter-active > * {
  animation: r14-arrive 520ms var(--ease-settle) 120ms backwards;
}
.planned-leave-active {
  overflow: hidden;
  animation: r14-gone 260ms ease-in forwards, r14-shrink 420ms var(--ease-settle) 260ms forwards;
}
.planned-move {
  transition: transform var(--dur-settle) var(--ease-settle);
}
@media (prefers-reduced-motion: reduce) {
  .planned-enter-active,
  .planned-enter-active > * {
    animation: none;
  }
  .planned-leave-active {
    animation: fade-out 200ms var(--ease-fade) forwards;
  }
  .planned-move {
    transition: none;
  }
}
@keyframes fade-out {
  to { opacity: 0; }
}
</style>
