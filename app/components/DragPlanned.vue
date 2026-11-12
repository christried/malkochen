<script setup lang="ts">
import type { PlanDrag } from '~/composables/useWeekDrag'

// The dragged Planned Dish, following the pointer above everything
// (useWeekDrag). Its own component, so only it re-renders as the pointer
// moves.
defineProps<{ drag: PlanDrag, to: string, tall?: boolean }>()
</script>

<template>
  <div
    aria-hidden="true"
    class="drag-planned pointer-events-none fixed left-0 top-0 z-drag"
    :class="[`is-${drag.phase}`, { 'near-strip': drag.nearStrip }]"
    :style="{
      'translate': `${drag.x}px ${drag.y}px`,
      'width': `${drag.width}px`,
      '--grab-x': `${drag.grabX}px`,
      '--grab-y': `${drag.grabY}px`,
      '--width': `${drag.width}px`,
      '--tilt': `${drag.tilt}deg`,
    }"
    data-testid="drag-planned"
  >
    <div class="lift rounded-planned">
      <PlannedDish
        :entry="drag.entry"
        :to="to"
        :tall="tall"
        lifted
      />
    </div>
  </div>
</template>

<style scoped>
/* Dragging a Planned Dish (handoff "Drag a Planned Dish within a day"): it
   lifts as a Dish card does, to 1.04 with a tilt of -2° and then with the
   pointer's speed, casting the lift shadow. By the day strip it shrinks to
   .56 so the strip stays visible. Letting go it settles into its slot,
   upright. Reduced motion: no scale or tilt, an outline instead. */
.drag-planned {
  touch-action: none;
}
.lift {
  transform-origin: var(--grab-x) var(--grab-y);
  scale: 1.04;
  rotate: var(--tilt);
  box-shadow: var(--shadow-lift);
  transition:
    rotate var(--dur-tap) var(--ease-tap),
    scale 280ms var(--ease-settle),
    box-shadow var(--dur-lift) var(--ease-lift);
  animation: lift var(--dur-lift) var(--ease-lift);
}
.near-strip .lift {
  scale: .56;
}
.drag-planned.is-settling {
  transition: translate var(--dur-drop-settle) var(--ease-settle);
}
.is-settling .lift {
  scale: 1;
  rotate: 0deg;
  box-shadow: var(--shadow-small);
  transition-duration: var(--dur-drop-settle);
}
@keyframes lift {
  from {
    scale: 1;
    rotate: 0deg;
    box-shadow: var(--shadow-small);
  }
}
@media (prefers-reduced-motion: reduce) {
  .lift {
    scale: none;
    rotate: none;
    outline: 2px solid var(--color-text);
    transition: none;
  }
  .near-strip .lift {
    scale: none;
  }
  .drag-planned.is-settling {
    transition: none;
  }
}
</style>
