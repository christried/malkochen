<script setup lang="ts">
import type { BoardView } from '~~/server/utils/boards'
import type { ShoppingEntry, ShoppingGroup } from '~/board/shopping-list'
import { dishPath } from '~~/shared/address'
import { SHOPPING_LIMITS } from '~~/shared/shopping-list'
import type { Toast } from '~/utils/toast'

// The Shopping List (CONTEXT.md: Shopping List, Shopping Item; ADR 0015;
// #536): the Board's list of what to buy, a view beside the Columns and the
// Week Plan, the same for every Member. "Sonstiges" first, then a group per
// Dish in the order put on, its Dish's image and title opening its detail
// while it is on the Board, its title alone once it has gone. A tap anywhere
// on a line ticks it off (crossed out, at the bottom of its group) or back
// on. The field on top types items into "Sonstiges", one after the other.
// A line's pencil changes its text in place; its cross removes it, with
// "Rückgängig" in a toast, and so does "Erledigte entfernen" for every
// ticked one. Every Member may do all of it. Lines not sent yet are marked
// "Noch nicht gesendet". Built from the R14 patterns (cards, pills, toasts)
// until the Shopping List's own handoff (#527) arrives.
const props = defineProps<{
  board: BoardView
  // The Shopping List is the view showing (and not covered by the search).
  visible: boolean
}>()
const emit = defineEmits<{ toast: [Toast] }>()

const t = useStrings()
const boardModule = useBoardModule()
const address = useOpenBoardAddress()
const { showShoppingResult } = useShoppingResult(toast => emit('toast', toast))

const titleId = useId()
const groups = computed<ShoppingGroup[]>(() => {
  // Read through the Board, so a poll or a write anywhere redraws it.
  void props.board.shoppingItems.length
  return boardModule.shoppingList()
})
const isEmpty = computed(() => groups.value.length === 0)
const ticked = computed(() => groups.value.reduce((n, g) => n + g.items.filter(i => i.ticked).length, 0))

// ---- Typing an item into "Sonstiges" ----

const draft = ref('')
const field = useTemplateRef<HTMLInputElement>('field')
function addItem() {
  const result = boardModule.addShoppingItem(draft.value)
  if (!result) return
  draft.value = ''
  showShoppingResult(result)
  // Enter adds and keeps the field: several in a row.
  field.value?.focus({ preventScroll: true })
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
const editText = ref('')
async function startEdit(entry: ShoppingEntry) {
  editing.value = entry.id
  editText.value = entry.text
  await nextTick()
  document.querySelector<HTMLInputElement>(`[data-shopping-edit="${CSS.escape(entry.id)}"]`)?.focus()
}
function saveEdit(entry: ShoppingEntry) {
  if (editing.value !== entry.id) return
  editing.value = null
  const result = boardModule.changeShoppingItem(entry.id, editText.value)
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

    <form
      class="mt-3 flex items-center gap-2"
      @submit.prevent="addItem"
    >
      <label class="min-w-0 flex-1">
        <span class="sr-only">{{ t.shopping.addLabel }}</span>
        <input
          ref="field"
          v-model="draft"
          type="text"
          enterkeyhint="done"
          autocomplete="off"
          :maxlength="SHOPPING_LIMITS.characters"
          :placeholder="t.shopping.addPlaceholder"
          class="h-12 w-full rounded-pill bg-surface px-5 text-body shadow-small outline-none placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          data-shopping-add
        >
      </label>
      <button
        type="submit"
        class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-inverse text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        :aria-label="t.shopping.add"
      >
        <AppIcon
          name="plus"
          :size="20"
        />
      </button>
    </form>

    <div
      v-if="isEmpty"
      class="empty-list mt-5 flex items-center gap-3 rounded-card bg-surface py-3.5 pl-2.5 pr-4 shadow-card desktop:gap-4 desktop:py-5 desktop:pl-4 desktop:pr-6"
      data-testid="empty-shopping-list"
    >
      <TopfbertIdle
        mood="pointing"
        class="w-[78px] shrink-0 desktop:w-[100px]"
      />
      <div class="min-w-0">
        <h3 class="font-display text-[21px] font-medium leading-tight">
          {{ t.shopping.emptyTitle }}
        </h3>
        <p class="mt-1 text-[14px] font-medium leading-snug text-text-muted">
          {{ t.shopping.emptyText }}
        </p>
      </div>
    </div>

    <TransitionGroup
      v-else
      tag="div"
      name="group"
      class="mt-5 flex flex-col gap-4"
    >
      <section
        v-for="group in groups"
        :key="group.dishId ?? 'other'"
        class="rounded-card bg-surface p-2 shadow-card"
        :data-shopping-group="group.dishId ?? 'other'"
      >
        <h3 class="flex min-h-11 items-center gap-3 px-2 pt-1">
          <NuxtLink
            v-if="group.dish"
            :to="dishPath(address, group.dish)"
            class="flex min-w-0 items-center gap-3 rounded-[14px] focus-visible:outline-2 focus-visible:outline-focus"
            :aria-label="t.shopping.openDish(group.dish.title)"
          >
            <span class="block h-10 w-10 shrink-0 overflow-hidden rounded-[12px] bg-surface-muted">
              <DishImage
                :image-url="group.dish.imageUrl"
                :focus="group.dish.imageFocus"
                :placeholder="group.dish.placeholder"
                lazy
              />
            </span>
            <span class="truncate font-display text-[19px] font-medium leading-tight">{{ group.title }}</span>
          </NuxtLink>
          <span
            v-else
            class="truncate font-display text-[19px] font-medium leading-tight"
          >{{ group.dishId === null ? t.shopping.other : group.title }}</span>
        </h3>
        <TransitionGroup
          tag="ul"
          name="line"
          class="mt-1"
        >
          <li
            v-for="entry in group.items"
            :key="entry.id"
            class="line flex items-center gap-1 rounded-[14px]"
            :class="{ ticked: entry.ticked }"
            :data-shopping-item="entry.id"
            :data-ticked="entry.ticked || undefined"
          >
            <form
              v-if="editing === entry.id"
              class="flex min-h-14 flex-1 items-center gap-2 px-2"
              @submit.prevent="saveEdit(entry)"
            >
              <label class="min-w-0 flex-1">
                <span class="sr-only">{{ t.shopping.editLabel }}</span>
                <input
                  v-model="editText"
                  type="text"
                  enterkeyhint="done"
                  autocomplete="off"
                  :maxlength="SHOPPING_LIMITS.characters"
                  class="h-11 w-full rounded-pill bg-surface-muted px-4 text-body outline-none focus-visible:outline-2 focus-visible:outline-focus"
                  :data-shopping-edit="entry.id"
                  @keydown.esc.prevent="cancelEdit"
                >
              </label>
              <button
                type="submit"
                class="h-11 shrink-0 rounded-pill bg-inverse px-4 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {{ t.shopping.save }}
              </button>
              <button
                type="button"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
                :aria-label="t.shopping.cancel"
                @click="cancelEdit"
              >
                <AppIcon name="close" />
              </button>
            </form>
            <template v-else>
              <button
                type="button"
                role="checkbox"
                :aria-checked="entry.ticked"
                class="row flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-[14px] px-2 py-2 text-left transition-transform duration-tap ease-tap active:scale-[.98] focus-visible:outline-2 focus-visible:outline-focus"
                data-shopping-tick
                @click="tick(entry)"
              >
                <span
                  class="box flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
                  :class="entry.ticked ? 'border-transparent bg-inverse text-on-inverse' : 'border-text-muted'"
                  aria-hidden="true"
                >
                  <AppIcon
                    v-if="entry.ticked"
                    name="check"
                    :size="16"
                  />
                </span>
                <span class="min-w-0 flex-1">
                  <span
                    class="text block break-words text-body leading-snug"
                    :class="entry.ticked ? 'text-text-muted line-through' : ''"
                  >{{ entry.text }}</span>
                  <span
                    v-if="entry.unsent"
                    class="mt-0.5 flex items-center gap-1 text-[13px] text-text-muted"
                    data-unsent
                  >
                    <svg
                      viewBox="0 0 24 24"
                      width="14"
                      height="14"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2.2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                      class="shrink-0"
                    ><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z" /></svg>
                    {{ t.unsent.notSent }}
                  </span>
                </span>
              </button>
              <button
                type="button"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                :aria-label="t.shopping.edit(entry.text)"
                data-shopping-change
                @click="startEdit(entry)"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                ><path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" /></svg>
              </button>
              <button
                type="button"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                :aria-label="t.shopping.remove(entry.text)"
                data-shopping-remove
                @click="remove(entry)"
              >
                <AppIcon name="close" />
              </button>
            </template>
          </li>
        </TransitionGroup>
      </section>
    </TransitionGroup>
  </section>
</template>

<style scoped>
/* A tick: the line settles to the bottom of its group (move, settle 480ms);
   one coming or going fades. Reduced motion: no moving, a fade. */
.line-move,
.group-move {
  transition: translate var(--dur-settle) var(--ease-settle);
}
.line-enter-active,
.line-leave-active,
.group-enter-active,
.group-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.line-leave-active,
.group-leave-active {
  position: absolute;
  visibility: hidden;
}
.line-enter-from,
.group-enter-from {
  opacity: 0;
}
.box {
  transition: background-color var(--dur-fade) var(--ease-fade), border-color var(--dur-fade) var(--ease-fade);
}
.empty-list {
  animation: pop-in var(--dur-pop) var(--ease-pop) 200ms backwards;
}
@keyframes pop-in {
  from {
    opacity: 0;
    scale: .92;
  }
}
@media (prefers-reduced-motion: reduce) {
  .line-move,
  .group-move {
    transition: none;
  }
  .empty-list {
    animation: none;
  }
}
</style>
