<script setup lang="ts">
// The handoff's BottomSheet on phones, which becomes a Dialog at ≥768px. A
// native modal <dialog>: the browser traps focus, makes the page behind inert
// and closes it on Escape. Tapping the scrim closes it too, and on phones so
// does dragging it down by its handle. It moves in and out (handoff "Sheet
// open / close").
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ title: string, closeLabel: string }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const titleId = useId()

// Moving out, it keeps the title it had (callers often clear theirs on
// closing).
const shownTitle = ref(props.title)
watchEffect(() => {
  if (open.value) shownTitle.value = props.title
})

// Closing is at once (the page behind is usable and focus goes back right
// away); the sheet moves out after, still on top (see the styles), but out
// of reach: hidden from screen readers and inert.
watch(open, (isOpen) => {
  const el = dialog.value
  if (!el) return
  if (isOpen && !el.open) {
    el.style.translate = ''
    el.showModal()
  }
  if (!isOpen && el.open) el.close()
}, { flush: 'post' })

// Phones: the handle drags the sheet down (upwards only half as far as the
// finger, against resistance). Let go past a quarter of its height, or
// flicked down faster than 0.8px/ms, it closes; otherwise it springs back.
let pull: { id: number, startY: number, dy: number, lastY: number, lastT: number, speed: number } | null = null
function onHandleDown(event: PointerEvent) {
  if (!isPhoneLayout() || !dialog.value) return
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  pull = { id: event.pointerId, startY: event.clientY, dy: 0, lastY: event.clientY, lastT: event.timeStamp, speed: 0 }
  dialog.value.setAttribute('data-pulled', '')
}
function onHandleMove(event: PointerEvent) {
  if (!pull || event.pointerId !== pull.id || !dialog.value) return
  const dy = event.clientY - pull.startY
  pull.dy = dy < 0 ? dy * 0.5 : dy
  pull.speed = (event.clientY - pull.lastY) / Math.max(1, event.timeStamp - pull.lastT)
  pull.lastY = event.clientY
  pull.lastT = event.timeStamp
  dialog.value.style.translate = `0 ${pull.dy}px`
}
function onHandleUp(event: PointerEvent) {
  const el = dialog.value
  if (!pull || event.pointerId !== pull.id || !el) return
  const { dy, speed } = pull
  pull = null
  el.removeAttribute('data-pulled')
  if (dy > el.offsetHeight * 0.25 || speed > 0.8) open.value = false
  else el.style.translate = ''
}
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet bg-surface p-0 text-text shadow-sheet tablet:shadow-dialog"
    :aria-labelledby="titleId"
    :aria-hidden="!open || undefined"
    :inert="!open"
    @cancel.prevent="open = false"
    @close="open = false"
    @click.self="open = false"
  >
    <div class="px-5 pb-6 pt-3 tablet:px-7 tablet:pt-6">
      <div
        aria-hidden="true"
        class="handle -mx-5 -mt-3 mb-0 flex justify-center pb-3 pt-3 tablet:hidden"
        @pointerdown="onHandleDown"
        @pointermove="onHandleMove"
        @pointerup="onHandleUp"
        @pointercancel="onHandleUp"
      >
        <div class="h-1.5 w-10 rounded-pill bg-line-strong" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <h2
          :id="titleId"
          class="font-display text-title-m"
        >
          {{ shownTitle }}
        </h2>
        <button
          type="button"
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="closeLabel"
          @click="open = false"
        >
          <AppIcon
            name="close"
            :size="16"
          />
        </button>
      </div>
      <div class="sheet-body">
        <slot />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* Phone: a tall sheet from the bottom edge (handoff: top at 58px). */
.sheet {
  margin: auto 0 0;
  width: 100%;
  max-width: 100%;
  max-height: calc(100dvh - 58px);
  border: 0;
  border-radius: var(--radius-sheet);
  overflow-y: auto;
  overscroll-behavior: contain;
}
.sheet::backdrop {
  background: var(--color-scrim);
}
/* In: up from below with a little overshoot (440ms, sheet), the scrim
   fading in; its contents rise 14px from 150ms. Following the finger
   (dragged by the handle), it doesn't ease; let go, it springs back. */
.sheet[open] {
  animation: sheet-in var(--dur-sheet) var(--ease-sheet);
  transition: translate var(--dur-settle) var(--ease-settle);
}
.sheet[open]::backdrop {
  animation: scrim-in var(--dur-fade) var(--ease-fade);
}
.sheet[open] .sheet-body {
  animation: body-rise var(--dur-sheet) var(--ease-settle) 150ms backwards;
}
.sheet[data-pulled] {
  transition: none;
}
/* Out: closed at once, it moves down in 320ms (ease-in) while the scrim
   fades in 240ms, staying on top meanwhile (display and overlay transition
   discretely). Where `overlay` can't transition, it just goes. */
.sheet:not([open]) {
  transform: translateY(100%);
  transition:
    transform var(--dur-sheet-out) cubic-bezier(.4, 0, 1, 1),
    display var(--dur-sheet-out) allow-discrete,
    overlay var(--dur-sheet-out) allow-discrete;
}
.sheet:not([open])::backdrop {
  opacity: 0;
  transition:
    opacity var(--dur-scrim-out) var(--ease-fade),
    display var(--dur-sheet-out) allow-discrete,
    overlay var(--dur-sheet-out) allow-discrete;
}
.handle {
  touch-action: none;
  cursor: grab;
}

/* Tablet and up: a centred dialog. It scales in (.92 → 1, pop) and fades
   out in 150ms. */
@media (min-width: 768px) {
  .sheet {
    margin: auto;
    width: min(480px, calc(100% - 48px));
    max-height: calc(100dvh - 48px);
    border-radius: var(--radius-dialog);
  }
  .sheet[open] {
    animation: dialog-in var(--dur-pop) var(--ease-pop);
  }
  .sheet:not([open]) {
    transform: none;
    opacity: 0;
    transition:
      opacity 150ms var(--ease-fade),
      display var(--dur-scrim-out) allow-discrete,
      overlay var(--dur-scrim-out) allow-discrete;
  }
}

@keyframes sheet-in {
  from { transform: translateY(100%); }
}
@keyframes dialog-in {
  from { transform: scale(.92); opacity: 0; }
}
@keyframes body-rise {
  from { translate: 0 14px; opacity: 0; }
}
/* Reduced motion: its contents are there at once (main.css shortens the
   rise, but not its delay). */
@media (prefers-reduced-motion: reduce) {
  .sheet[open] .sheet-body {
    animation: none;
  }
}
</style>
