<script setup lang="ts">
import type { BoardListing, BoardView } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'
import type { BoardResult } from '~/board/board-module'
import { dishOnBoard } from '~~/shared/board'

// The Dish detail (PRD stories 41–45), a child route of its Board: full-screen
// on phones, a side panel over the Board from 768px (440px; 480px from
// 1200px). A native modal <dialog>, like AppSheet: the browser traps focus,
// makes the Board inert and closes it on Escape. The Dish comes from the
// Board the parent page already has. Its actions (an edit, "Gekocht ✓",
// "Verschieben nach…", "Löschen", the Cooking History's) go through the
// client Board module the page provides, and each result goes up as
// `result`, for the page to show as it shows a card's. The Board is inert
// behind this dialog, so its Toast shows in here.
const props = defineProps<{ board: BoardView }>()
const emit = defineEmits<{ result: [result: BoardResult, context?: ResultContext] }>()
const toast = defineModel<Toast | null>('toast', { required: true })
const t = useStrings()
const boardModule = useBoardModule()
const route = useRoute()
const router = useRouter()

// The Dish shown, and its Column.
const located = computed(() => dishOnBoard(props.board, route.params.dishId))
if (!located.value) throw createError({ statusCode: 404, statusMessage: 'Dish not found', fatal: true })

useHead({ title: () => located.value ? `${located.value.dish.title} · ${t.app.name}` : t.app.name })

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const editing = ref(false)
// Opened from its card, the card morphs into it (utils/dish-morph.ts): it
// doesn't move in itself then.
const morphed = !!morphArrival()
// A sheet opened over it (moving the Dish, a Cooking's note, choosing an
// image), it steps back.
const covered = useModalStack(() => true)
const headerImage = () => dialog.value?.querySelector<HTMLElement>('[data-detail-image]') ?? null
onMounted(() => {
  dialog.value?.showModal()
  morphArrived(headerImage())
})

// Back to the Board: the way it came if it came from there, so the history
// doesn't grow; a deep link replaces itself with the Board. The image
// morphs back into the Dish's card, unless it is being edited, has scrolled
// away under the compact bar, or the Dish is no longer on the Board.
const boardPath = computed(() => `/b/${props.board.id}`)
let leaving = false
async function close() {
  if (leaving) return
  leaving = true
  const dishId = located.value?.dish.id
  finishFieldMorph(dialog.value)
  const scrolledAway = !!dialog.value?.querySelector('[data-detail-bar][data-shown]')
  const image = dishId && !editing.value && !scrolledAway ? headerImage() : null
  await morphClose(image, dishId ?? '', boardPath.value, leave)
}
// Resolves once the Board shows without the detail.
async function leave() {
  if (router.options.history.state.back === boardPath.value) {
    await new Promise<void>((resolve) => {
      const stop = router.afterEach(() => {
        stop()
        resolve()
      })
      router.back()
    })
  }
  else {
    await navigateTo(boardPath.value, { replace: true })
  }
  await nextTick()
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

// The Dish's actions, through the Board module.
function actOnDish(operation: (dishId: string) => BoardResult | null, context?: ResultContext) {
  const result = located.value && operation(located.value.dish.id)
  if (result) emit('result', result, context)
}

function onDelete() {
  actOnDish(boardModule.deleteDish)
  close()
}

// "Verschieben nach…": a sheet over the detail with the picker. Moved within
// the Board, the detail stays, showing the new Column; moved to another
// Board, the Dish is gone from this one, so the detail closes.
const moving = ref(false)
function onMove(columnId: string, toBoard: BoardListing | null) {
  moving.value = false
  actOnDish(dishId => moveToPicked(boardModule, dishId, columnId, toBoard), { moved: { toBoard } })
  if (toBoard) close()
}
watch(moving, async (isMoving) => {
  if (isMoving) return
  await nextTick()
  dialog.value?.querySelector<HTMLElement>('[data-move]')?.focus()
})

// Gone from the Board while shown, as another Member deleted it or moved
// it to another Board (PRD story 38): the detail closes and says so. Its
// own "Löschen" and moves close it first.
watch(located, (now, before) => {
  if (now || !before || leaving) return
  toast.value = { text: t.detail.goneMeanwhile(before.dish.title), duration: NOTICE_MS }
  close()
})

function onSaved(result: BoardResult) {
  emit('result', result)
  editing.value = false
}

// The Cooking note sheet, from the Cooking History, for a Cooking of the
// Dish shown then.
const noting = ref<{ dish: DishView, cooking: CookingView } | null>(null)
const notingCooking = computed({
  get: () => noting.value?.cooking ?? null,
  set: (cooking) => {
    if (!cooking) noting.value = null
  },
})

// Entering and leaving edit mode morphs one side's fields into the other's
// (utils/edit-morph.ts), measured before the swap. Once edit mode has
// opened, the card morph's arrival doesn't play again as the read-only Dish
// comes back. Leaving puts focus back on "Bearbeiten" (edit mode focuses its
// title itself), so it never falls to the page behind; first, as focusing
// may scroll the detail, which the morph must start from.
const editedOnce = ref(false)
watch(editing, async (isEditing) => {
  editedOnce.value = true
  const places = measureFields(dialog.value)
  await nextTick()
  if (!isEditing) dialog.value?.querySelector<HTMLElement>('[data-edit]')?.focus()
  morphFields(dialog.value, places)
})
</script>

<template>
  <div class="contents">
    <dialog
      ref="dialog"
      class="detail bg-bg p-0 text-text tablet:shadow-sheet"
      :class="{ morphed }"
      :data-covered="covered || undefined"
      :data-edited="editedOnce || undefined"
      :aria-label="located?.dish.title"
      @keydown.esc="onEscape"
      @cancel.prevent="close"
      @close="close"
      @click.self="onBackdrop"
    >
      <template v-if="located">
        <DishDetailEditor
          v-if="editing"
          :dish="located.dish"
          :board-id="board.id"
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
          @cook="origin => actOnDish(boardModule.cookDish, { origin })"
          @note="cooking => located && (noting = { dish: located.dish, cooking })"
          @delete-cooking="cooking => actOnDish(dishId => boardModule.deleteCooking(dishId, cooking.id))"
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
      <VeggieConfetti />
      <AppToast v-model="toast" />
    </dialog>
    <!-- The Cooking note sheet sits beside the detail, not in it: the
         detail's own fields (edit mode's "Notiz") stay the only ones there. -->
    <CookingNoteSheet
      v-model:cooking="notingCooking"
      :dish="noting?.dish ?? null"
    />
  </div>
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

/* Covered by a sheet over it: it scales to .96 and dims 20%. Reduced
   motion: it cross-fades in (200ms), and covered it only dims. */
.detail {
  transition: scale var(--dur-sheet) var(--ease-sheet);
}
.detail::after {
  content: '';
  position: fixed;
  inset: 0;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.detail[data-covered] {
  scale: .96;
}
.detail[data-covered]::after {
  opacity: .2;
}
@media (prefers-reduced-motion: reduce) {
  .detail[open] {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  @starting-style {
    .detail[open] {
      opacity: 0;
    }
  }
  .detail[data-covered] {
    scale: none;
  }
}

/* Arriving by the card → detail morph (handoff: phone and side panel): the
   image comes from the card; the background fades in under it, and the
   rest rises from +90px from 30% of the morph (420ms, settle). Back from
   edit mode, the edit mode morph moves it instead. */
.detail.morphed[open] {
  animation: detail-fill 180ms var(--ease-fade);
}
.detail.morphed[open]:not([data-edited]) :deep([data-detail-body]) {
  animation: detail-body-rise 420ms var(--ease-settle) 180ms backwards;
}
/* Its buttons (close, "Bearbeiten") pop in at 80% of the morph. */
.detail.morphed[open]:not([data-edited]) :deep([data-detail-actions] > *) {
  animation: actions-pop var(--dur-pop) var(--ease-pop) calc(var(--dur-swoosh) * .8) backwards;
}
@keyframes actions-pop {
  from { scale: .6; opacity: 0; }
}
@keyframes detail-fill {
  from { background-color: transparent; }
}
@keyframes detail-body-rise {
  from { translate: 0 90px; opacity: 0; }
}
/* The FLIP morph (no View Transitions) moves the image beyond the side
   panel, and back into the card fades the rest of the detail out. */
.detail[data-morphing] {
  overflow: visible;
}
.detail[data-morph-closing] {
  background-color: transparent;
  transition: background-color var(--dur-fade) var(--ease-fade);
}
.detail[data-morph-closing]::backdrop {
  opacity: 0;
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.detail[data-morph-closing] :deep([data-detail-body]),
.detail[data-morph-closing] :deep([data-detail-bar]),
.detail[data-morph-closing] :deep([data-detail-image] ~ *) {
  opacity: 0;
  transition: opacity var(--dur-fade) var(--ease-fade);
}
@keyframes detail-slide {
  from { transform: translateX(100%); }
}
</style>
