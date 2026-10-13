<script setup lang="ts">
import { focusPosition, type ImageFocus } from '~~/shared/image-focus'
import { coverOverflow, dragFocus, nudgeFocus } from '~/utils/image-focus'

// The image dialog's "Ausschnitt": a Source image or own photo in the frame
// of a card's thumb (DishCard: 86×108), twice as large. Dragging the image,
// scrolling over it or the arrow keys shift it (no zoom), moving its focus
// point (shared/image-focus.ts), which every frame then uses. It only moves
// along the axis the frame crops. An image that doesn't load has nothing to
// shift: then it doesn't show.
const focus = defineModel<ImageFocus>('focus', { required: true })
defineProps<{ src: string }>()
const t = useStrings()

const frame = useTemplateRef<HTMLElement>('frame')
const image = useTemplateRef<HTMLImageElement>('image')
const broken = ref(false)

// How far the image overflows the frame, along each axis, measured once it
// has loaded and whenever the frame changes size (from none, while the
// dialog is closed): nothing moves before that.
const overflow = ref<ImageFocus>({ x: 0, y: 0 })
function measure() {
  const img = image.value
  const box = frame.value
  if (!img?.naturalWidth || !box) return
  overflow.value = coverOverflow({ width: img.naturalWidth, height: img.naturalHeight }, { width: box.clientWidth, height: box.clientHeight })
}
let resizes: ResizeObserver | undefined
onMounted(() => {
  const img = image.value
  if (img?.complete && img.naturalWidth === 0) broken.value = true
  resizes = new ResizeObserver(measure)
  if (frame.value) resizes.observe(frame.value)
})
onBeforeUnmount(() => resizes?.disconnect())

let drag: { id: number, startX: number, startY: number, from: ImageFocus } | null = null
function onDown(event: PointerEvent) {
  if (event.button !== 0) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, from: { ...focus.value } }
}
function onMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  focus.value = dragFocus(drag.from, { dx: event.clientX - drag.startX, dy: event.clientY - drag.startY }, overflow.value)
}
function onUp(event: PointerEvent) {
  if (drag?.id === event.pointerId) drag = null
}

// Scrolling over it shifts the image as if the frame were a window onto it;
// a plain mouse wheel scrolls a landscape image sideways. The sheet scrolls
// on only if the image can't move. Wheels that count in lines (Firefox) or
// pages scroll as far as they would on a page.
const LINE_PX = 16
function onWheel(event: WheelEvent) {
  const room = overflow.value
  if (room.x <= 0 && room.y <= 0) return
  event.preventDefault()
  const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? LINE_PX : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? frame.value?.clientHeight ?? 0 : 1
  const delta = room.y > 0 ? { dx: 0, dy: -event.deltaY * unit } : { dx: -(event.deltaX || event.deltaY) * unit, dy: 0 }
  focus.value = dragFocus(focus.value, delta, room)
}

function onKey(event: KeyboardEvent) {
  const nudged = nudgeFocus(focus.value, event.key, overflow.value)
  if (!nudged) return
  event.preventDefault()
  focus.value = nudged
}

// As a slider: horizontal for an image cropped at the sides, its value how
// far right it shows; else vertical, its value how far up (Up raises it, as
// sliders do). The text says where the focus point is.
const horizontal = computed(() => overflow.value.x > overflow.value.y)
const value = computed(() => Math.round(horizontal.value ? focus.value.x : 100 - focus.value.y))
const valueText = computed(() => t.imageDialog.focusValue(Math.round(focus.value.x), Math.round(focus.value.y)))
</script>

<template>
  <div
    v-if="!broken"
    class="flex flex-col items-center gap-2"
  >
    <h3 class="section-heading mt-5 self-start">
      {{ t.imageDialog.focus }}
    </h3>
    <div
      ref="frame"
      role="slider"
      tabindex="0"
      :aria-label="t.imageDialog.focus"
      :aria-orientation="horizontal ? 'horizontal' : 'vertical'"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="value"
      :aria-valuetext="valueText"
      class="aspect-[86/108] w-[172px] cursor-grab touch-none select-none overflow-hidden rounded-thumb bg-surface-muted shadow-card active:cursor-grabbing focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      data-image-focus
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @wheel="onWheel"
      @keydown="onKey"
    >
      <img
        ref="image"
        :src="src"
        alt=""
        referrerpolicy="no-referrer"
        draggable="false"
        class="pointer-events-none h-full w-full object-cover"
        :style="{ objectPosition: focusPosition(focus) }"
        @load="measure"
        @error="broken = true"
      >
    </div>
    <p class="text-center text-small text-text-muted">
      {{ t.imageDialog.focusHint }}
    </p>
  </div>
</template>
