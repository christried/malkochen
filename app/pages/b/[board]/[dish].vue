<script setup lang="ts">
import type { BoardListing, BoardView } from '~~/server/utils/boards'
import { isRefused, type BoardResult } from '~/board/board-module'
import type { CommentResult } from '~/board/dish-histories'
import type { VoteResult } from '~/board/dish-votes'
import type { CopiedDish } from '~~/server/utils/copies'
import { boardPath as pathOfBoard, dishAt, dishPath, dishRef } from '~~/shared/address'
import { boardLabel } from '~~/shared/board'

// The Dish detail (PRD stories 41–45), a child route of its Board: full-screen
// on phones, a side panel over the Board from 768px (440px; 480px from
// 1200px). A native modal <dialog>, like AppSheet: the browser traps focus,
// makes the Board inert and closes it on Escape. The Dish comes from the
// Board the parent page already has. At /b/<Board>/<title>-<code> (its
// Address, CONTEXT.md); its old address, /b/<Board id>/d/<Dish id>, is an
// alias, which the Board page forwards from (useBoardAddress). Its actions (an edit, "Gekocht ✓",
// "Verschieben nach…", "Löschen", the Dish History's) go through the
// client Board module the page provides, and each result goes up as
// `result`, for the page to show as it shows a card's. The Board is inert
// behind this dialog, so its Toast and the Gekocht celebration show in
// here.
definePageMeta({ alias: '/b/:board/d/:dish' })

const props = defineProps<{ board: BoardView }>()
const emit = defineEmits<{ result: [result: BoardResult, context?: ResultContext] }>()
const toast = defineModel<Toast | null>('toast', { required: true })
const t = useStrings()
const boardModule = useBoardModule()
const route = useRoute()
const router = useRouter()

// The Dish shown, and its Column.
// A Dish added offline gets its own code once it has arrived (#462): the
// address it was opened at still finds it, and the address follows.
const located = computed(() => {
  const found = dishAt(props.board, route.params.dish)
  if (found) return found
  const segment = route.params.dish
  const ref = typeof segment === 'string' ? dishRef(segment) : null
  const arrived = ref && 'code' in ref ? boardModule.arrivedAs(ref.code) : null
  return arrived ? dishAt(props.board, arrived) : null
})
if (!located.value) throw createError({ statusCode: 404, statusMessage: 'Dish not found', fatal: true })
watch(() => located.value?.dish.code, () => {
  const dish = located.value?.dish
  if (dish && dishAt(props.board, route.params.dish) === null) void router.replace(dishPath(props.board, dish))
})

useHead({ title: () => located.value ? `${located.value.dish.title} · ${t.app.name}` : t.app.name })

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const editing = ref(false)
// The Recipe's own edit mode (#496): from 768px the panel's contents become
// the editor, on a phone it is a tall sheet over the detail. Which, is
// decided as it opens.
const editingRecipe = ref(false)
const recipeVariant = ref<'sheet' | 'panel'>('panel')
const recipeEditor = useTemplateRef<{ focusStart: () => void, requestCancel: () => void }>('recipeEditor')
// Opened from its card, the card morphs into it (utils/dish-morph.ts): it
// doesn't move in itself then.
const morphed = !!morphArrival()
// A sheet opened over it (moving the Dish, choosing an image), it steps
// back.
const covered = useModalStack(() => true)
const headerImage = () => dialog.value?.querySelector<HTMLElement>('[data-detail-image]') ?? null
onMounted(() => {
  dialog.value?.showModal()
  morphArrived(headerImage())
})
// "Kommentieren" for this Dish not taken up while it was open (in edit
// mode, say) is over once it closes, so it can't land by surprise the next
// time. One for another Dish, which it is giving way to, stays.
const commentRequest = useCommentRequest()
onBeforeUnmount(() => {
  if (commentRequest.value === located.value?.dish.id) commentRequest.value = null
})

// Back to the Board: the way it came if it came from there, so the history
// doesn't grow; a deep link replaces itself with the Board. The image
// morphs back into the Dish's card, unless it is being edited, has scrolled
// away under the compact bar, or the Dish is no longer on the Board.
const address = useOpenBoardAddress()
const boardPath = computed(() => pathOfBoard(address.value))
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
  if ((event.target as Element).closest('dialog') !== dialog.value) return
  if (editingRecipe.value && recipeVariant.value === 'panel') {
    event.preventDefault()
    recipeEditor.value?.requestCancel()
    return
  }
  if (!editing.value) return
  event.preventDefault()
  editing.value = false
}
// Back (the dialog's cancel) while the Recipe is edited asks about the
// changes instead of leaving the detail.
function onCancel() {
  if (editingRecipe.value && recipeVariant.value === 'panel') recipeEditor.value?.requestCancel()
  else void close()
}
// A click on the backdrop closes it, unless it is being edited, and only
// when the press started there too (#390).
const backdrop = useBackdropClose(dialog, close, () => !editing.value && !editingRecipe.value)

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

// "Einplanen" (#518): the day picker, from today on and reaching the weeks to
// come. A day picked plans the Dish at the end of it, with a toast offering
// "Rückgängig"; the detail itself shows nothing of the plan.
const today = useToday()
const planning = reactive({ open: false, anchor: null as HTMLElement | null })
const { showPlanResult } = usePlanResult(shown => (toast.value = shown))
function onPlan(anchor: HTMLElement) {
  Object.assign(planning, { open: true, anchor })
}
function planOn(day: string) {
  const dishId = located.value?.dish.id
  planning.open = false
  if (!dishId) return
  hapticConfirm()
  const result = boardModule.planDish(dishId, day)
  if (!result) return
  showPlanResult(result, {
    text: t.week.planned(day, today.value),
    undo: () => boardModule.unplanDish(result.plannedDish.id),
  })
}
watch(() => planning.open, async (isOpen) => {
  if (isOpen) return
  await nextTick()
  dialog.value?.querySelector<HTMLElement>('[data-plan-dish]')?.focus()
})

// "Auf die Einkaufsliste" (#537): the Dish's Ingredients, all ticked, in a
// sheet (a popover on desktop). The lines left ticked go on the Shopping
// List, with a toast saying how many.
const puttingOn = reactive({ open: false, anchor: null as HTMLElement | null })
const { showShoppingResult } = useShoppingResult(shown => (toast.value = shown))
const ingredients = computed(() => located.value ? boardModule.ingredientsToPutOn(located.value.dish.id) : [])
function onPutOn(anchor: HTMLElement) {
  Object.assign(puttingOn, { open: true, anchor })
}
function putOn(lines: { line: number, text: string }[]) {
  const dish = located.value?.dish
  puttingOn.open = false
  if (!dish) return
  const result = boardModule.putDishOn(dish.id, lines)
  if (!result) return
  hapticConfirm()
  showShoppingResult(result, { text: t.shopping.putOnDone(result.count) }, dish.title)
}
watch(() => puttingOn.open, async (isOpen) => {
  if (isOpen) return
  await nextTick()
  dialog.value?.querySelector<HTMLElement>('[data-put-on-list]')?.focus()
})

// "Kopieren" (#402): a sheet over the detail with the Boards to copy the Dish
// to. The Copy is made there; this Board doesn't change. The toast offers
// "Öffnen", which goes to the Copy on that Board.
const copying = ref(false)
async function onCopy(toBoard: BoardListing) {
  copying.value = false
  const dishId = located.value?.dish.id
  if (!dishId) return
  const label = boardLabel(toBoard)
  try {
    const { dish, board: target, imageCopied } = await $fetch<CopiedDish>(`/api/dishes/${dishId}/copy`, { method: 'POST', body: { boardId: toBoard.id } })
    const copyPath = dishPath(target, dish)
    toast.value = {
      text: imageCopied ? t.detail.copied(label) : t.detail.copiedWithoutImage(label),
      duration: NOTICE_MS,
      actions: [{ label: t.detail.openCopy, run: () => void navigateTo(copyPath), navigates: true }],
    }
  }
  catch (error) {
    toast.value = { text: isRefused(error) ? t.detail.copyForbidden : t.detail.copyFailed, duration: NOTICE_MS }
  }
}
watch(copying, async (isCopying) => {
  if (isCopying) return
  await nextTick()
  dialog.value?.querySelector<HTMLElement>('[data-copy-dish]')?.focus()
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

// Editing the Recipe (#496). Opened from "Bearbeiten" or "Rezept hinzufügen":
// where it was scrolled to is remembered for the way back. Saving goes
// through the Board module; a Recipe saved while malkochen doesn't answer is
// kept as an Unsent Change and closes the editor all the same (the section
// then says "Noch nicht gesendet"). A save that fails keeps the editor open
// and says why.
const recipeSaving = ref(false)
const recipeFailed = ref<'notAllowed' | 'failed' | null>(null)
// A sheet keeps its contents while it moves out; each opening is a new
// editor, with a draft of its own.
const recipeSheetKept = ref(false)
const recipeEditorKey = ref(0)
let scrolledTo = 0
let keepTimer: ReturnType<typeof setTimeout> | undefined
function editRecipe() {
  clearTimeout(keepTimer)
  recipeVariant.value = isPhoneLayout() ? 'sheet' : 'panel'
  scrolledTo = dialog.value?.scrollTop ?? 0
  recipeFailed.value = null
  recipeEditorKey.value++
  recipeSheetKept.value = true
  editingRecipe.value = true
}
// The sheet's own closing (the handle, the scrim, Escape, Back) is a request
// to leave, which the editor answers.
const recipeSheetOpen = computed({
  get: () => editingRecipe.value && recipeVariant.value === 'sheet',
  set: (open) => {
    if (!open) recipeEditor.value?.requestCancel()
  },
})
async function saveRecipe(recipe: { ingredients: string[], steps: string[] } | null) {
  const dishId = located.value?.dish.id
  if (!dishId || recipeSaving.value) return
  recipeSaving.value = true
  recipeFailed.value = null
  try {
    emit('result', await boardModule.editDish(dishId, { recipe }))
    editingRecipe.value = false
  }
  catch (error) {
    recipeFailed.value = isRefused(error) ? 'notAllowed' : 'failed'
  }
  finally {
    recipeSaving.value = false
  }
}
// The editor opens with its first line focused (the sheet only once it is
// open). Closed, the detail is where it was and focus goes back to the
// button that opened it, which saving may have replaced.
const cameBackFromRecipe = ref(false)
watch(editingRecipe, async (isEditing) => {
  await nextTick()
  if (isEditing) {
    recipeEditor.value?.focusStart()
    return
  }
  keepTimer = setTimeout(() => (recipeSheetKept.value = false), 600)
  const el = dialog.value
  if (recipeVariant.value === 'panel') {
    // The detail comes back fading in, at the scroll it was left at.
    cameBackFromRecipe.value = true
    setTimeout(() => (cameBackFromRecipe.value = false), 600)
    el?.scrollTo({ top: scrolledTo })
  }
  el?.querySelector<HTMLElement>('[data-edit-recipe]')?.focus({ preventScroll: true })
})
onBeforeUnmount(() => clearTimeout(keepTimer))

// A Recipe the Recipe Finder found while the Recipe was out of sight (#504):
// nothing was seen arrive, so the Toast says so and "Zeigen" scrolls to it
// (smooth; reduced motion jumps). It only scrolls, so it works offline too.
function showFoundRecipe() {
  toast.value = {
    text: t.recipe.finder.found,
    duration: NOTICE_MS,
    actions: [{
      label: t.recipe.finder.show,
      navigates: true,
      run: () => {
        const el = dialog.value
        const section = el?.querySelector<HTMLElement>('[data-recipe-section]')
        if (!el || !section) return
        // Clear of the compact bar at the top.
        const top = section.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 80
        el.scrollTo({ top, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      },
    }],
  }
}

// What a Comment write answered (from the Dish History): haptics for one
// deleted, and its notice in the Toast, offering "Rückgängig" if it comes
// with an undo (whose result shows the same way); then what the write ended
// in, once settled.
function showComment({ notice, undo, settled }: CommentResult) {
  if (notice === 'commentDeleted') hapticReject()
  if (notice) {
    const text = t.history[notice]
    toast.value = undo
      ? { text, duration: UNDO_WINDOW_MS, actions: [{ label: t.dish.undo, run: () => void undo().then(showComment), offline: true }] }
      : { text, duration: NOTICE_MS }
  }
  void settled?.then(showComment)
}

// What a Vote answered (from "Wie war's?" in the Dish History): once
// settled, a notice in the Toast if it couldn't be saved. Picking again is
// its own undo, so none is offered.
function showVote({ notice, settled }: VoteResult) {
  if (notice) toast.value = { text: t.history[notice], duration: NOTICE_MS }
  void settled?.then(showVote)
}

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
  // Back to the top before the read-only Dish mounts: scrolled down in the
  // editor, it would count the image as scrolled away and show its compact
  // bar (a second "Schließen") until focusing "Bearbeiten" scrolled back.
  if (!isEditing && dialog.value) dialog.value.scrollTop = 0
  await nextTick()
  if (!isEditing) dialog.value?.querySelector<HTMLElement>('[data-edit]')?.focus()
  morphFields(dialog.value, places)
})
</script>

<template>
  <div class="contents">
    <dialog
      ref="dialog"
      class="detail overflow-y-auto bg-bg p-0 text-text tablet:shadow-sheet"
      :class="{ morphed }"
      :data-covered="covered || undefined"
      :data-edited="editedOnce || undefined"
      :aria-label="located?.dish.title"
      @keydown.esc="onEscape"
      @cancel.prevent="onCancel"
      @pointerdown="backdrop.onPointerdown"
      @input="backdrop.onInput"
      @close="close(); backdrop.onClosed()"
      @click.self="backdrop.onBackdropClick"
    >
      <template v-if="located">
        <DishDetailEditor
          v-if="editing"
          :dish="located.dish"
          :board-id="board.id"
          @saved="onSaved"
          @cancel="editing = false"
        />
        <RecipeEditor
          v-else-if="editingRecipe && recipeVariant === 'panel'"
          ref="recipeEditor"
          :key="recipeEditorKey"
          class="recipe-in"
          :dish="located.dish"
          variant="panel"
          :saving="recipeSaving"
          :failed="recipeFailed"
          @save="saveRecipe"
          @cancel="editingRecipe = false"
        />
        <DishDetailView
          v-else
          :class="{ 'recipe-in': cameBackFromRecipe }"
          :dish="located.dish"
          :board="board"
          :column-name="located.column.name"
          @close="close"
          @edit="editing = true"
          @edit-recipe="editRecipe"
          @move="moving = true"
          @delete="onDelete"
          @cook="origin => actOnDish(boardModule.cookDish, { origin })"
          @plan="onPlan"
          @put-on="onPutOn"
          @delete-cooking="cooking => actOnDish(dishId => boardModule.deleteCooking(dishId, cooking.id))"
          @comment="showComment"
          @vote="showVote"
          @notice="text => toast = { text, duration: NOTICE_MS }"
          @recipe-found="showFoundRecipe"
          @copy="copying = true"
        />
      </template>
      <!-- The Recipe editor on a phone: a tall sheet over the detail. -->
      <AppSheet
        v-model:open="recipeSheetOpen"
        tall
        :title="t.recipe.heading"
        :close-label="t.recipe.cancel"
      >
        <RecipeEditor
          v-if="recipeSheetKept && recipeVariant === 'sheet' && located"
          ref="recipeEditor"
          :key="recipeEditorKey"
          :dish="located.dish"
          variant="sheet"
          :saving="recipeSaving"
          :failed="recipeFailed"
          @save="saveRecipe"
          @cancel="editingRecipe = false"
        />
      </AppSheet>
      <AppSheet
        v-model:open="moving"
        :title="t.dish.moveTo"
        :close-label="t.dish.closeMenu"
      >
        <NeedsNet>
          <MoveTargetPicker
            v-if="moving && located"
            class="mt-5"
            :board="board"
            :from-column-id="located.column.id"
            :this-board-only="boardModule.isUnsentAdd(located.dish.id)"
            @move="onMove"
          />
        </NeedsNet>
      </AppSheet>
      <PickerSurface
        v-model:open="planning.open"
        :title="t.week.pickDay"
        :close-label="t.dish.closeMenu"
        :anchor="planning.anchor"
        :width="370"
      >
        <DayPicker
          v-if="located"
          :open="planning.open"
          :subtitle="located.dish.title"
          :today="today"
          :from="today"
          :dishes-on="boardModule.dishesOn"
          @pick="planOn"
        />
      </PickerSurface>
      <PickerSurface
        v-model:open="puttingOn.open"
        :title="t.shopping.pickTitle"
        :close-label="t.dish.closeMenu"
        :anchor="puttingOn.anchor"
        :width="370"
      >
        <IngredientPicker
          v-if="located"
          :open="puttingOn.open"
          :subtitle="located.dish.title"
          :ingredients="ingredients"
          @pick="putOn"
        />
      </PickerSurface>
      <AppSheet
        v-model:open="copying"
        :title="t.detail.copyTo"
        :close-label="t.dish.closeMenu"
      >
        <NeedsNet>
          <CopyTargetPicker
            v-if="copying"
            class="mt-5"
            :board-id="board.id"
            @copy="onCopy"
          />
        </NeedsNet>
      </AppSheet>
      <VeggieConfetti />
      <GekochtPill />
      <AppToast v-model="toast" />
      <SnackbertQuestion />
    </dialog>
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
  overscroll-behavior: contain;
  /* Clear of the offline bar (OfflineBar), lifted over it. */
  padding-bottom: var(--offline-bar, 0px);
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
/* The Recipe editor taking the panel's place, and the detail coming back
   (handoff RecipeEditor: content crossfade, fade 240 and a rise of 14px,
   settle). Reduced motion: it only fades. */
.recipe-in {
  animation: recipe-in var(--dur-settle) var(--ease-settle);
}
@keyframes recipe-in {
  from { opacity: 0; translate: 0 14px; }
}
@media (prefers-reduced-motion: reduce) {
  .recipe-in {
    animation-name: recipe-fade;
    animation-duration: var(--dur-fade);
  }
}
@keyframes recipe-fade {
  from { opacity: 0; }
}
@keyframes detail-slide {
  from { transform: translateX(100%); }
}
</style>
