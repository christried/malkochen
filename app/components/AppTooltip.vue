<script setup lang="ts">
// The Tooltip (#206): the app's one styled tooltip, in place of the browser's
// own `title` ones. Anything says what it is by carrying `data-tooltip` with
// its text: icon buttons, and whatever else isn't self-explanatory. Mounted
// once (app.vue); it listens on the document, so nothing else has to.
//
// Under a mouse it comes up once the pointer has rested on the control for
// DELAY_MS, and at once when Tab brings the keyboard's focus to it; not when
// focus is put back on a control (a sheet closing, Escape in a menu), which
// nobody asked about. It goes when the pointer leaves, focus moves on, the
// control is pressed or clicked, or on Escape; pressed, it stays away until
// the pointer has left the control. None while a mouse button is held, so
// none over what a dragged Dish passes. Not for a finger: a touch has no
// hover, and a tap's focus isn't the keyboard's (:focus-visible). A
// disabled control has none, and one that is disabled, removed or scrolled
// off the screen while its Tooltip shows takes it along.
//
// For the eyes only (aria-hidden): a control with a Tooltip already has its
// name for screen readers. It is a manual popover, so it shows in the top
// layer, above a sheet or the Dish detail, and shown anew each time, so
// above whatever opened since.
const DELAY_MS = 400
// From the control, and from the screen's edges.
const GAP = 8
const EDGE = 8
// How often a showing Tooltip checks that its control is still there.
const CHECK_MS = 250

const bubble = useTemplateRef<HTMLElement>('bubble')
const text = ref('')
const route = useRoute()

// The control whose Tooltip shows, or is about to.
let anchor: HTMLElement | null = null
// The control that was pressed: none for it until the pointer has left it.
let pressed: HTMLElement | null = null
// Whether the last key pressed was Tab: focus that follows came by keyboard.
let tabbed = false
let timer: ReturnType<typeof setTimeout> | undefined
let check: ReturnType<typeof setInterval> | undefined

function controlOf(target: EventTarget | null): HTMLElement | null {
  const control = target instanceof Element ? target.closest<HTMLElement>('[data-tooltip]') : null
  if (!control?.dataset.tooltip || control.matches(':disabled, [aria-disabled="true"]')) return null
  return control
}

function hide() {
  clearTimeout(timer)
  clearInterval(check)
  anchor = null
  if (bubble.value?.matches(':popover-open')) bubble.value.hidePopover()
}

async function show(control: HTMLElement) {
  const el = bubble.value
  if (!el) return
  text.value = control.dataset.tooltip ?? ''
  if (el.matches(':popover-open')) el.hidePopover()
  await nextTick()
  // Gone or left meanwhile.
  if (anchor !== control || !control.isConnected) return
  el.showPopover()
  place()
  check = setInterval(() => {
    if (anchor && controlOf(anchor) !== anchor) hide()
  }, CHECK_MS)
}

// Centred under the control, or above it where there is no room below, and
// kept on the screen; gone with a control that has left the screen.
function place() {
  const el = bubble.value
  if (!el || !anchor) return
  const box = anchor.getBoundingClientRect()
  if (!anchor.isConnected || box.bottom < 0 || box.top > innerHeight || box.right < 0 || box.left > innerWidth) {
    hide()
    return
  }
  const { offsetWidth: width, offsetHeight: height } = el
  const above = box.bottom + GAP + height > innerHeight - EDGE && box.top - GAP - height >= EDGE
  const left = Math.max(EDGE, Math.min(box.left + box.width / 2 - width / 2, innerWidth - EDGE - width))
  el.style.left = `${left}px`
  el.style.top = `${above ? box.top - GAP - height : box.bottom + GAP}px`
  el.dataset.above = String(above)
}

function onPointerOver(event: PointerEvent) {
  // A finger coming down is a press (onPress).
  if (event.pointerType === 'touch') return
  const control = event.buttons ? null : controlOf(event.target)
  if (control !== pressed) pressed = null
  if (control === anchor) return
  hide()
  if (!control || control === pressed) return
  anchor = control
  timer = setTimeout(() => void show(control), DELAY_MS)
}

function onPress(event: Event) {
  hide()
  tabbed = false
  pressed = controlOf(event.target)
}

function onFocusIn(event: FocusEvent) {
  const control = event.target instanceof HTMLElement && event.target.dataset.tooltip ? controlOf(event.target) : null
  if (!tabbed || !control?.matches(':focus-visible')) return
  hide()
  anchor = control
  void show(control)
}

function onFocusOut(event: FocusEvent) {
  if (event.target === anchor) hide()
}

// Tab moves focus as this event ends, so the note of it is gone right after.
function onKeydown(event: KeyboardEvent) {
  tabbed = event.key === 'Tab'
  if (tabbed) setTimeout(() => (tabbed = false))
  if (event.key === 'Escape') hide()
}

onMounted(() => {
  document.addEventListener('pointerover', onPointerOver)
  document.documentElement.addEventListener('pointerleave', hide)
  document.addEventListener('pointerdown', onPress, true)
  document.addEventListener('click', onPress, true)
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('focusout', onFocusOut)
  document.addEventListener('keydown', onKeydown, true)
  // It stays by its control while the page scrolls under it.
  document.addEventListener('scroll', place, { capture: true, passive: true })
  window.addEventListener('resize', hide)
})
onBeforeUnmount(() => {
  hide()
  document.removeEventListener('pointerover', onPointerOver)
  document.documentElement.removeEventListener('pointerleave', hide)
  document.removeEventListener('pointerdown', onPress, true)
  document.removeEventListener('click', onPress, true)
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('focusout', onFocusOut)
  document.removeEventListener('keydown', onKeydown, true)
  document.removeEventListener('scroll', place, { capture: true })
  window.removeEventListener('resize', hide)
})
watch(() => route.fullPath, hide)
</script>

<template>
  <div
    ref="bubble"
    popover="manual"
    aria-hidden="true"
    class="tooltip rounded-chip bg-inverse px-3 py-2 text-small text-on-inverse shadow-card"
    data-app-tooltip
  >
    {{ text }}
  </div>
</template>

<style scoped>
/* The full title of a cut Dish title's look (DishCard), placed by script.
   A longer text wraps within 280px and keeps its line breaks. The pointer
   goes through it. It fades in, moving 4px toward its place; reduced
   motion: it only fades. */
.tooltip {
  position: fixed;
  inset: auto;
  margin: 0;
  border: 0;
  overflow: visible;
  width: max-content;
  max-width: min(280px, calc(100vw - 16px));
  white-space: pre-line;
  overflow-wrap: anywhere;
  pointer-events: none;
}
.tooltip:popover-open {
  animation: tooltip-in var(--dur-fade) var(--ease-fade);
}
.tooltip[data-above="true"]:popover-open {
  animation-name: tooltip-in-above;
}
@keyframes tooltip-in {
  from {
    opacity: 0;
    translate: 0 -4px;
  }
}
@keyframes tooltip-in-above {
  from {
    opacity: 0;
    translate: 0 4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes tooltip-in {
    from {
      opacity: 0;
    }
  }
  @keyframes tooltip-in-above {
    from {
      opacity: 0;
    }
  }
}
</style>
