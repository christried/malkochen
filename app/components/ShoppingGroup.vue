<script setup lang="ts">
import type { ShoppingEntry, ShoppingGroup as Group } from '~/board/shopping-list'
import { morphOpen } from '~/utils/dish-morph'
import { prefersReducedMotion } from '~/utils/motion'
import { heldOrder, SINK_HOLD_MS } from '~/utils/shopping-lines'
import { leaveKind, leavePlan, playEnter, playLeave } from '~/utils/shopping-leave'
import { dishPath } from '~~/shared/address'

// One group of the Shopping List (#536, R15): "Sonstiges" first, then one
// group per Dish in the order put on. Its Dish's heading opens the detail
// while the Dish is on the Board, its image morphing as a card's does; once
// it has gone, the title stays alone. A Dish put on twice says so under its
// title. Its lines are ShoppingItem rows; a line's events come up here with
// the line attached. A line this Member ticks or unticks waits 600ms where it
// was before it moves to its new place in the group. A line that leaves or
// comes back animates its slot (shopping-leave.ts); `clearing` is up while
// "Erledigte entfernen" runs, so its lines fade one after another.
const props = defineProps<{
  group: Group
  editingId: string | null
  clearing: boolean
}>()
const emit = defineEmits<{
  tick: [entry: ShoppingEntry]
  edit: [entry: ShoppingEntry]
  save: [entry: ShoppingEntry, text: string]
  cancel: []
  remove: [entry: ShoppingEntry]
}>()

const t = useStrings()
const address = useOpenBoardAddress()
// The heading's title, which names the group for its lines (aria-labelledby).
const titleId = useId()
// How the group is named for its lines' labels.
const groupName = computed(() => props.group.dishId === null ? t.shopping.other : (props.group.title ?? t.shopping.other))

// ---- The lines' order: a ticked line holds its place for the hold ----

// The place each line held when this Member ticked it, while it waits.
const held = ref(new Map<string, number>())
const holds = new Map<string, ReturnType<typeof setTimeout>>()
const lines = computed(() => heldOrder(props.group.items, held.value))

function holdAt(id: string, place: number) {
  release(id)
  held.value = new Map(held.value).set(id, place)
  holds.set(id, setTimeout(() => release(id), SINK_HOLD_MS))
}

function release(id: string) {
  clearTimeout(holds.get(id))
  holds.delete(id)
  if (!held.value.has(id)) return
  const next = new Map(held.value)
  next.delete(id)
  held.value = next
}

onBeforeUnmount(() => {
  for (const timer of holds.values()) clearTimeout(timer)
})

// A tap on a line holds it where it is on screen, ticking or unticking, and
// the module then moves it. The one exception: a second tap during a tick's
// hold unticks it in place, and the line never moved, so it goes back at once.
function onTick(entry: ShoppingEntry) {
  if (entry.ticked && held.value.has(entry.id)) release(entry.id)
  else holdAt(entry.id, lines.value.findIndex(line => line.id === entry.id))
  emit('tick', entry)
}

// ---- A line leaving or coming back: its slot closes or opens ----

// The lines leaving in one patch (a clear) get their place in the stagger, top
// to bottom; the count starts again once that patch is done.
let leavingInPatch = 0
function onLineLeave(el: Element, done: () => void) {
  const plan = leavePlan(leaveKind(el, props.clearing), leavingInPatch, prefersReducedMotion())
  leavingInPatch += 1
  queueMicrotask(() => (leavingInPatch = 0))
  void playLeave(el as HTMLElement, plan).then(done)
}
function onLineEnter(el: Element, done: () => void) {
  void playEnter(el as HTMLElement).then(done)
}

// ---- The heading opens the Dish ----

// Tapping the heading morphs the Dish's image into its detail, as a card does
// (R14). Clicks for a new tab or window are left to the link.
function onHeadingClick(event: MouseEvent) {
  const dish = props.group.dish
  if (!dish || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  const path = dishPath(address.value, dish)
  const thumb = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-thumb]')
  void morphOpen(thumb, path, async () => {
    await navigateTo(path)
  })
}
</script>

<template>
  <section
    class="rounded-card bg-surface p-1.5 shadow-card"
    :data-shopping-group="group.dishId ?? 'other'"
  >
    <h3 @click.capture="onHeadingClick">
      <NuxtLink
        v-if="group.dish"
        :to="dishPath(address, group.dish)"
        class="group/heading flex min-h-14 min-w-0 items-center gap-3 rounded-[14px] py-1.5 pr-2.5 pl-1.5 transition-transform duration-tap ease-tap active:scale-[.98] motion-reduce:active:scale-100 desktop:hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.shopping.openDish(group.dish.title)"
      >
        <span
          data-thumb
          class="block h-11 w-11 shrink-0 overflow-hidden rounded-[15px_13px_16px_14px] bg-surface-muted"
        >
          <DishImage
            :image-url="group.dish.imageUrl"
            :focus="group.dish.imageFocus"
            :placeholder="group.dish.placeholder"
            lazy
          />
        </span>
        <span class="flex min-w-0 flex-1 flex-col">
          <span
            :id="titleId"
            class="line-clamp-2 font-display text-[18px] font-medium leading-[1.2]"
          >{{ group.title }}</span>
          <span
            v-if="group.times >= 2"
            class="mt-0.5 text-[12.5px] font-medium text-text-muted"
          >{{ t.shopping.times(group.times) }}</span>
        </span>
        <AppIcon
          name="forward"
          :size="17"
          class="shrink-0 opacity-45 transition-opacity duration-tap desktop:group-hover/heading:opacity-90"
        />
      </NuxtLink>
      <span
        v-else-if="group.dishId !== null"
        class="flex min-h-14 min-w-0 items-center gap-3 py-1.5 pr-2.5 pl-1.5"
      >
        <span
          class="block h-11 w-11 shrink-0"
          aria-hidden="true"
        />
        <span class="flex min-w-0 flex-1 flex-col">
          <span
            :id="titleId"
            class="line-clamp-2 font-display text-[18px] font-medium leading-[1.2]"
          >{{ group.title }}</span>
          <span class="mt-0.5 text-[12.5px] font-medium text-text-muted">{{ t.shopping.gone }}</span>
        </span>
      </span>
      <span
        v-else
        :id="titleId"
        class="block pt-2.5 pr-2.5 pb-1.5 pl-3 font-display text-[19px] font-medium leading-tight"
      >{{ t.shopping.other }}</span>
    </h3>
    <TransitionGroup
      tag="ul"
      name="line"
      class="mt-1"
      :aria-labelledby="titleId"
      @enter="onLineEnter"
      @leave="onLineLeave"
    >
      <ShoppingItem
        v-for="entry in lines"
        :key="entry.id"
        :entry="entry"
        :editing="editingId === entry.id"
        :group-name="groupName"
        @tick="onTick(entry)"
        @edit="emit('edit', entry)"
        @save="text => emit('save', entry, text)"
        @cancel="emit('cancel')"
        @remove="emit('remove', entry)"
      />
    </TransitionGroup>
    <slot />
  </section>
</template>

<style scoped>
/* The lines: one settling to its place moves (settle 480ms); a new line
   arrives (460ms, its slot opening in the script); one going is played in
   the script (shopping-leave.ts). Reduced motion: no moving, no arriving
   (the script fades it), the hold stays in the script. */
.line-move {
  transition: transform var(--dur-settle) var(--ease-settle);
}
.line-enter-active {
  animation: r15-arrive 460ms var(--ease-settle);
}
@media (prefers-reduced-motion: reduce) {
  .line-move {
    transition: none;
  }
  .line-enter-active {
    animation: none;
  }
}
</style>
