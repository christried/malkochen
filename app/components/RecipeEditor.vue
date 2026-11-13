<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue'
import type { DishView } from '~~/server/utils/dishes'
import { RECIPE_LIMITS } from '~~/shared/recipe'
import { keyboardInset } from '~/utils/keyboard'
import { motionMs, prefersReducedMotion, wait } from '~/utils/motion'
import { backspaceOnEmpty, countShown, enterAt, limitsOf, moveLine, pasteInto, recipeToSave, type Caret, type RecipeKind } from '~/utils/recipe-lines'
import { UNDO_WINDOW_MS, type Toast } from '~/utils/toast'

// Editing a Dish's Recipe (handoff RecipeEditor; CONTEXT.md: Recipe,
// Ingredient, Step), its own mode: "Abbrechen", "Rezept" and "Speichern" on
// top, and both lists under them, a line to each Ingredient or Step. Each
// line has a grip to move it by, a field, and a button to remove it (RecipeLine);
// "Zutat hinzufügen" and "Schritt hinzufügen" add a line, until the list is
// full. Enter ends a line and starts a new one below, Backspace on an empty
// line removes it, and pasting several lines makes one line each (the
// rules are in utils/recipe-lines). A removed line, or lines pasted, can be
// taken back from the Toast. A line is dragged by its grip (a long press on
// a touch screen) and moved by keyboard from the grip's menu or with Alt+↑/↓;
// it stays in its own list.
//
// The draft is taken once, when the editor opens: what another Member
// changes meanwhile doesn't touch it, and Speichern replaces the Recipe as a
// whole (the last one wins). `variant`: in a sheet on phones, or as the
// contents of the Dish detail's side panel from 768px. Leaving with changes
// asks first (`requestCancel`: Abbrechen, Escape, a swipe down, Back).
// Its Toasts (a line removed, lines pasted) are its own. The page does the
// saving: `save` carries the Recipe as to be stored (null for none), `saving`
// and `failed` say how that is going.
const props = defineProps<{
  dish: DishView
  variant: 'sheet' | 'panel'
  saving: boolean
  failed: 'notAllowed' | 'failed' | null
}>()
const emit = defineEmits<{
  save: [recipe: { ingredients: string[], steps: string[] } | null]
  cancel: []
}>()
const t = useStrings()

const KINDS = ['ingredients', 'steps'] as const
interface DraftLine { id: number, text: string }
let nextId = 0
// A list with nothing in it starts with one empty line to type in.
const draftOf = (texts: readonly string[]): DraftLine[] => (texts.length ? texts : ['']).map(text => ({ id: nextId++, text }))
const opened = { ingredients: [...props.dish.recipe?.ingredients ?? []], steps: [...props.dish.recipe?.steps ?? []] }
const draft = reactive<Record<RecipeKind, DraftLine[]>>({ ingredients: draftOf(opened.ingredients), steps: draftOf(opened.steps) })
const texts = (kind: RecipeKind) => draft[kind].map(line => line.text)
const toSave = () => recipeToSave({ ingredients: texts('ingredients'), steps: texts('steps') })
// Whether the draft differs from what it opened with: the Recipe it would
// save, so a blank line added and removed again is no change.
const openedRecipe = JSON.stringify(recipeToSave(opened))
const dirty = computed(() => JSON.stringify(toSave()) !== openedRecipe)

const names = computed(() => ({
  ingredients: { heading: t.recipe.ingredients, field: t.recipe.ingredientField, placeholder: t.recipe.ingredientPlaceholder, add: t.recipe.addIngredient, full: t.recipe.ingredientsFull, removed: t.recipe.ingredientRemoved, pasted: t.recipe.ingredientsPasted },
  steps: { heading: t.recipe.steps, field: t.recipe.stepField, placeholder: t.recipe.stepPlaceholder, add: t.recipe.addStep, full: t.recipe.stepsFull, removed: t.recipe.stepRemoved, pasted: t.recipe.stepsPasted },
}))
// How many lines a list has with something in them, for its heading.
const filled = (kind: RecipeKind) => draft[kind].filter(line => line.text.trim() !== '').length
const full = (kind: RecipeKind) => draft[kind].length >= RECIPE_LIMITS[kind].lines

// Where each line's component is, to put the cursor in it.
const lineRefs = new Map<number, { focus: (at?: number) => void, focusGrip: () => void }>()
function setLineRef(id: number, el: Element | ComponentPublicInstance | null) {
  if (el) lineRefs.set(id, el as unknown as { focus: (at?: number) => void, focusGrip: () => void })
  else lineRefs.delete(id)
}
async function focusLine(kind: RecipeKind, index: number, caret?: number) {
  await nextTick()
  const line = draft[kind][index]
  if (line) lineRefs.get(line.id)?.focus(caret)
}
const body = useTemplateRef<HTMLElement>('body')
const addButtons = useTemplateRef<HTMLButtonElement[]>('addButtons')

// "Rezept hinzufügen" opens it with the first Ingredient line focused; the
// page asks once the editor is on screen (a sheet may not be yet).
defineExpose({
  focusStart() {
    if (openedRecipe === 'null') void focusLine('ingredients', 0)
  },
  requestCancel,
})

// Lines shown as new: pasted ones are tinted for 1.6s and arrive one after
// another (30ms apart, at most 8, the rest together).
const pasted = reactive(new Set<number>())
const enterDelays = reactive(new Map<number, number>())
function markPasted(ids: number[]) {
  ids.forEach((id, i) => {
    pasted.add(id)
    enterDelays.set(id, Math.min(i, 8) * 30)
  })
  window.setTimeout(() => {
    for (const id of ids) {
      pasted.delete(id)
      enterDelays.delete(id)
    }
  }, 1600)
}

// Its own Toast: the editor's sheet is opened over the one of the page, which
// the sheet would hide.
const toast = ref<Toast | null>(null)
function showToast(shown: Toast) {
  toast.value = shown
}

// Adds a line at the end of a list, and goes to it.
function addLine(kind: RecipeKind) {
  if (full(kind)) return
  draft[kind].push({ id: nextId++, text: '' })
  void focusLine(kind, draft[kind].length - 1)
}

// Enter: the line ends at the cursor and a new one starts below. On an empty
// last line it ends the typing instead, closing the keyboard.
function onEnter(kind: RecipeKind, index: number, caret: Caret) {
  const lines = draft[kind]
  if (lines[index]?.text === '' && index === lines.length - 1) {
    ;(document.activeElement as HTMLElement | null)?.blur()
    return
  }
  const result = enterAt(texts(kind), index, caret, limitsOf(kind))
  if (!result) return
  lines[index]!.text = result.lines[index]!
  lines.splice(index + 1, 0, { id: nextId++, text: result.lines[index + 1]! })
  void focusLine(kind, result.focus.index, result.focus.caret)
}

function onBackspace(kind: RecipeKind, index: number) {
  const result = backspaceOnEmpty(texts(kind), index)
  if (!result) return
  draft[kind].splice(index, 1)
  void focusLine(kind, result.focus.index, result.focus.caret)
}

// Pasting text with line breaks makes a line of each of its lines. A paste
// of one line goes in as it is, natively.
function onPaste(kind: RecipeKind, index: number, event: ClipboardEvent, caret: Caret) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/[\r\n]/.test(text)) return
  event.preventDefault()
  const lines = draft[kind]
  const originalText = lines[index]!.text
  const lineId = lines[index]!.id
  const result = pasteInto(texts(kind), index, caret, text, limitsOf(kind))
  if (result.inserted === 0) return
  const added = result.lines.length - lines.length
  lines[index]!.text = result.lines[index]!
  const fresh = result.lines.slice(index + 1, index + 1 + added).map(line => ({ id: nextId++, text: line }))
  markPasted(fresh.map(line => line.id))
  lines.splice(index + 1, 0, ...fresh)
  void focusLine(kind, result.focus.index, result.focus.caret)
  if (result.inserted < 2 && result.didNotFit === 0) return
  const { pasted: pastedText } = names.value[kind]
  // 120ms after the lines, so the toast doesn't arrive with them.
  window.setTimeout(() => showToast({
    text: result.didNotFit > 0 ? t.recipe.didNotFit(result.didNotFit) : pastedText(result.inserted),
    duration: UNDO_WINDOW_MS,
    actions: [{ label: t.dish.undo, run: () => undoPaste(kind, lineId, originalText, fresh.map(line => line.id)), offline: true }],
  }), 120)
}

// Takes back a paste: its new lines go, and the line it went into has its text again.
function undoPaste(kind: RecipeKind, lineId: number, text: string, freshIds: number[]) {
  const lines = draft[kind]
  const line = lines.find(l => l.id === lineId)
  if (!line) return
  line.text = text
  draft[kind] = lines.filter(l => !freshIds.includes(l.id))
}

// The remove button: the line leaves, and "Rückgängig" brings it back. An
// empty line needs no undo.
function removeLine(kind: RecipeKind, index: number) {
  const [line] = draft[kind].splice(index, 1)
  if (!line) return
  const button = addButtons.value?.find(el => el.dataset.recipeAdd === kind)
  button?.focus()
  if (line.text.trim() === '') return
  showToast({
    text: names.value[kind].removed,
    duration: UNDO_WINDOW_MS,
    actions: [{ label: t.dish.undo, run: () => draft[kind].splice(Math.min(index, draft[kind].length), 0, line), offline: true }],
  })
}

// The line moved up or down by the keyboard or a screen reader: it settles
// into its slot, focus stays where it was (a moved element loses it), and a
// polite message says where it is now.
const menu = ref<{ kind: RecipeKind, id: number } | null>(null)
const announcement = ref('')
async function moveBy(kind: RecipeKind, index: number, delta: -1 | 1) {
  const to = index + delta
  const lines = draft[kind]
  if (to < 0 || to >= lines.length) return
  const line = lines[index]!
  const active = document.activeElement as HTMLElement | null
  const fromMenu = menu.value?.id === line.id
  menu.value = null
  draft[kind] = moveLine(lines, index, to)
  announcement.value = ''
  await nextTick()
  if (fromMenu) lineRefs.get(line.id)?.focusGrip()
  else if (active && document.activeElement !== active) active.focus({ preventScroll: true })
  hapticTick()
  announcement.value = t.recipe.moved(lineName(kind, line, to), to + 1, lines.length)
}
const lineName = (kind: RecipeKind, line: DraftLine, index: number) => line.text.trim() || names.value[kind].field(index + 1)

// The on-screen keyboard covers the bottom of the sheet without resizing it
// (the page keeps its height, the visual viewport shrinks): the lines get
// room to be scrolled up above it.
const keyboard = ref(0)
function measureKeyboard() {
  const viewport = window.visualViewport
  keyboard.value = keyboardInset(window.innerHeight, viewport?.height ?? window.innerHeight, viewport?.offsetTop ?? 0)
}
onMounted(() => window.visualViewport?.addEventListener('resize', measureKeyboard))
onBeforeUnmount(() => window.visualViewport?.removeEventListener('resize', measureKeyboard))

// The grip's menu closes on a press anywhere else.
function closeMenuOutside(event: PointerEvent) {
  if (!menu.value) return
  if (event.target instanceof Element && event.target.closest('[data-recipe-menu], [data-recipe-grip]')) return
  menu.value = null
}
onMounted(() => document.addEventListener('pointerdown', closeMenuOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeMenuOutside))

// Dragging by the grip (pointer only; the menu and Alt+↑/↓ do the same by
// keyboard). A mouse starts it after 4px, a finger after a long press of
// 300ms (a finger that moves before is scrolling, and nothing happens). The
// line follows the pointer on the vertical, the lines it passes make room by
// springing into the next slot, and the order changes on letting go, when it
// has settled into its slot. Near the edge of the editor (48px) it scrolls.
// The drag listens on the window, not on the grip, so a release away from it
// is still seen.
interface Drag {
  kind: RecipeKind
  id: number
  from: number
  to: number
  // How far the line has been dragged from where it was.
  dy: number
  pointerId: number
  // Where each line of the list is, and how tall, from its top.
  tops: number[]
  heights: number[]
  startY: number
  startScroll: number
  dropping: boolean
}
const drag = ref<Drag | null>(null)
let pending: { kind: RecipeKind, id: number, pointerId: number, x: number, y: number, touch: boolean, timer?: number } | null = null
let pointerY = 0
let scrolling = 0
// A click right after a drag is not a tap on the grip.
let draggedJustNow = false

const onWindow = [['pointermove', follow], ['pointerup', release], ['pointercancel', release], ['blur', release]] as const
function listen() {
  for (const [type, listener] of onWindow) window.addEventListener(type, listener as EventListener)
}
function stopListening() {
  for (const [type, listener] of onWindow) window.removeEventListener(type, listener as EventListener)
}
function stopPending() {
  if (pending?.timer) clearTimeout(pending.timer)
  pending = null
}
onBeforeUnmount(() => {
  stopListening()
  stopPending()
  cancelAnimationFrame(scrolling)
})

function onGripDown(kind: RecipeKind, line: DraftLine, event: PointerEvent) {
  if (event.button !== 0 || drag.value) return
  stopPending()
  const touch = event.pointerType === 'touch'
  pending = { kind, id: line.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, touch }
  pointerY = event.clientY
  if (touch) pending.timer = window.setTimeout(lift, 300)
  listen()
}

function listEl(kind: RecipeKind): HTMLElement | null {
  return body.value?.querySelector<HTMLElement>(`[data-recipe-list="${kind}"]`) ?? null
}

function lift() {
  const start = pending
  stopPending()
  const list = listEl(start?.kind ?? 'ingredients')
  if (!start || !list) return
  const items = [...list.children] as HTMLElement[]
  const from = draft[start.kind].findIndex(line => line.id === start.id)
  if (from === -1 || items.length !== draft[start.kind].length) return
  menu.value = null
  drag.value = {
    kind: start.kind,
    id: start.id,
    from,
    to: from,
    dy: 0,
    pointerId: start.pointerId,
    tops: items.map(item => item.offsetTop),
    heights: items.map(item => item.offsetHeight),
    startY: start.y,
    startScroll: body.value?.scrollTop ?? 0,
    dropping: false,
  }
  draggedJustNow = true
  hapticLongPress()
  scrolling = requestAnimationFrame(autoscroll)
}

function follow(event: PointerEvent) {
  pointerY = event.clientY
  if (pending && event.pointerId === pending.pointerId) {
    // The button is already up: let go where no pointerup reached the page.
    if (event.buttons === 0 && !pending.touch) return release(event)
    const moved = Math.hypot(event.clientX - pending.x, event.clientY - pending.y)
    if (pending.touch) {
      if (moved > 10) {
        stopPending()
        stopListening()
      }
    }
    else if (moved >= 4) {
      lift()
    }
    return
  }
  if (drag.value && event.pointerId === drag.value.pointerId) {
    if (event.buttons === 0 && event.pointerType === 'mouse') return release(event)
    event.preventDefault()
    place()
  }
}

// Where the dragged line is now, and which slot it is over: the one whose
// neighbour's middle it has passed.
function place() {
  const d = drag.value
  if (!d || d.dropping) return
  const scrolled = (body.value?.scrollTop ?? 0) - d.startScroll
  d.dy = pointerY - d.startY + scrolled
  const centre = d.tops[d.from]! + d.heights[d.from]! / 2 + d.dy
  let to = d.from
  d.tops.forEach((top, i) => {
    const middle = top + d.heights[i]! / 2
    if (i > d.from && centre > middle) to = Math.max(to, i)
    if (i < d.from && centre < middle) to = Math.min(to, i)
  })
  if (to !== d.to) {
    d.to = to
    hapticTick()
  }
}

// Up to 12px per frame while the line is within 48px of the editor's edge.
function autoscroll() {
  const d = drag.value
  const el = body.value
  if (!d || d.dropping || !el) return
  const rect = el.getBoundingClientRect()
  if (pointerY < rect.top + 48) el.scrollTop -= 12
  else if (pointerY > rect.bottom - 48) el.scrollTop += 12
  place()
  scrolling = requestAnimationFrame(autoscroll)
}

// Letting go: the line settles into its slot (260ms), then the order changes.
// Dropped in place, or no drag begun, nothing changes.
async function release(event?: Event) {
  if (event instanceof PointerEvent) {
    const id = drag.value?.pointerId ?? pending?.pointerId
    if (event.pointerId !== id) return
  }
  stopListening()
  stopPending()
  cancelAnimationFrame(scrolling)
  const d = drag.value
  setTimeout(() => (draggedJustNow = false))
  if (!d || d.dropping) return
  d.dropping = true
  await wait(prefersReducedMotion() ? 0 : motionMs('drop-settle'))
  if (drag.value !== d) return
  if (d.to !== d.from) {
    const line = draft[d.kind][d.from]!
    draft[d.kind] = moveLine(draft[d.kind], d.from, d.to)
    hapticTick()
    announcement.value = t.recipe.moved(lineName(d.kind, line, d.to), d.to + 1, draft[d.kind].length)
  }
  drag.value = null
}

// How far a line is moved while one is dragged: the lines it passes make
// room by their height, the dragged one's slot (dashed) is where it would land.
function shifted(kind: RecipeKind, index: number): { translate: string, '--row-dy'?: string } | undefined {
  const d = drag.value
  if (!d || d.kind !== kind) return undefined
  const { from, to, heights } = d
  if (index === from) {
    const slot = to > from ? heights.slice(from + 1, to + 1).reduce((a, b) => a + b, 0) : -heights.slice(to, from).reduce((a, b) => a + b, 0)
    return { 'translate': `0 ${slot}px`, '--row-dy': `${d.dropping ? 0 : d.dy - slot}px` }
  }
  if (to > from && index > from && index <= to) return { translate: `0 ${-heights[from]!}px` }
  if (to < from && index >= to && index < from) return { translate: `0 ${heights[from]!}px` }
  return { translate: '0 0' }
}
// A Step's number while a line is dragged: the one it would have.
function stepNumberShown(kind: RecipeKind, index: number): number {
  const d = drag.value
  if (!d || d.kind !== kind) return index
  if (index === d.from) return d.to
  if (d.to > d.from && index > d.from && index <= d.to) return index - 1
  if (d.to < d.from && index >= d.to && index < d.from) return index + 1
  return index
}

function onGripClick(kind: RecipeKind, line: DraftLine) {
  if (draggedJustNow) return
  menu.value = menu.value?.id === line.id ? null : { kind, id: line.id }
}

// Leaving: changes made are asked about first.
const asking = ref(false)
function requestCancel() {
  if (props.saving) return
  if (dirty.value) asking.value = true
  else emit('cancel')
}
function discard() {
  asking.value = false
  emit('cancel')
}

// Speichern: nothing changed, nothing to send (and another Member's change
// meanwhile isn't overwritten for nothing).
function save() {
  if (props.saving) return
  if (!dirty.value) return emit('cancel')
  emit('save', toSave())
}

// A list's heading counts its lines with something in them; near the limit
// it counts all its lines against it.
const headingCount = (kind: RecipeKind) => countShown('list', kind, draft[kind].length) ? t.recipe.count(draft[kind].length, RECIPE_LIMITS[kind].lines) : String(filled(kind))
</script>

<template>
  <div
    class="flex h-full min-h-0 flex-col bg-bg"
    data-recipe-editor
    :data-variant="variant"
  >
    <div
      class="flex shrink-0 items-center gap-2.5"
      :class="variant === 'sheet' ? 'px-3.5 pb-3 pt-2' : 'px-5 pb-3.5 pt-4'"
    >
      <button
        type="button"
        class="grid h-10 shrink-0 place-items-center rounded-pill bg-surface-muted px-[15px] text-[14.5px] font-semibold leading-none text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        data-recipe-cancel
        @click="requestCancel"
      >
        {{ t.recipe.cancel }}
      </button>
      <h2 class="flex-1 text-center font-display text-[20px] font-medium leading-none">
        {{ t.recipe.heading }}
      </h2>
      <button
        type="button"
        class="grid h-10 shrink-0 place-items-center rounded-pill bg-inverse px-[17px] text-[14.5px] font-semibold leading-none text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
        :disabled="saving"
        data-recipe-save
        @click="save"
      >
        {{ t.recipe.save }}
      </button>
    </div>
    <p
      v-if="failed"
      role="alert"
      class="shrink-0 px-5 pb-2 text-small text-danger"
    >
      {{ failed === 'notAllowed' ? t.detail.notAllowed : t.detail.failed }}
    </p>

    <div
      ref="body"
      class="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pt-1.5"
      :class="variant === 'sheet' ? 'px-3' : 'px-5'"
      :style="{ paddingBottom: `calc(1.75rem + ${keyboard}px)` }"
      data-recipe-editor-body
    >
      <section
        v-for="kind in KINDS"
        :key="kind"
        class="flex flex-col gap-2.5 pb-2.5"
        :aria-label="names[kind].heading"
        :data-recipe-editor-list="kind"
      >
        <div class="flex items-baseline gap-2 px-1 pt-1.5">
          <h3 class="font-display text-[21px] font-medium leading-[1.15]">
            {{ names[kind].heading }}
          </h3>
          <span
            class="text-label text-text-muted"
            data-recipe-list-count
          >{{ headingCount(kind) }}</span>
        </div>
        <div
          v-if="draft[kind].length"
          class="rounded-[24px_21px_25px_22px] bg-surface py-1.5 shadow-card"
        >
          <TransitionGroup
            tag="ul"
            name="line"
            class="relative m-0 list-none p-0"
            :data-dragging="drag?.kind === kind || undefined"
            :data-recipe-list="kind"
          >
            <li
              v-for="(line, index) in draft[kind]"
              :key="line.id"
              class="item relative"
              :class="{ slot: drag?.kind === kind && drag.id === line.id }"
              :style="{ ...shifted(kind, index), '--enter-delay': `${enterDelays.get(line.id) ?? 0}ms` }"
              :data-line-id="line.id"
            >
              <div
                v-if="index > 0"
                class="ml-11 mr-4 h-px bg-line"
                aria-hidden="true"
              />
              <RecipeLine
                :ref="el => setLineRef(line.id, el)"
                v-model="line.text"
                :kind="kind"
                :index="drag?.kind === kind ? stepNumberShown(kind, index) : index"
                :total="draft[kind].length"
                :label="names[kind].field(index + 1)"
                :placeholder="names[kind].placeholder"
                :lifted="drag?.kind === kind && drag.id === line.id && !drag.dropping"
                :dropping="drag?.kind === kind && drag.id === line.id && drag.dropping"
                :pasted="pasted.has(line.id)"
                :menu-open="menu?.id === line.id"
                @enter="caret => onEnter(kind, index, caret)"
                @backspace-on-empty="onBackspace(kind, index)"
                @paste="(event, caret) => onPaste(kind, index, event, caret)"
                @remove="removeLine(kind, index)"
                @grip-down="event => onGripDown(kind, line, event)"
                @toggle-menu="onGripClick(kind, line)"
                @close-menu="menu = null"
                @move="delta => moveBy(kind, index, delta)"
              />
            </li>
          </TransitionGroup>
        </div>
        <button
          v-if="!full(kind)"
          ref="addButtons"
          type="button"
          class="flex h-12 items-center justify-center gap-2 rounded-pill border-2 border-dashed border-line-strong text-[15px] font-semibold leading-none text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :data-recipe-add="kind"
          @click="addLine(kind)"
        >
          <AppIcon
            name="plus"
            :size="17"
          />
          {{ names[kind].add }}
        </button>
        <div
          v-else
          class="flex items-center gap-3 rounded-[22px_19px_23px_20px] bg-search-tint px-4 py-3"
          data-recipe-full
        >
          <TopfbertIdle
            mood="happy"
            class="w-[34px] shrink-0"
          />
          <p class="min-w-0 flex-1 text-[14px] leading-[1.4] [text-wrap:pretty]">
            {{ names[kind].full(RECIPE_LIMITS[kind].lines) }}
          </p>
        </div>
      </section>
    </div>

    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ announcement }}
    </p>

    <AppToast v-model="toast" />

    <AppSheet
      v-model:open="asking"
      variant="dialog"
      :title="t.recipe.discardTitle"
      :close-label="t.detail.close"
    >
      <p class="mt-3 text-body text-text-muted">
        {{ t.recipe.discardText }}
      </p>
      <div class="mt-5 flex gap-2">
        <button
          type="button"
          class="h-[50px] flex-1 rounded-pill bg-surface-muted text-[15px] font-semibold text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          data-recipe-keep-editing
          @click="asking = false"
        >
          {{ t.recipe.keepEditing }}
        </button>
        <button
          type="button"
          class="h-[50px] shrink-0 rounded-pill bg-danger/10 px-5 text-[15px] font-semibold text-danger transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          data-recipe-discard
          @click="discard"
        >
          {{ t.recipe.discard }}
        </button>
      </div>
    </AppSheet>
  </div>
</template>

<style scoped>
/* While a line is dragged the lines it passes spring into their next slot
   (settle); the dragged line's own slot is dashed. Out of a drag nothing
   transitions, so the order changing on drop shows no jump. */
[data-dragging] .item {
  transition: translate var(--dur-settle) var(--ease-settle);
}
.slot {
  z-index: 2;
  outline: 2px dashed var(--color-line-strong);
  outline-offset: -2px;
  border-radius: var(--radius-field);
}
/* A line arrives fading in (a pasted batch one after another, the delay set
   per line), leaves to the right fading out (260ms, ease-in) while the ones
   below close up, and the others make room by moving (settle 480ms). */
.line-enter-active {
  transition: opacity var(--dur-fade) var(--ease-fade) var(--enter-delay, 0ms);
}
.line-enter-from {
  opacity: 0;
}
.line-leave-active {
  position: absolute;
  inset-inline: 0;
  transition: opacity 260ms ease-in, translate 260ms ease-in;
  pointer-events: none;
}
.line-leave-to {
  opacity: 0;
  translate: 44px 0;
}
.line-move {
  transition: transform var(--dur-settle) var(--ease-settle);
}
@media (prefers-reduced-motion: reduce) {
  .line-leave-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .line-leave-to {
    translate: none;
  }
}
</style>
