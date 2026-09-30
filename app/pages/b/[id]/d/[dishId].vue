<script setup lang="ts">
import type { BoardListing, BoardView } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { SavedDish } from '~~/server/utils/dishes'
import { dishOnBoard } from '~~/shared/board'

// The Dish detail (PRD stories 41–45), a child route of its Board: full-screen
// on phones, a side panel over the Board from 768px (440px; 480px from
// 1200px). A native modal <dialog>, like AppSheet: the browser traps focus,
// makes the Board inert and closes it on Escape. The Dish comes from the
// Board the parent page already has; edits go back to it via `edited`,
// "Löschen" asks it to `delete` the Dish (it offers the undo) and
// "Verschieben nach…" to `move` it, within the Board or to another. So do the
// Cooking History's actions: `cook`, `note` and `deleteCooking`. The Board
// is inert behind this dialog, so its Toast shows in here.
const props = defineProps<{ board: BoardView }>()
const emit = defineEmits<{
  edited: [dish: SavedDish]
  delete: [dishId: string]
  move: [dishId: string, columnId: string, toBoard: BoardListing | null]
  cook: [dishId: string]
  note: [dishId: string, cooking: CookingView]
  deleteCooking: [dishId: string, cooking: CookingView]
}>()
const toast = defineModel<Toast | null>('toast', { required: true })
const t = useStrings()
const route = useRoute()
const router = useRouter()

// The Dish shown, and its Column.
const located = computed(() => dishOnBoard(props.board, route.params.dishId))
if (!located.value) throw createError({ statusCode: 404, statusMessage: 'Dish not found', fatal: true })

useHead({ title: () => located.value ? `${located.value.dish.title} · ${t.app.name}` : t.app.name })

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const editing = ref(false)
onMounted(() => dialog.value?.showModal())

// Back to the Board: the way it came if it came from there, so the history
// doesn't grow; a deep link replaces itself with the Board.
const boardPath = computed(() => `/b/${props.board.id}`)
let leaving = false
async function close() {
  if (leaving) return
  leaving = true
  if (router.options.history.state.back === boardPath.value) router.back()
  else await navigateTo(boardPath.value, { replace: true })
}

// While editing, Escape leaves edit mode and tapping the dimmed Board does
// nothing, so edits are never lost by accident. Escape is caught on keydown:
// Chrome may skip the dialog's cancel event on a repeated Escape. One meant
// for the Placeholder picker's own sheet is left to it.
function onEscape(event: KeyboardEvent) {
  if (!editing.value || (event.target as Element).closest('dialog') !== dialog.value) return
  event.preventDefault()
  editing.value = false
}
function onBackdrop() {
  if (!editing.value) close()
}

function onDelete() {
  if (located.value) emit('delete', located.value.dish.id)
  close()
}

// "Verschieben nach…": a sheet over the detail with the picker. Moved within
// the Board, the detail stays, showing the new Column; moved to another
// Board, the Dish is gone from this one, so the detail closes.
const moving = ref(false)
function onMove(columnId: string, toBoard: BoardListing | null) {
  moving.value = false
  if (!located.value) return
  emit('move', located.value.dish.id, columnId, toBoard)
  if (toBoard) close()
}
watch(moving, async (isMoving) => {
  if (isMoving) return
  await nextTick()
  dialog.value?.querySelector<HTMLElement>('[data-move]')?.focus()
})

function onSaved(dish: SavedDish) {
  emit('edited', dish)
  editing.value = false
}

// Leaving edit mode puts focus back on "Bearbeiten" (edit mode focuses its
// title itself), so it never falls to the page behind.
watch(editing, async (isEditing) => {
  if (isEditing) return
  await nextTick()
  dialog.value?.querySelector<HTMLElement>('[data-edit]')?.focus()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="detail bg-bg p-0 text-text tablet:shadow-sheet"
    :aria-label="located?.dish.title"
    @keydown.esc="onEscape"
    @close="close"
    @click.self="onBackdrop"
  >
    <template v-if="located">
      <DishDetailEditor
        v-if="editing"
        :dish="located.dish"
        @saved="onSaved"
        @cancel="editing = false"
      />
      <DishDetailView
        v-else
        :dish="located.dish"
        :board="board"
        :column-name="located.column.name"
        @close="close"
        @edit="editing = true"
        @move="moving = true"
        @delete="onDelete"
        @cook="emit('cook', located.dish.id)"
        @note="cooking => located && emit('note', located.dish.id, cooking)"
        @delete-cooking="cooking => located && emit('deleteCooking', located.dish.id, cooking)"
      />
    </template>
    <AppSheet
      v-model:open="moving"
      :title="t.dish.moveTo"
      :close-label="t.dish.closeMenu"
    >
      <MoveTargetPicker
        v-if="moving && located"
        class="mt-5"
        :board="board"
        :from-column-id="located.column.id"
        @move="onMove"
      />
    </AppSheet>
    <AppToast v-model="toast" />
  </dialog>
</template>

<style scoped>
/* Phone: the whole screen. */
.detail {
  position: fixed;
  inset: 0;
  margin: 0;
  width: 100%;
  max-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  border: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.detail[open] {
  animation: detail-rise var(--dur-settle) var(--ease-settle);
}
.detail::backdrop {
  background: var(--color-scrim);
}
.detail[open]::backdrop {
  animation: scrim-in var(--dur-fade) var(--ease-fade);
}

/* Tablet and up: a side panel from the right edge, the Board dimmed behind. */
@media (min-width: 768px) {
  .detail {
    left: auto;
    width: 440px;
  }
  .detail[open] {
    animation: detail-slide var(--dur-sheet) var(--ease-sheet);
  }
}
@media (min-width: 1200px) {
  .detail {
    width: 480px;
  }
}

@keyframes detail-rise {
  from { transform: translateY(90px); opacity: 0; }
}
@keyframes detail-slide {
  from { transform: translateX(100%); }
}
</style>
