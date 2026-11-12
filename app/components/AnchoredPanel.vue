<script setup lang="ts">
// A panel that stays beside the button that opened it (handoff BottomSheet
// r14: on desktop the Dish picker, day picker, cook picker and a Planned
// Dish's menu are popovers anchored to their trigger, not centred dialogs,
// so the day or the detail stays in view beside them). A manual popover in
// the top layer, placed below the `anchor` (or above where there is no room
// below) and kept on the screen. Escape and a press anywhere else close it
// and focus goes back to the trigger. It pops in from the anchor's side
// (r14-pop, 360ms) and fades out (r14-popout, 200ms); reduced motion: it
// fades.
const open = defineModel<boolean>('open', { required: true })
const props = withDefaults(defineProps<{
  anchor: HTMLElement | null
  label: string
  width?: number
  height?: number
  // Which edge of the anchor it lines up with.
  align?: 'start' | 'end'
}>(), { width: 320, height: 0, align: 'start' })

const panel = useTemplateRef<HTMLElement>('panel')
const GAP = 8
const EDGE = 12

let resized: ResizeObserver | undefined

async function show() {
  await nextTick()
  const el = panel.value
  if (!open.value || !el) return
  el.dataset.closing = 'false'
  if (!el.matches(':popover-open')) el.showPopover()
  place()
  resized = new ResizeObserver(place)
  resized.observe(el)
  addEventListener('pointerdown', onPressAnywhere, true)
  addEventListener('keydown', onKey, true)
  addEventListener('resize', place)
  addEventListener('scroll', place, true)
}

function hide() {
  resized?.disconnect()
  resized = undefined
  removeEventListener('pointerdown', onPressAnywhere, true)
  removeEventListener('keydown', onKey, true)
  removeEventListener('resize', place)
  removeEventListener('scroll', place, true)
  const el = panel.value
  if (!el?.matches(':popover-open')) return
  // It fades out where it is, then goes.
  el.dataset.closing = 'true'
  const done = () => el.matches(':popover-open') && el.dataset.closing === 'true' && el.hidePopover()
  setTimeout(done, motionMs('fade'))
}

function place() {
  const el = panel.value
  const anchor = props.anchor
  if (!el || !anchor || !open.value) return
  const box = anchor.getBoundingClientRect()
  const width = el.offsetWidth
  const height = el.offsetHeight
  const below = box.bottom + GAP + height <= innerHeight - EDGE
  const above = box.top - GAP - height >= EDGE
  const top = below || !above ? Math.max(EDGE, Math.min(box.bottom + GAP, innerHeight - EDGE - height)) : box.top - GAP - height
  const wanted = props.align === 'end' ? box.right - width : box.left
  el.style.left = `${Math.max(EDGE, Math.min(wanted, innerWidth - EDGE - width))}px`
  el.style.top = `${top}px`
  el.dataset.above = String(!below && above)
  el.style.transformOrigin = `${props.align === 'end' ? 'right' : 'left'} ${!below && above ? 'bottom' : 'top'}`
}

function onPressAnywhere(event: PointerEvent) {
  const target = event.target as Node | null
  if (!target || panel.value?.contains(target) || props.anchor?.contains(target)) return
  open.value = false
}

function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  event.preventDefault()
  event.stopPropagation()
  open.value = false
  props.anchor?.focus({ preventScroll: true })
}

watch(open, (isOpen) => {
  if (isOpen) void show()
  else hide()
}, { flush: 'post' })
onMounted(() => {
  if (open.value) void show()
})
onBeforeUnmount(() => {
  hide()
  if (panel.value?.matches(':popover-open')) panel.value.hidePopover()
})
</script>

<template>
  <div
    ref="panel"
    popover="manual"
    role="dialog"
    :aria-label="label"
    class="panel fixed m-0 overflow-hidden border border-line bg-surface p-0 text-text shadow-dialog"
    :style="{ width: `${width}px`, ...height && { height: `${height}px` } }"
  >
    <slot />
  </div>
</template>

<style scoped>
.panel {
  border-radius: 28px 24px 29px 25px;
  max-height: calc(100dvh - 24px);
  inset: auto;
}
.panel:popover-open {
  animation: r14-pop 360ms var(--ease-pop);
}
.panel[data-closing='true'] {
  animation: r14-popout 200ms var(--ease-fade) forwards;
}
@media (prefers-reduced-motion: reduce) {
  .panel:popover-open {
    animation: fade-in var(--dur-fade) var(--ease-fade);
  }
  .panel[data-closing='true'] {
    animation: fade-out var(--dur-fade) var(--ease-fade) forwards;
  }
}
@keyframes fade-in {
  from { opacity: 0; }
}
@keyframes fade-out {
  to { opacity: 0; }
}
</style>
