<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { ShoppingEntry, ShoppingGroup as Group } from '~/board/shopping-list'
import type { Toast } from '~/utils/toast'
import { keyboardInset } from '~/utils/shopping-layout'

// The Shopping List (CONTEXT.md: Shopping List, Shopping Item; ADR 0015;
// #536): the Board's list of what to buy, a view beside the Columns and the
// Week Plan, the same for every Member. This component keeps the state and
// makes the Board calls; the groups, lines and fields are ShoppingGroup,
// ShoppingItem, ShoppingItemInput and EmptyShoppingList. "Erledigte
// entfernen" clears every ticked line, with "Rückgängig" in a toast. Built
// from the R14 patterns (cards, pills, toasts) until the Shopping List's own
// handoff (#527) arrives.
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

// ---- Typing an item into "Sonstiges" ----

const draft = ref('')
// On a phone the FAB (or the empty list's button) opens the add bar: a field
// docked on the keyboard. It stays open while lines go in, and closes on an
// empty Enter, on focus leaving it, or when the view is left.
const adding = ref(false)
const barField = useTemplateRef<{ focus: () => void, blur: () => void }>('barField')
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
function addItem() {
  const result = boardModule.addShoppingItem(draft.value)
  if (!result) {
    // An empty Enter closes the bar.
    closeAdd()
    return
  }
  draft.value = ''
  showShoppingResult(result)
  // Enter adds and keeps the field: several in a row.
  barField.value?.focus()
}
function focusAdd() {
  void openAdd()
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

// ---- A line ----

function tick(entry: ShoppingEntry) {
  if (editing.value === entry.id) return
  const result = boardModule.tickShoppingItem(entry.id, !entry.ticked)
  if (!result) return
  hapticTick()
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
  if (result) showShoppingResult(result, { text: t.shopping.removed, undo: true })
}

function clearDone() {
  const result = boardModule.clearTicked()
  if (result) showShoppingResult(result, { text: t.shopping.cleared(result.count), undo: true })
}
</script>

<template>
  <section
    class="shopping-list relative mx-auto pb-24 desktop:max-w-[760px] desktop:pb-10"
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

    <EmptyShoppingList v-if="isEmpty" />
    <TransitionGroup
      v-else
      tag="div"
      name="group"
      class="mt-5 flex flex-col gap-4"
    >
      <ShoppingGroup
        v-for="group in groups"
        :key="group.dishId ?? 'other'"
        :group="group"
        :editing-id="editing"
        @tick="tick"
        @edit="startEdit"
        @save="saveEdit"
        @cancel="cancelEdit"
        @remove="remove"
      />
    </TransitionGroup>
  </section>
</template>

<style scoped>
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
