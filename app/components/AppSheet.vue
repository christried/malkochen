<script setup lang="ts">
// The handoff's BottomSheet on phones, which becomes a Dialog at ≥768px. A
// native modal <dialog>: the browser traps focus, makes the page behind inert
// and closes it on Escape. Tapping the scrim closes it too, and on phones so
// does dragging it down by its handle. It moves in and out (handoff "Sheet
// open / close"). Confirming or choosing (handoff Dialog: confirm,
// destructive, type-to-confirm, picker), it is a Dialog on phones too:
// `variant="dialog"`. Your Settings (#283) are a sheet on phones and a side
// sheet from 768px: full height on the right edge, moving in from it
// (`variant="side"`). Another modal opened over it, it steps back.
const open = defineModel<boolean>('open', { required: true })
const props = withDefaults(defineProps<{ title: string, closeLabel: string, variant?: 'sheet' | 'dialog' | 'side' }>(), { variant: 'sheet' })
const covered = useModalStack(open)

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
    class="sheet overflow-y-auto bg-surface p-0 text-text shadow-sheet tablet:shadow-dialog"
    :class="{ 'is-dialog': variant === 'dialog', 'is-side': variant === 'side' }"
    :data-covered="covered || undefined"
    :aria-labelledby="titleId"
    :aria-hidden="!open || undefined"
    :inert="!open"
    @cancel.prevent="open = false"
    @close="open = false"
    @click.self="open = false"
  >
    <div
      class="px-5 pb-6 tablet:px-7 tablet:pt-6"
      :class="variant === 'dialog' ? 'pt-6' : 'pt-3'"
    >
      <div
        v-if="variant !== 'dialog'"
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
          :data-tooltip="closeLabel"
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
  transition: translate var(--dur-settle) var(--ease-settle), scale var(--dur-sheet) var(--ease-sheet);
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
    transform var(--dur-sheet-out) var(--ease-sheet-out),
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
/* Covered by another modal: it scales to .96 and dims 20%. */
.sheet::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: #000;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.sheet[data-covered] {
  scale: .96;
}
.sheet[data-covered]::after {
  opacity: .2;
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
/* Tablet and up, a side sheet: 420px wide on the right edge, full height,
   its left corners rounded like a dialog. It moves in from the right edge
   like a sheet from the bottom (440ms, sheet) and out the same way (320ms,
   ease-in), past its shadow. Covered, it only dims: scaled, it would pull
   away from the edges. */
@media (min-width: 768px) {
  .sheet.is-side {
    margin: 0 0 0 auto;
    width: min(420px, 100%);
    height: 100dvh;
    max-height: 100dvh;
    border-radius: var(--radius-dialog) 0 0 var(--radius-dialog);
  }
  .sheet.is-side[open] {
    animation: side-in var(--dur-sheet) var(--ease-sheet);
  }
  .sheet.is-side[data-covered] {
    scale: none;
  }
  .sheet.is-side:not([open]) {
    opacity: 1;
    transform: translateX(calc(100% + 24px));
    transition:
      transform var(--dur-sheet-out) var(--ease-sheet-out),
      display var(--dur-sheet-out) allow-discrete,
      overlay var(--dur-sheet-out) allow-discrete;
  }
}
/* A Dialog on phones: centred, it pops in from .4 with an overshoot, and
   fades out in 150ms. */
@media (max-width: 767.98px) {
  .sheet.is-dialog {
    margin: auto;
    width: calc(100% - 32px);
    max-height: calc(100dvh - 48px);
    border-radius: var(--radius-dialog);
    box-shadow: var(--shadow-dialog);
  }
  .sheet.is-dialog[open] {
    animation: dialog-pop var(--dur-pop) var(--ease-pop);
  }
  .sheet.is-dialog:not([open]) {
    transform: none;
    opacity: 0;
    transition:
      opacity 150ms var(--ease-fade),
      display var(--dur-scrim-out) allow-discrete,
      overlay var(--dur-scrim-out) allow-discrete;
  }
}
/* Reduced motion: it fades in and out (200ms), no slide or scale; covered,
   it only dims. */
@media (prefers-reduced-motion: reduce) {
  .sheet[open] {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  @starting-style {
    .sheet[open] {
      opacity: 0;
    }
  }
  .sheet.is-side[open] {
    animation: none;
  }
  .sheet:not([open]),
  .sheet.is-dialog:not([open]),
  .sheet.is-side:not([open]) {
    transform: none;
    opacity: 0;
    transition:
      opacity var(--dur-fade) var(--ease-fade),
      display var(--dur-fade) allow-discrete,
      overlay var(--dur-fade) allow-discrete;
  }
  .sheet:not([open])::backdrop {
    transition:
      opacity var(--dur-fade) var(--ease-fade),
      display var(--dur-fade) allow-discrete,
      overlay var(--dur-fade) allow-discrete;
  }
  .sheet[data-covered] {
    scale: none;
  }
}

@keyframes sheet-in {
  from { transform: translateY(100%); }
}
@keyframes side-in {
  from { transform: translateX(calc(100% + 24px)); }
}
@keyframes dialog-in {
  from { transform: scale(.92); opacity: 0; }
}
@keyframes dialog-pop {
  from { transform: scale(.4); opacity: 0; }
}
@keyframes body-rise {
  from { translate: 0 14px; opacity: 0; }
}
</style>
