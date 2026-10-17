<script setup lang="ts">
import type { TourButton, TourStep } from '~/tour/tour'
import { RING, type TourPlacement } from '~/utils/tour-placement'

// One Tour step as TourLayer draws it (handoff R12 "Placement"): the dimming
// with its hole round the target, ringed in butter once the hole has settled
// there (`ringDrawn`, from TourLayer); the bubble beside it,
// with Topfbert standing on its edge. Where everything goes comes from
// TourLayer (`placement`; null until it's measured). A step the user acts
// on (`press`, from a modal layer the page behind is inert to) has a button
// over the hole that passes the tap on to the target.
const props = defineProps<{
  step: TourStep
  placement: TourPlacement | null
  ringDrawn: boolean
  titleId: string
  textId: string
  press: { label: string } | null
}>()
const emit = defineEmits<{ choose: [button: TourButton], press: [] }>()
const t = useStrings()

// Where the hole is: the dimming's and the button over it.
const holeStyle = computed(() => {
  const hole = props.placement?.hole
  return hole ? { left: `${hole.left}px`, top: `${hole.top}px`, width: `${hole.width}px`, height: `${hole.height}px`, borderRadius: `${hole.radius}px` } : undefined
})

// Weiter, or Fertig on the last step, or Installieren there instead.
const forward = computed(() => props.step.buttons.find(b => b === 'next' || b === 'finish' || b === 'install'))

const bubble = useTemplateRef<HTMLElement>('bubble')
const spot = useTemplateRef<HTMLElement>('spot')
defineExpose({ bubble, spot })
</script>

<template>
  <!-- The dimming: a hole's shadow over everything else. Without a target,
       the hole closes in the middle of the screen. The ring goes round the
       hole, outside it, and moves with it. -->
  <div
    ref="spot"
    class="spot"
    :class="{ 'no-target': !placement?.hole }"
    :style="holeStyle"
    aria-hidden="true"
    data-tour-spot
  >
    <svg
      v-if="placement?.hole"
      class="ring"
      :class="{ drawn: ringDrawn }"
      :data-tour-ring="ringDrawn ? 'drawn' : 'hidden'"
    >
      <rect
        pathLength="1"
        :style="{ rx: `${placement.hole.radius + RING / 2}px` }"
      />
    </svg>
  </div>
  <button
    v-if="press && placement?.hole"
    type="button"
    class="press"
    :style="holeStyle"
    :aria-label="press.label"
    data-tour-press
    @click="emit('press')"
  />
  <div
    ref="bubble"
    :key="step.id"
    class="bubble"
    :class="{ placed: placement, 'topfbert-left': placement && !placement.topfbert.mirrored }"
    :style="placement ? { left: `${placement.bubble.left}px`, top: `${placement.bubble.top}px` } : undefined"
    tabindex="-1"
    role="group"
    :aria-labelledby="titleId"
    :aria-describedby="textId"
    :data-tour-step="step.id"
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
      {{ step.title }}
    </h2>
    <p
      :id="textId"
      class="mt-1.5 text-[15px] font-medium leading-[1.4] text-text-muted"
    >
      {{ step.text }}
    </p>
    <div class="mt-3 flex flex-wrap items-center gap-0.5">
      <button
        v-if="step.buttons.includes('skip')"
        type="button"
        class="rounded-pill py-2 pr-2 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
        @click="emit('choose', 'skip')"
      >
        {{ t.tour.skip }}
      </button>
      <!-- Kept together: short of room, they move under "Überspringen". -->
      <div class="ml-auto flex items-center gap-0.5">
        <button
          v-if="step.buttons.includes('back')"
          type="button"
          class="rounded-pill px-2.5 py-2 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="emit('choose', 'back')"
        >
          {{ t.tour.back }}
        </button>
        <!-- A step to do has no Weiter: going past it is the quiet way on. -->
        <button
          v-if="step.buttons.includes('withoutDish')"
          type="button"
          class="rounded-pill px-2.5 py-2 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="emit('choose', 'withoutDish')"
        >
          {{ t.tour.withoutDish }}
        </button>
        <button
          v-if="step.buttons.includes('keep')"
          type="button"
          class="rounded-pill px-2.5 py-2 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          @click="emit('choose', 'keep')"
        >
          {{ t.tour.keep }}
        </button>
        <button
          v-if="forward"
          type="button"
          class="rounded-pill bg-inverse px-4 py-2 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          @click="emit('choose', forward)"
        >
          {{ forward === 'install' ? t.tour.installButton : t.tour[forward] }}
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
      :mood="step.pose"
      :mirrored="placement.topfbert.mirrored"
    />
  </div>
</template>

<style scoped>
/* The hole, with the scrim as its shadow. */
.spot {
  position: absolute;
  box-shadow: 0 0 0 200vmax var(--color-scrim);
  pointer-events: none;
}
.spot.no-target {
  left: 50%;
  top: 50%;
  width: 0;
  height: 0;
}
/* The butter ring (3px) just outside the hole: hidden until it's drawn. */
.ring {
  position: absolute;
  left: -3px;
  top: -3px;
  width: calc(100% + 6px);
  height: calc(100% + 6px);
  overflow: visible;
  fill: none;
  stroke: var(--color-butter);
  stroke-width: 3px;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  opacity: 0;
}
.ring rect {
  x: 1.5px;
  y: 1.5px;
  width: calc(100% - 3px);
  height: calc(100% - 3px);
}
.ring.drawn {
  stroke-dashoffset: 0;
  opacity: 1;
}
/* Over the hole, see-through; focused by keyboard, it wears the focus ring
   inside the butter one. */
.press {
  position: absolute;
  background: transparent;
  outline: none;
}
.press:focus-visible {
  box-shadow: inset 0 0 0 2px var(--color-focus);
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
/* With motion: the hole glides from target to target, and each bubble
   rises in where it goes. The ring fades as the hole leaves, and once it
   has settled, draws itself round it: longer than the glide, calmly. */
@media (prefers-reduced-motion: no-preference) {
  .spot {
    transition: left var(--dur-settle) var(--ease-settle), top var(--dur-settle) var(--ease-settle), width var(--dur-settle) var(--ease-settle), height var(--dur-settle) var(--ease-settle), border-radius var(--dur-settle) var(--ease-settle);
  }
  .ring {
    transition: opacity var(--dur-fade) var(--ease-fade), stroke-dashoffset 0s var(--dur-fade);
  }
  .ring.drawn {
    transition: stroke-dashoffset 700ms var(--ease-swoosh);
  }
  .bubble.placed {
    animation: bubble-in var(--dur-settle) var(--ease-settle);
  }
}
@keyframes bubble-in {
  from {
    opacity: 0;
    translate: 0 8px;
  }
}
</style>
