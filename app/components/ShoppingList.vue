<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { ShoppingEntry, ShoppingGroup as Group } from '~/board/shopping-list'
import type { Toast } from '~/utils/toast'
import { keyboardInset } from '~/utils/shopping-layout'

// The Shopping List (CONTEXT.md: Shopping List, Shopping Item; ADR 0015;
// #536): the Board's list of what to buy, a view beside the Columns and the
// Week Plan, the same for every Member. This component keeps the state and
// makes the Board calls; the groups, lines and fields are ShoppingGroup,
// ShoppingItem, ShoppingItemInput and EmptyShoppingList.
//
// Phone: one column, Sonstiges first. Lines are typed through the FAB, which
// opens an add bar docked on the keyboard.
// Desktop: a Sonstiges column with its field at the end, and two masonry
// columns of Dish groups; "n" focuses the field. With nothing on the list,
// EmptyShoppingList stands in, with its field on desktop. Coming to the list,
// the groups rise in turn; what is said after a tick, an add or a removal goes
// to a polite live region. "Erledigte entfernen" clears every ticked line,
// with "Rückgängig" in a toast.
const props = defineProps<{
  board: BoardView
  // The Shopping List is the view showing (and not covered by the search).
  visible: boolean
}>()
const emit = defineEmits<{ toast: [Toast], adding: [open: boolean] }>()

const t = useStrings()
const boardModule = useBoardModule()
const { showShoppingResult } = useShoppingResult(toast => emit('toast', toast))

const titleId = useId()
const groups = computed<Group[]>(() => {
  // Read through the Board, so a poll or a write anywhere redraws it.
  void props.board.shoppingItems.length
  return boardModule.shoppingList()
})
const isEmpty = computed(() => groups.value.length === 0)
const ticked = computed(() => groups.value.reduce((n, g) => n + g.items.filter(i => i.ticked).length, 0))

// Sonstiges, and the Dish groups in list order. On desktop Sonstiges has its
// column even without lines (its field is there), so it gets an empty group.
const wide = useMediaQuery('(min-width: 1200px)')
const sonstiges = computed(() => groups.value.find(g => g.dishId === null))
const other = computed<Group>(() => sonstiges.value ?? { dishId: null, title: null, dish: null, times: 1, items: [] })
const dishGroups = computed(() => groups.value.filter(g => g.dishId !== null))
// A group's place on the phone's one column, after Sonstiges.
const orderOf = computed(() => new Map(dishGroups.value.map((g, i) => [g.dishId, i + 1])))

// ---- Desktop: two masonry columns for the Dish groups ----
// Each new Dish group goes into the shorter column. The column of each group
// is set when the set of Dish groups changes, from the groups' heights
// (measured with a ResizeObserver, so a group that has grown counts when the
// next group comes). Between changes a group stays where it is, so nothing
// jumps while lines are ticked.
const GROUP_GAP = 18
const root = useTemplateRef<HTMLElement>('root')
const column = ref(new Map<string | null, 0 | 1>())
const columns = computed(() => {
  const cols: [Group[], Group[]] = [[], []]
  for (const g of dishGroups.value) cols[column.value.get(g.dishId) === 1 ? 1 : 0].push(g)
  return cols
})
const dishKeys = computed(() => dishGroups.value.map(g => g.dishId).join(','))
const heights = new Map<string, number>()
let observer: ResizeObserver | undefined
// The layout was not measured while the list is hidden (its heights are 0
// then), so the columns are worked out when it shows.
let stale = true
function groupElement(id: string): HTMLElement | undefined {
  return root.value?.querySelector<HTMLElement>(`[data-shopping-group="${id}"]`) ?? undefined
}
function assignColumns() {
  if (!props.visible) {
    stale = true
    return
  }
  stale = false
  const ids = dishGroups.value.map(g => g.dishId!)
  const hs = ids.map((id) => {
    const el = groupElement(id)
    if (el) observer?.observe(el)
    return heights.get(id) ?? el?.offsetHeight ?? 0
  })
  const picked = masonryColumns(hs, GROUP_GAP)
  column.value = new Map(ids.map((id, i) => [id, picked[i]!]))
}
watch(dishKeys, assignColumns, { flush: 'post' })
watch(() => props.visible, (now) => {
  if (now && stale) assignColumns()
}, { flush: 'post' })
onMounted(() => {
  observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement
      const id = el.dataset.shoppingGroup
      // A hidden group measures 0: that is no height to keep.
      if (id && el.offsetHeight > 0) heights.set(id, el.offsetHeight)
    }
  })
  assignColumns()
})
onBeforeUnmount(() => observer?.disconnect())

// ---- Typing an item into "Sonstiges" ----

const draft = ref('')
// On a phone the FAB (or the empty list's button) opens the add bar: a field
// docked on the keyboard. It stays open while lines go in, and closes on an
// empty Enter, on focus leaving it, or when the view is left.
const adding = ref(false)
const barField = useTemplateRef<{ focus: () => void, blur: () => void }>('barField')
// The desktop field at the end of Sonstiges (or in the empty list's card).
const deskField = useTemplateRef<{ focus: () => void }>('deskField')
function setAdding(open: boolean) {
  adding.value = open
  emit('adding', open)
}
async function openAdd() {
  if (adding.value) {
    barField.value?.focus()
    return
  }
  setAdding(true)
  // The field shows after this tick; focusing it inside the tap keeps the
  // keyboard up on Android.
  await nextTick()
  barField.value?.focus()
}
function closeAdd() {
  if (!adding.value) return
  setAdding(false)
  barField.value?.blur()
}
// Focus moving inside the bar (the "+", say) keeps it open.
function onBarFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Node && (event.currentTarget as HTMLElement).contains(next)) return
  closeAdd()
}
// What assistive tech hears after a change: one polite live line, cleared
// first so the same words twice are read twice.
const live = ref('')
function say(text: string) {
  live.value = ''
  void nextTick(() => (live.value = text))
}

function addItem() {
  const line = draft.value.trim()
  const result = boardModule.addShoppingItem(line)
  if (!result) {
    // An empty Enter closes the bar.
    closeAdd()
    return
  }
  say(t.shopping.addedLive(line))
  draft.value = ''
  showShoppingResult(result)
  // Enter adds and keeps the field: several in a row.
  const field = adding.value ? barField.value : deskField.value
  field?.focus()
}
// "n": on desktop the Sonstiges field, on a phone the add bar.
function focusAdd() {
  if (wide.value) deskField.value?.focus()
  else void openAdd()
}
defineExpose({ openAdd, focusAdd })

// The bar rises with the on-screen keyboard: the keyboard takes the bottom of
// the visual viewport, and the page keeps its height.
const keyboard = ref(0)
function measureKeyboard() {
  const viewport = window.visualViewport
  keyboard.value = keyboardInset(window.innerHeight, viewport?.height ?? window.innerHeight, viewport?.offsetTop ?? 0)
}
onMounted(() => {
  measureKeyboard()
  window.visualViewport?.addEventListener('resize', measureKeyboard)
  window.visualViewport?.addEventListener('scroll', measureKeyboard)
})
onBeforeUnmount(() => {
  window.visualViewport?.removeEventListener('resize', measureKeyboard)
  window.visualViewport?.removeEventListener('scroll', measureKeyboard)
})
watch(() => props.visible, (now) => {
  if (!now) closeAdd()
})

// On desktop an empty list's card has its field, and it takes the focus when
// the list shows: the next line can be typed at once.
watch(() => props.visible, (now) => {
  if (now && isEmpty.value && wide.value) void nextTick(() => deskField.value?.focus())
}, { immediate: true })

// On coming to the list the groups come in one after another (`arriving`
// lasts past the last one's settle). Only then: a redraw doesn't repeat it.
const arriving = ref(false)
let arrivingTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.visible, (now) => {
  if (!now) return
  arriving.value = true
  clearTimeout(arrivingTimer)
  arrivingTimer = setTimeout(() => (arriving.value = false), 1200)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(arrivingTimer))

// ---- A line ----

function tick(entry: ShoppingEntry) {
  if (editing.value === entry.id) return
  const result = boardModule.tickShoppingItem(entry.id, !entry.ticked)
  if (!result) return
  hapticTick()
  say(entry.ticked ? t.shopping.untickedLive(entry.text) : t.shopping.tickedLive(entry.text))
  showShoppingResult(result)
}

const editing = ref<string | null>(null)
function startEdit(entry: ShoppingEntry) {
  editing.value = entry.id
}
function saveEdit(entry: ShoppingEntry, text: string) {
  if (editing.value !== entry.id) return
  editing.value = null
  const result = boardModule.changeShoppingItem(entry.id, text)
  if (result) showShoppingResult(result)
}
function cancelEdit() {
  editing.value = null
}

function remove(entry: ShoppingEntry) {
  const result = boardModule.deleteShoppingItem(entry.id)
  if (!result) return
  say(t.shopping.removed)
  showShoppingResult(result, { text: t.shopping.removed, undo: true })
}

function clearDone() {
  const result = boardModule.clearTicked()
  if (result) showShoppingResult(result, { text: t.shopping.cleared(result.count), undo: true })
}
</script>

<template>
  <section
    class="shopping-list relative mx-auto pb-[130px] desktop:max-w-[1080px] desktop:pb-10"
    :class="{ arriving }"
    :aria-labelledby="titleId"
    data-testid="shopping-list"
  >
    <div class="flex min-h-12 items-center gap-2 desktop:min-h-[60px] desktop:gap-3">
      <h2
        :id="titleId"
        class="min-w-0 flex-1 text-balance font-display text-[23px] font-medium leading-[1.12] desktop:text-[30px]"
      >
        {{ t.shopping.title }}
      </h2>
      <!-- Only while something is ticked: nothing to clear, no button. -->
      <button
        v-if="ticked > 0"
        type="button"
        class="flex h-10 shrink-0 items-center gap-1.5 rounded-pill bg-surface-muted px-4 text-button transition-[transform,opacity] duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        data-clear-done
        @click="clearDone"
      >
        <AppIcon
          name="trash"
          :size="16"
        />
        {{ t.shopping.clearDone }}
      </button>
    </div>

    <p
      class="sr-only"
      aria-live="polite"
      data-shopping-live
    >{{ live }}</p>
    <!-- The phone's add bar: docked on the keyboard, shown while adding. -->
    <div
      v-show="adding"
      class="fixed inset-x-0 bottom-0 z-shop-field rounded-t-[26px] bg-bg px-3 pb-2.5 pt-3.5 desktop:hidden"
      :style="{ bottom: `${keyboard}px` }"
      @focusout="onBarFocusOut"
    >
      <ShoppingItemInput
        ref="barField"
        v-model="draft"
        variant="add"
        @submit="addItem"
      />
    </div>

    <EmptyShoppingList
      v-if="isEmpty"
      @write="openAdd"
    >
      <ShoppingItemInput
        ref="deskField"
        v-model="draft"
        variant="add"
        class="hidden desktop:flex"
        @submit="addItem"
      />
    </EmptyShoppingList>
    <!-- One column on a phone: the groups are flex items of this list, in
         order (Sonstiges first). On desktop: Sonstiges, then two columns of
         Dish groups. The column wrappers are `contents` on a phone. -->
    <div
      v-else
      ref="root"
      class="mt-5 flex flex-col gap-3.5 desktop:flex-row desktop:items-start desktop:gap-x-7"
    >
      <div
        class="contents desktop:flex desktop:w-[360px] desktop:shrink-0 desktop:flex-col desktop:gap-[18px]"
        :class="{ 'hidden desktop:flex': !sonstiges }"
      >
        <ShoppingGroup
          :group="other"
          :editing-id="editing"
          class="shop-group"
          :style="{ '--shop-i': 0 }"
          @tick="tick"
          @edit="startEdit"
          @save="saveEdit"
          @cancel="cancelEdit"
          @remove="remove"
        >
          <ShoppingItemInput
            ref="deskField"
            v-model="draft"
            variant="add"
            class="mt-3 hidden desktop:flex"
            @submit="addItem"
          />
        </ShoppingGroup>
      </div>
      <TransitionGroup
        v-for="(col, c) in columns"
        :key="c"
        tag="div"
        name="group"
        class="contents desktop:flex desktop:min-w-0 desktop:flex-1 desktop:flex-col desktop:gap-[18px]"
      >
        <ShoppingGroup
          v-for="group in col"
          :key="group.dishId ?? 'other'"
          :group="group"
          :editing-id="editing"
          class="shop-group"
          :style="{ order: orderOf.get(group.dishId) ?? 0, '--shop-i': orderOf.get(group.dishId) ?? 0 }"
          @tick="tick"
          @edit="startEdit"
          @save="saveEdit"
          @cancel="cancelEdit"
          @remove="remove"
        />
      </TransitionGroup>
    </div>
  </section>
</template>

<style scoped>
/* Coming to the list: the groups rise 14px and fade in, 40ms apart from
   140ms (--shop-i is each group's place), settling over 480ms. Reduced
   motion: none. */
.arriving .shop-group {
  animation: shop-arrive var(--dur-settle) var(--ease-settle) backwards;
  animation-delay: calc(140ms + var(--shop-i, 0) * 40ms);
}
@keyframes shop-arrive {
  from {
    opacity: 0;
    translate: 0 14px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .arriving .shop-group {
    animation: none;
  }
}

/* A group coming or going fades; it settles to its place when the groups
   move. Reduced motion: no moving, a fade. */
.group-move {
  transition: translate var(--dur-settle) var(--ease-settle);
}
.group-enter-active,
.group-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.group-leave-active {
  position: absolute;
  visibility: hidden;
}
.group-enter-from {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .group-move {
    transition: none;
  }
}
</style>
