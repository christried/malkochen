<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { ShoppingEntry, ShoppingGroup as Group } from '~/board/shopping-list'
import type { Toast } from '~/utils/toast'

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
const emit = defineEmits<{ toast: [Toast] }>()

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
const addField = useTemplateRef<{ focus: () => void }>('addField')
function addItem() {
  const result = boardModule.addShoppingItem(draft.value)
  if (!result) return
  draft.value = ''
  showShoppingResult(result)
  // Enter adds and keeps the field: several in a row.
  addField.value?.focus()
}

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
      <button
        v-if="!isEmpty"
        type="button"
        class="h-10 shrink-0 rounded-pill bg-surface px-4 text-button shadow-small transition-[transform,opacity] duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-40 disabled:active:scale-100"
        :disabled="ticked === 0"
        data-clear-done
        @click="clearDone"
      >
        {{ t.shopping.clearDone }}
      </button>
    </div>

    <ShoppingItemInput
      ref="addField"
      v-model="draft"
      variant="add"
      @submit="addItem"
    />

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
