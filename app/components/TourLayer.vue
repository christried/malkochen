<script setup lang="ts">
import type { TourButton, TourStep, TourTarget } from '~/tour/tour'
import { HOLE_PADDING, placeTour, type TourPlacement } from '~/utils/tour-placement'

// Draws the Tour's step (app/tour/tour.ts; handoff R12 "Placement"): the
// Board dimmed but for a hole round the step's target, ringed in butter,
// and the bubble beside it with Topfbert standing on its edge, placed by
// placeTour. A modal <dialog> in the top layer: the page behind is inert, so
// a tap anywhere but the bubble does nothing, Esc (and Android's back
// button, which closes a modal dialog) skips the Tour, and focus moves into
// the bubble on every step. → and ← go forwards and back. It follows its
// target on every frame, through resizing, rotation and scrolling. Reduced
// motion: nothing moves but Topfbert, who stands still in his pose.
const props = defineProps<{ step: TourStep | null }>()
const emit = defineEmits<{ choose: [button: TourButton] }>()
const t = useStrings()

const open = computed(() => !!props.step)
useModalStack(open)

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const bubble = useTemplateRef<HTMLElement>('bubble')
const titleId = useId()
const textId = useId()

// The step shown last, kept while the layer closes.
const shown = shallowRef<TourStep | null>(null)
watchEffect(() => {
  if (props.step) shown.value = props.step
})

watch(open, (isOpen) => {
  const el = dialog.value
  if (!el) return
  if (isOpen && !el.open) el.showModal()
  if (!isOpen && el.open) el.close()
}, { flush: 'post' })

// Where everything goes, measured again every frame while it's open; null
// until the step's target is laid out.
const placement = shallowRef<TourPlacement | null>(null)
let frame = 0
function follow() {
  frame = requestAnimationFrame(follow)
  const step = props.step
  const el = dialog.value
  if (!step || !el || !bubble.value) return
  const target = step.target ? targetBox(step.target) : null
  const next = step.target && !target
    ? null
    : placeTour({ viewport: { width: el.clientWidth, height: el.clientHeight }, target, bubbleHeight: bubble.value.offsetHeight })
  if (JSON.stringify(next) !== JSON.stringify(placement.value)) placement.value = next
}
watch(open, (isOpen) => {
  cancelAnimationFrame(frame)
  if (isOpen) frame = requestAnimationFrame(follow)
  else placement.value = null
}, { flush: 'post' })
onBeforeUnmount(() => cancelAnimationFrame(frame))

// Each step: its target scrolled into view and focus in the bubble, which
// screen readers then read out.
watch(() => props.step?.id, async (id) => {
  if (!id) return
  await nextTick()
  if (props.step?.target) targetElements(props.step.target)[0]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  bubble.value?.focus()
}, { flush: 'post' })

function choose(button: TourButton) {
  emit('choose', button)
}

// Weiter, or Fertig on the last step.
const forward = computed(() => shown.value?.buttons.find(b => b === 'next' || b === 'finish'))

function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowRight' && forward.value) {
    event.preventDefault()
    choose(forward.value)
  }
  else if (event.key === 'ArrowLeft' && props.step?.buttons.includes('back')) {
    event.preventDefault()
    choose('back')
  }
}

// Esc and the back button close the dialog: that skips the Tour.
function onClosed() {
  if (props.step) choose('skip')
}

const hole = computed(() => placement.value?.hole ?? null)
const holeRadius = computed(() => `${targetRadius.value + HOLE_PADDING}px`)
const targetRadius = ref(0)
watch(() => props.step?.target, (target) => {
  const el = target && targetElements(target)[0]
  targetRadius.value = el ? Number.parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 : 0
}, { flush: 'post' })

const label: Record<TourButton, () => string> = {
  back: () => t.tour.back,
  next: () => t.tour.next,
  finish: () => t.tour.finish,
  skip: () => t.tour.skip,
}
</script>

<script lang="ts">
// The elements a target names that are laid out (on phones the Columns'
// tabs, on larger screens their titles, for instance).
function targetElements(target: TourTarget): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)].filter(el => el.getClientRects().length > 0 && el.offsetWidth > 0)
}

// The box round all of them, in the window.
function targetBox(target: TourTarget) {
  const boxes = targetElements(target).map(el => el.getBoundingClientRect())
  if (!boxes.length) return null
  const left = Math.min(...boxes.map(b => b.left))
  const top = Math.min(...boxes.map(b => b.top))
  const right = Math.max(...boxes.map(b => b.right))
  const bottom = Math.max(...boxes.map(b => b.bottom))
  return { left, top, width: right - left, height: bottom - top }
}
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
    <template v-if="shown">
      <!-- The dimming: a hole's shadow over everything else. Without a
           target, the hole closes in the middle of the screen. -->
      <div
        class="spot"
        :class="{ 'no-target': !hole }"
        :style="hole
          ? { left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px`, height: `${hole.height}px`, borderRadius: holeRadius }
          : undefined"
        aria-hidden="true"
        data-tour-spot
      />
      <div
        ref="bubble"
        :key="shown.id"
        class="bubble"
        :class="{ placed: placement, 'topfbert-left': placement && !placement.topfbert.mirrored }"
        :style="placement ? { left: `${placement.bubble.left}px`, top: `${placement.bubble.top}px` } : undefined"
        tabindex="-1"
        role="group"
        :aria-labelledby="titleId"
        :aria-describedby="textId"
        :data-tour-step="shown.id"
      >
        <span
          v-if="placement?.tail"
          class="tail"
          :class="placement.tail.side"
          :style="{ left: `${placement.tail.x}px` }"
          aria-hidden="true"
        />
        <h2
          :id="titleId"
          class="font-display text-[21px] font-medium leading-[1.15]"
        >
          {{ shown.title }}
        </h2>
        <p
          :id="textId"
          class="mt-1.5 text-[15px] font-medium leading-[1.4] text-text-muted"
        >
          {{ shown.text }}
        </p>
        <div class="mt-3 flex flex-wrap items-center gap-0.5">
          <button
            v-if="shown.buttons.includes('skip')"
            type="button"
            class="rounded-pill py-2 pr-2 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
            @click="choose('skip')"
          >
            {{ label.skip() }}
          </button>
          <!-- Kept together: short of room, they move under "Überspringen". -->
          <div class="ml-auto flex items-center gap-0.5">
            <button
              v-if="shown.buttons.includes('back')"
              type="button"
              class="rounded-pill px-2.5 py-2 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
              @click="choose('back')"
            >
              {{ label.back() }}
            </button>
            <button
              v-if="forward"
              type="button"
              class="rounded-pill bg-inverse px-4 py-2 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              @click="choose(forward)"
            >
              {{ label[forward]() }}
            </button>
          </div>
        </div>
      </div>
      <div
        v-if="placement"
        class="topfbert"
        :style="{ left: `${placement.topfbert.left}px`, top: `${placement.topfbert.top}px` }"
        aria-hidden="true"
      >
        <TopfbertIdle
          :mood="shown.pose"
          :mirrored="placement.topfbert.mirrored"
        />
      </div>
    </template>
  </dialog>
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
/* The hole, ringed in butter (3px), with the scrim as its shadow. */
.spot {
  position: absolute;
  box-shadow: 0 0 0 3px var(--color-butter), 0 0 0 200vmax var(--color-scrim);
  pointer-events: none;
}
.spot.no-target {
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
  box-shadow: 0 0 0 3px transparent, 0 0 0 200vmax var(--color-scrim);
}
/* The handoff's bubble: padding 15 18 17, 24 on Topfbert's side. */
.bubble {
  position: absolute;
  width: min(320px, calc(100% - 78px));
  padding: 15px 24px 17px 18px;
  border-radius: 24px 22px 26px 22px;
  background: var(--color-tour-bubble);
  box-shadow: var(--shadow-dialog);
  outline: none;
  opacity: 0;
}
.bubble.placed {
  opacity: 1;
}
.bubble.topfbert-left {
  padding: 15px 18px 17px 24px;
}
.tail {
  position: absolute;
  width: 12px;
  height: 12px;
  margin-left: -6px;
  border-radius: 2px;
  background: inherit;
  rotate: 45deg;
}
.tail.top {
  top: -6px;
}
.tail.bottom {
  bottom: -6px;
}
/* Standing on the bubble, in front of it. */
.topfbert {
  position: absolute;
  width: 64px;
}
/* With motion: the layer fades in, the hole glides from target to target,
   and each bubble rises in where it goes. */
@media (prefers-reduced-motion: no-preference) {
  .tour[open] {
    animation: tour-in var(--dur-fade) var(--ease-fade);
  }
  .spot {
    transition: left var(--dur-settle) var(--ease-settle), top var(--dur-settle) var(--ease-settle), width var(--dur-settle) var(--ease-settle), height var(--dur-settle) var(--ease-settle), border-radius var(--dur-settle) var(--ease-settle), box-shadow var(--dur-fade) var(--ease-fade);
  }
  .bubble.placed {
    animation: bubble-in var(--dur-settle) var(--ease-settle);
  }
}
@keyframes tour-in {
  from { opacity: 0; }
}
@keyframes bubble-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
}
</style>
