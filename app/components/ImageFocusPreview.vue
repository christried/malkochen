<script setup lang="ts">
import { focusPosition, type ImageFocus } from '~~/shared/image-focus'
import { coverOverflow, dragFocus, nudgeFocus } from '~/utils/image-focus'

// The image dialog's "Ausschnitt": a Source image or own photo in the frame
// of a card's thumb (DishCard: 86×108), twice as large. Dragging the image,
// scrolling over it or the arrow keys shift it (no zoom), moving its focus
// point (shared/image-focus.ts), which every frame then uses. It only moves
// along the axis the frame crops.
const focus = defineModel<ImageFocus>('focus', { required: true })
defineProps<{ src: string }>()
const t = useStrings()

const frame = useTemplateRef<HTMLElement>('frame')
const image = useTemplateRef<HTMLImageElement>('image')

// How far the image overflows the frame now, along each axis.
function overflow(): ImageFocus {
  const img = image.value
  const box = frame.value
  if (!img?.naturalWidth || !box) return { x: 0, y: 0 }
  return coverOverflow({ width: img.naturalWidth, height: img.naturalHeight }, { width: box.clientWidth, height: box.clientHeight })
}

// The axis the image can move along, once it has loaded: for screen readers,
// the slider's orientation and value.
const axis = ref<'x' | 'y'>('y')
function measure() {
  const { x, y } = overflow()
  axis.value = x > y ? 'x' : 'y'
}
onMounted(() => {
  if (image.value?.complete) measure()
})

let drag: { id: number, startX: number, startY: number, from: ImageFocus, overflow: ImageFocus } | null = null
function onDown(event: PointerEvent) {
  if (event.button !== 0) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY, from: { ...focus.value }, overflow: overflow() }
}
function onMove(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.id) return
  focus.value = dragFocus(drag.from, { dx: event.clientX - drag.startX, dy: event.clientY - drag.startY }, drag.overflow)
}
function onUp(event: PointerEvent) {
  if (drag?.id === event.pointerId) drag = null
}

// Scrolling over it shifts the image as if the frame were a window onto it;
// a plain mouse wheel scrolls a landscape image sideways. The sheet scrolls
// on only if the image can't move.
function onWheel(event: WheelEvent) {
  const room = overflow()
  if (room.x <= 0 && room.y <= 0) return
  event.preventDefault()
  const delta = room.y > 0 ? { dx: 0, dy: -event.deltaY } : { dx: -(event.deltaX || event.deltaY), dy: 0 }
  focus.value = dragFocus(focus.value, delta, room)
}

function onKey(event: KeyboardEvent) {
  const nudged = nudgeFocus(focus.value, event.key)
  if (!nudged) return
  event.preventDefault()
  focus.value = nudged
}

const value = computed(() => Math.round(focus.value[axis.value]))
const valueText = computed(() => t.imageDialog.focusValue(Math.round(focus.value.x), Math.round(focus.value.y)))
</script>

<template>
  <div class="flex flex-col items-center gap-2">
    <div
      ref="frame"
      role="slider"
      tabindex="0"
      :aria-label="t.imageDialog.focus"
      :aria-orientation="axis === 'x' ? 'horizontal' : 'vertical'"
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
      >
    </div>
    <p class="text-center text-small text-text-muted">
      {{ t.imageDialog.focusHint }}
    </p>
  </div>
</template>
