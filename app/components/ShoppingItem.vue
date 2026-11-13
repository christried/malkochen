<script setup lang="ts">
import type { ShoppingEntry } from '~/board/shopping-list'
import { hapticActivate, hapticLongPress } from '~/utils/haptics'
import { prefersReducedMotion } from '~/utils/motion'
import { LONG_PRESS_MS, swipeLeaves, swipeOffset, touchAxis, type TouchAxis, velocityPxPerS } from '~/utils/shopping-lines'

// One line of the Shopping List (#536, R15). A tap anywhere on the row ticks
// it off (its pebble pops and its strike draws, then it waits in place; the
// group moves it) or back on. On a phone a long press changes it, and a swipe
// left removes it; on a desktop the pencil and the trash appear on hover and
// focus, and the keys do the same: Space ticks, Enter changes, Delete removes,
// ↑ and ↓ move between lines. Lines not sent yet are marked "Noch nicht
// gesendet". While the line is being changed, ShoppingItemInput's edit field
// stands in for the row. The root is the `li`, so the group's TransitionGroup
// animates the line itself.
const props = defineProps<{
  entry: ShoppingEntry
  editing: boolean
  // The group's name, for the line's label: "Sonstiges" or the Dish's title.
  groupName: string
}>()
const emit = defineEmits<{
  tick: []
  edit: []
  save: [text: string]
  cancel: []
  remove: []
}>()

const t = useStrings()
const row = useTemplateRef<HTMLElement>('row')

// How long the tick's motion lasts before the pebble settles (pop 380,
// strike and check drawn by 340ms).
const PULSE_MS = 1000
// A swipe past this many pixels gives a light buzz, as the handoff's threshold.
const SWIPE_BUZZ_PX = 96
// The swipe's leave: 240ms to the left, or a fade under reduced motion.
const LEAVE_MS = 240
const REDUCED_LEAVE_MS = 200

// ---- A tick: the motion is for a tick by this Member, not for what arrives ----

const pulsing = ref(false)
let pulseTimer: ReturnType<typeof setTimeout> | undefined

// ---- Touch: a long press changes the line, a swipe left removes it ----

type Sample = { x: number, t: number }
// The touch that is on the row now: its pointer, and where it went down.
let press: { id: number, x: number, y: number } | null = null
// The last two samples of a swipe, for its speed when the finger lifts.
let earlier: Sample | null = null
let latest: Sample | null = null
let axis: TouchAxis = 'still'
let holdTimer: ReturnType<typeof setTimeout> | undefined
let leaveTimer: ReturnType<typeof setTimeout> | undefined
// The touch was a long press or a swipe, so the click it may leave is not a tick.
let consumed = false
let buzzed = false

const offset = ref(0)
const leaving = ref(false)
const springing = ref(false)

const rowTransform = computed(() => {
  if (leaving.value) return 'translateX(-105%)'
  return offset.value < 0 ? `translateX(${offset.value}px)` : ''
})
// The danger behind the row shows as the row is pulled, and fades with it
// when it leaves under reduced motion.
const dangerShown = computed(() => {
  if (leaving.value) return prefersReducedMotion() ? 0 : 1
  return Math.min(1, -offset.value / 24)
})

function onPointerDown(event: PointerEvent) {
  consumed = false
  if (event.pointerType !== 'touch' || !event.isPrimary || leaving.value) return
  press = { id: event.pointerId, x: event.clientX, y: event.clientY }
  earlier = null
  latest = { x: event.clientX, t: event.timeStamp }
  axis = 'still'
  buzzed = false
  springing.value = false
  holdTimer = setTimeout(() => {
    holdTimer = undefined
    if (!press) return
    consumed = true
    hapticLongPress()
    emit('edit')
  }, LONG_PRESS_MS)
}

function onPointerMove(event: PointerEvent) {
  if (!press || event.pointerId !== press.id) return
  const dx = event.clientX - press.x
  const dy = event.clientY - press.y
  if (axis === 'still') {
    axis = touchAxis(dx, dy)
    if (axis === 'still') return
    // Moved on: it is no long press, and a swipe keeps the touch even off the row.
    clearTimeout(holdTimer)
    holdTimer = undefined
    if (axis === 'swipe') row.value?.setPointerCapture(event.pointerId)
  }
  if (axis !== 'swipe') return
  offset.value = swipeOffset(dx)
  earlier = latest
  latest = { x: event.clientX, t: event.timeStamp }
  if (!buzzed && -offset.value >= SWIPE_BUZZ_PX) {
    buzzed = true
    hapticActivate()
  }
}

function onPointerUp(event: PointerEvent) {
  if (!press || event.pointerId !== press.id) return
  finish(event.timeStamp, false)
}

function onPointerCancel(event: PointerEvent) {
  if (!press || event.pointerId !== press.id) return
  finish(event.timeStamp, true)
}

// The touch is over. A swipe that has gone far enough, or fast enough, leaves
// and removes the line; a shorter one springs back. A finger that stopped
// before it lifted has no speed.
function finish(at: number, cancelled: boolean) {
  clearTimeout(holdTimer)
  holdTimer = undefined
  const swiping = axis === 'swipe'
  press = null
  if (!swiping) return
  consumed = true
  const width = row.value?.offsetWidth ?? 0
  const stopped = !latest || at - latest.t > 100
  const velocity = !earlier || !latest || stopped ? 0 : velocityPxPerS(earlier, latest)
  if (!cancelled && swipeLeaves(offset.value, width, velocity)) leave()
  else spring()
}

function leave() {
  leaving.value = true
  leaveTimer = setTimeout(() => emit('remove'), prefersReducedMotion() ? REDUCED_LEAVE_MS : LEAVE_MS)
}

function spring() {
  springing.value = true
  offset.value = 0
}

// A long press or a swipe on a phone is not a tick; a tap is.
function onClick() {
  if (consumed) {
    consumed = false
    return
  }
  if (!props.entry.ticked) {
    pulsing.value = true
    clearTimeout(pulseTimer)
    pulseTimer = setTimeout(() => (pulsing.value = false), PULSE_MS)
  }
  emit('tick')
}

// On a phone a long press would bring up the system's menu: it is the line's.
function onContextMenu(event: Event) {
  if (press) event.preventDefault()
}

// ---- Keys, on a desktop, with the row focused ----

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    // Enter changes the line, not ticks it: the button's own click is cancelled.
    event.preventDefault()
    emit('edit')
  }
  else if (event.key === 'Delete') {
    event.preventDefault()
    emit('remove')
  }
  else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    const rows = [...(row.value?.closest('.shopping-list') ?? document).querySelectorAll<HTMLElement>('[data-shopping-tick]')]
    const at = rows.indexOf(row.value!)
    rows[event.key === 'ArrowUp' ? at - 1 : at + 1]?.focus()
  }
}

// The edit field empties the line: it goes, and the list stops changing it.
function removeWhileEditing() {
  emit('cancel')
  emit('remove')
}

onBeforeUnmount(() => {
  clearTimeout(pulseTimer)
  clearTimeout(holdTimer)
  clearTimeout(leaveTimer)
})
</script>

<template>
  <li
    class="line group relative flex items-stretch rounded-[14px]"
    :class="{ ticked: entry.ticked }"
    :data-shopping-item="entry.id"
    :data-ticked="entry.ticked || undefined"
  >
    <Transition
      name="swap"
      mode="out-in"
    >
      <ShoppingItemInput
        v-if="editing"
        key="edit"
        variant="edit"
        :text="entry.text"
        @save="text => emit('save', text)"
        @cancel="emit('cancel')"
        @remove="removeWhileEditing"
      />
      <div
        v-else
        key="row"
        class="relative flex min-w-0 flex-1 items-center gap-1 overflow-hidden rounded-[14px]"
      >
        <div
          class="absolute inset-0 flex items-center justify-end gap-2 bg-swipe-danger pr-4 text-on-swipe-danger"
          :style="{ opacity: dangerShown }"
          aria-hidden="true"
        >
          <AppIcon
            name="trash"
            :size="18"
          />
          <span class="text-[15px] font-medium">{{ t.shopping.removeAction }}</span>
        </div>
        <button
          ref="row"
          type="button"
          role="checkbox"
          :aria-checked="entry.ticked"
          :aria-label="t.shopping.item(entry.text, groupName, entry.ticked)"
          class="row relative flex min-h-shop-row min-w-0 flex-1 items-start gap-3 rounded-[14px] bg-surface py-4 pr-3 pl-2.5 text-left touch-pan-y select-none transition-[scale,background-color] duration-tap ease-tap [-webkit-touch-callout:none] outline-offset-[-2px] active:scale-[.98] motion-reduce:active:scale-100 desktop:min-h-shop-row-desktop desktop:px-2.5 desktop:py-3.5 desktop:hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus"
          :class="{ pulsing, 'row-leaving': leaving, 'row-springing': springing }"
          :style="{ transform: rowTransform }"
          data-shopping-tick
          @click="onClick"
          @keydown="onKeydown"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerCancel"
          @contextmenu="onContextMenu"
        >
          <span
            class="box -mt-0.5 flex h-shop-check w-shop-check shrink-0 items-center justify-center rounded-blob border-2 desktop:-mt-[3px]"
            :class="entry.ticked ? 'border-transparent bg-tick text-tick-ink' : 'border-line-strong'"
            aria-hidden="true"
          >
            <svg
              v-if="entry.ticked"
              class="check"
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="3.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path
              pathLength="20"
              d="M5 12.5l4.5 4.5L19 7.5"
            /></svg>
          </span>
          <span class="min-w-0 flex-1 break-words text-[17px] font-medium leading-6 desktop:text-[16px] desktop:leading-[22px]">
            <span
              class="text"
              :class="{ 'is-ticked': entry.ticked }"
            >{{ entry.text }}</span>
            <span
              v-if="entry.unsent"
              class="mt-0.5 flex items-center gap-1 text-[12.5px] font-medium text-text-muted"
              data-unsent
            >
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                class="shrink-0"
              ><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z" /></svg>
              {{ t.unsent.notSent }}
            </span>
          </span>
        </button>
        <!-- On a phone these two are the accessibility actions only (visually hidden); on a desktop they show on hover and focus. -->
        <button
          type="button"
          class="sr-only flex shrink-0 items-center justify-center rounded-full text-text-muted transition-[opacity,scale] duration-tap ease-tap active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-focus desktop:not-sr-only desktop:h-[34px] desktop:w-[34px] desktop:opacity-0 desktop:group-focus-within:opacity-100 desktop:group-hover:opacity-100"
          :aria-label="t.shopping.edit(entry.text)"
          data-shopping-change
          @click="emit('edit')"
        >
          <AppIcon
            name="pencil"
            :size="18"
          />
        </button>
        <button
          type="button"
          class="sr-only flex shrink-0 items-center justify-center rounded-full text-swipe-danger transition-[opacity,scale] duration-tap ease-tap active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-focus desktop:not-sr-only desktop:h-[34px] desktop:w-[34px] desktop:opacity-0 desktop:group-focus-within:opacity-100 desktop:group-hover:opacity-100"
          :aria-label="t.shopping.remove(entry.text)"
          data-shopping-remove
          @click="emit('remove')"
        >
          <AppIcon
            name="trash"
            :size="18"
          />
        </button>
      </div>
    </Transition>
  </li>
</template>

<style scoped>
/* The separator: a 1px line above every row but the first, from the pebble's
   column to 12px short of the right edge. */
.line:not(:first-child)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50px;
  right: 12px;
  height: 1px;
  z-index: 1;
  background: var(--color-line);
}

/* The pebble: it fills in sage over 180ms; on a tick it pops (r15-check) and
   its check draws (r14-draw, with the path's 20-unit length). */
.box {
  transition: background-color 180ms ease, border-color 180ms ease;
}
.box .check path {
  stroke-dasharray: 20;
  stroke-dashoffset: 0;
}
.pulsing .box {
  animation: r15-check 380ms ease;
}
.pulsing .check path {
  animation: r14-draw 220ms ease-out 60ms both;
}

/* The strike: a background line, so it follows wrapped lines. It draws on a
   tick and shrinks back over 200ms on an untick. */
.text {
  background-image: linear-gradient(color-mix(in srgb, currentColor 56%, transparent), color-mix(in srgb, currentColor 56%, transparent));
  background-repeat: no-repeat;
  background-position: 0 55%;
  background-size: 0% 1.5px;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  transition: background-size 200ms ease, color 200ms ease;
}
.text.is-ticked {
  background-size: 100% 1.5px;
  color: var(--color-text-muted);
}
.pulsing .text {
  animation: r15-strike 260ms ease-out 80ms both;
}

/* A swipe: the row follows the finger; released it springs back (300ms) or
   leaves to the left (240ms ease-in). */
.row-springing {
  transition: transform 300ms var(--ease-settle);
}
.row-leaving {
  transition: transform 240ms ease-in;
}

/* The edit field crossfades with the row, 150ms. */
.swap-enter-active,
.swap-leave-active {
  transition: opacity 150ms ease;
}
.swap-enter-from,
.swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .box,
  .text,
  .row-springing {
    transition: none;
  }
  .row-leaving {
    transform: none !important;
    transition: opacity 200ms ease;
    opacity: 0;
  }
}
</style>
