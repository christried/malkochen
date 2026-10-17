<script setup lang="ts">
import type { TourButton, TourStep } from '~/tour/tour'
import { placeTour, type Box, type TourPlacement } from '~/utils/tour-placement'

// Draws the Tour's step (app/tour/tour.ts) with TourStepView, in one of two
// places:
// - On the Board: a modal <dialog> in the top layer. The page behind is
//   inert, so a tap anywhere but the bubble does nothing, Esc (and Android's
//   back button, which closes a modal dialog) skips the Tour, and focus moves
//   into the bubble on every step. A step the user acts on gets a button
//   over the hole that passes the tap on to the target.
// - In a sheet (a step whose target is inside an open modal, like Add
//   Dish's link field): lifted into that sheet's <dialog> as a manual
//   popover, so it shows above the sheet while the sheet keeps its own focus
//   and Esc. Its taps reach the target through the hole; elsewhere they do
//   nothing (a see-through catcher with the hole's shape cut out takes
//   them, so nothing the layer draws is cut).
// - On the Board, live (a step whose target is dragged, like the Tour's Dish
//   to another Column): a manual popover over the page, which stays live, so
//   a drag that starts in the hole reaches the page; taps elsewhere do
//   nothing. Esc and Android's back button skip the Tour (a CloseWatcher).
// While the layer is modal on the Board (`modal`), what must stay reachable
// over it goes into its `data-tour-overlays` (the Toast's "Rückgängig").
// A step the user acts on whose target has gone (they're busy with what it
// opened) steps aside: nothing shows until the next step. → and ← go
// forwards and back. It follows its target on every frame, through
// resizing, rotation and scrolling. Reduced motion: nothing moves but
// Topfbert, who stands still in his pose.
const props = defineProps<{ step: TourStep | null }>()
const emit = defineEmits<{ choose: [button: TourButton] }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const popover = useTemplateRef<HTMLElement>('popover')
const pageView = useTemplateRef<{ bubble: HTMLElement | null, spot: HTMLElement | null }>('pageView')
const sheetView = useTemplateRef<{ bubble: HTMLElement | null, spot: HTMLElement | null }>('sheetView')
const titleId = useId()
const textId = useId()

// Where the step shows: on the Board, in the sheet its target is in, or
// nowhere (not measured yet, or stepped aside).
const where = shallowRef<'board' | HTMLDialogElement | null>(null)
const live = computed(() => !!props.step?.live && where.value === 'board')
const onBoard = computed(() => !!props.step && where.value === 'board' && !live.value)
useModalStack(onBoard)
defineExpose({ modal: onBoard })
// Where the popover goes: into the sheet, or over the live Board. A new one
// for each place, shown as it's added.
const popoverHost = computed(() => live.value ? 'body' : where.value === 'board' ? null : where.value)
const popoverKey = ref(0)
watch(popoverHost, () => popoverKey.value++)

// The step shown last, kept while the layer closes.
const shown = shallowRef<TourStep | null>(null)
watchEffect(() => {
  if (props.step) shown.value = props.step
})

watch(onBoard, (isOpen) => {
  const el = dialog.value
  if (!el) return
  if (isOpen && !el.open) el.showModal()
  if (!isOpen && el.open) el.close()
}, { flush: 'post' })
// Lifted once it's in the sheet: above the sheet, which opened before.
watch(popover, el => el?.showPopover())

// Where everything goes, measured again every frame while a step shows;
// null until it first is. A target gone since the Tour started (a rotation
// swapped the Columns' tabs for their titles): the step shows unspotlit.
const placement = shallowRef<TourPlacement | null>(null)
const viewport = shallowRef({ width: 0, height: 0 })
const pressLabel = ref('')
// The side Topfbert has stood on in this step: he keeps it while the target
// wobbles round the window's middle.
let side: { step: string, mirrored: boolean } | null = null
// Where the hole is on this frame, gliding or not, and its corners'.
const spotBox = shallowRef<(Box & { radius: number }) | null>(null)
// The ring draws once the hole has settled on a new target (the step, and
// its first element): it stood still where it should be for a few frames.
// A Dish card flying in keeps it moving, so the ring waits for it to land.
const ringDrawn = ref(false)
let ringTarget: { step: string, element: Element | undefined } | null = null
let stillFrames = 0
let lastSpot: DOMRect | null = null
const STILL_FRAMES = 3
// Hidden with the step that shows, not a frame later.
watch(() => props.step?.id, () => {
  ringDrawn.value = false
}, { flush: 'sync' })
let frame = 0
function follow() {
  frame = requestAnimationFrame(follow)
  const step = props.step
  if (!step) return
  const elements = tourTargetElements(step)
  const first = elements[0]
  const next = step.handsOn && step.target && !first
    ? null
    : first?.closest<HTMLDialogElement>('dialog[open]:not([data-tour-layer])') ?? 'board'
  if (next !== where.value) where.value = next
  const modal = next === 'board' && !step.live
  const host = modal ? dialog.value : popover.value
  const bubble = (modal ? pageView.value : sheetView.value)?.bubble
  if (!next || !host || !bubble) return
  const size = { width: host.clientWidth, height: host.clientHeight }
  if (size.width !== viewport.value.width || size.height !== viewport.value.height) viewport.value = size
  const radius = first ? Number.parseFloat(getComputedStyle(first).borderTopLeftRadius) || 0 : 0
  const mirrored = side?.step === step.id ? side.mirrored : null
  const placed = placeTour({ viewport: size, target: tourTargetBox(elements), radius, corner: step.corner, mirrored, bubbleHeight: bubble.offsetHeight })
  side = { step: step.id, mirrored: placed.topfbert.mirrored }
  if (JSON.stringify(placed) !== JSON.stringify(placement.value)) placement.value = placed
  pressLabel.value = first ? first.getAttribute('aria-label') ?? first.textContent?.trim() ?? '' : ''
  followSpot(step.id, first, placed.hole, (modal ? pageView.value : sheetView.value)?.spot)
}

function followSpot(step: string, first: Element | undefined, hole: TourPlacement['hole'], spot: HTMLElement | null | undefined) {
  if (ringTarget?.step !== step || ringTarget.element !== first) {
    ringTarget = { step, element: first }
    ringDrawn.value = false
    stillFrames = 0
  }
  if (!hole || !spot) {
    spotBox.value = null
    return
  }
  const now = spot.getBoundingClientRect()
  const near = (a: number, b: number) => Math.abs(a - b) < 0.5
  const still = !!lastSpot && near(now.left, lastSpot.left) && near(now.top, lastSpot.top) && near(now.width, lastSpot.width) && near(now.height, lastSpot.height)
  const arrived = near(now.left, hole.left) && near(now.top, hole.top) && near(now.width, hole.width) && near(now.height, hole.height)
  lastSpot = now
  stillFrames = still && arrived ? stillFrames + 1 : 0
  if (stillFrames >= STILL_FRAMES) ringDrawn.value = true
  const radius = Math.max(0, Math.min(Number.parseFloat(getComputedStyle(spot).borderTopLeftRadius) || 0, now.width / 2, now.height / 2))
  const box = { left: now.left, top: now.top, width: now.width, height: now.height, radius }
  if (JSON.stringify(box) !== JSON.stringify(spotBox.value)) spotBox.value = box
}
watch(() => !!props.step, (running) => {
  cancelAnimationFrame(frame)
  if (running) {
    frame = requestAnimationFrame(follow)
    return
  }
  where.value = null
  placement.value = null
  side = null
  ringTarget = null
}, { flush: 'post' })
onMounted(() => {
  if (props.step) frame = requestAnimationFrame(follow)
})
onBeforeUnmount(() => cancelAnimationFrame(frame))

// Each step, and wherever it moves: its target scrolled into view and focus
// in the bubble, which screen readers then read out.
watch([() => props.step?.id, where], async ([id, at]) => {
  if (!id || !at) return
  await nextTick()
  const step = props.step
  if (step && at === 'board') tourTargetElements(step)[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  ;(onBoard.value ? pageView.value : sheetView.value)?.bubble?.focus()
}, { flush: 'post' })

// Live on the Board, Esc and Android's back button skip the Tour, as they
// do while it's modal; a sheet opened over it gets them first.
interface CloseWatcher { onclose: (() => void) | null, destroy: () => void }
let closeWatcher: CloseWatcher | null = null
watch(live, (isLive) => {
  closeWatcher?.destroy()
  closeWatcher = null
  const Watcher = (window as { CloseWatcher?: new () => CloseWatcher }).CloseWatcher
  if (!isLive || !Watcher) return
  closeWatcher = new Watcher()
  closeWatcher.onclose = () => choose('skip')
})
onBeforeUnmount(() => closeWatcher?.destroy())

function choose(button: TourButton) {
  emit('choose', button)
}

// The tap on the hole, on to the target behind the inert page.
function press() {
  if (props.step) tourTargetElements(props.step)[0]?.click()
}

function onKey(event: KeyboardEvent) {
  const buttons = props.step?.buttons ?? []
  const forward = buttons.find(b => b === 'next' || b === 'finish')
  if (event.key === 'ArrowRight' && forward) {
    event.preventDefault()
    choose(forward)
  }
  else if (event.key === 'ArrowLeft' && buttons.includes('back')) {
    event.preventDefault()
    choose('back')
  }
  else if (event.key === 'Escape' && live.value && !closeWatcher) {
    event.preventDefault()
    choose('skip')
  }
}

// Esc and the back button close the dialog on the Board: that skips the
// Tour. Closed because the step moved into a sheet or went live, it goes on.
function onClosed() {
  if (onBoard.value) choose('skip')
}

// In a sheet and live on the Board, taps through the hole reach the target;
// the catcher takes the rest. Its hole is the spot's own, rounded, wherever
// the spot is on this frame.
const throughHole = computed(() => {
  const hole = spotBox.value
  if (!hole) return undefined
  const { width, height } = viewport.value
  const { left, top, radius: r } = hole
  const right = left + hole.width
  const bottom = top + hole.height
  const arc = (x: number, y: number) => `A${r} ${r} 0 0 1 ${x} ${y}`
  return `path(evenodd, 'M0 0H${width}V${height}H0Z M${left + r} ${top}H${right - r}${arc(right, top + r)}V${bottom - r}${arc(right - r, bottom)}H${left + r}${arc(left, bottom - r)}V${top + r}${arc(left + r, top)}Z')`
})
</script>

<template>
  <dialog
    ref="dialog"
    class="tour"
    :aria-labelledby="titleId"
    :aria-describedby="textId"
    data-tour-layer
    @cancel.prevent="choose('skip')"
    @close="onClosed"
    @keydown="onKey"
  >
    <TourStepView
      v-if="shown && where === 'board' && !live"
      ref="pageView"
      :step="shown"
      :placement="placement"
      :ring-drawn="ringDrawn"
      :title-id="titleId"
      :text-id="textId"
      :press="shown.handsOn ? { label: pressLabel } : null"
      @choose="choose"
      @press="press"
    />
    <div data-tour-overlays />
  </dialog>
  <Teleport
    v-if="shown && popoverHost"
    :to="popoverHost"
  >
    <div
      ref="popover"
      :key="popoverKey"
      popover="manual"
      class="tour"
      role="dialog"
      :aria-labelledby="titleId"
      :aria-describedby="textId"
      data-tour-layer
      @keydown="onKey"
    >
      <div
        class="catch"
        :style="{ clipPath: throughHole }"
        aria-hidden="true"
      />
      <TourStepView
        ref="sheetView"
        :step="shown"
        :placement="placement"
        :ring-drawn="ringDrawn"
        :title-id="titleId"
        :text-id="textId"
        :press="null"
        @choose="choose"
      />
    </div>
  </Teleport>
</template>

<style scoped>
/* The whole window, see-through: what shows is drawn inside. */
.tour {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  overflow: hidden;
  background: transparent;
  color: var(--color-text);
  outline: none;
}
.tour::backdrop {
  background: transparent;
}
/* As a popover, only the catcher and the bubble take taps. */
.tour[popover] {
  pointer-events: none;
}
.catch {
  position: absolute;
  inset: 0;
  pointer-events: auto;
}
.tour[popover] :deep(.bubble) {
  pointer-events: auto;
}
/* With motion: the layer fades in. */
@media (prefers-reduced-motion: no-preference) {
  .tour[open],
  .tour:popover-open {
    animation: tour-in var(--dur-fade) var(--ease-fade);
  }
}
@keyframes tour-in {
  from { opacity: 0; }
}
</style>
