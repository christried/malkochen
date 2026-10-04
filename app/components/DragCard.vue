<script setup lang="ts">
import type { DishDrag } from '~/composables/useDishDrag'
import type { ClipMotion } from '~/utils/motion'

// The dragged card, following the pointer above everything (useDishDrag).
// Its own component, so only it re-renders as the pointer moves: the Board
// re-rendering every frame would restart the other cards making room.
defineProps<{
  drag: DishDrag
  isNew: boolean
  motion: ClipMotion
}>()
</script>

<template>
  <div
    aria-hidden="true"
    class="drag-card pointer-events-none fixed left-0 top-0 z-drag"
    :class="[`is-${drag.phase}`, { 'near-tabs': drag.nearTabs }]"
    :style="{
      'translate': `${drag.x}px ${drag.y}px`,
      'width': `${drag.width}px`,
      '--grab-x': `${drag.grabX}px`,
      '--grab-y': `${drag.grabY}px`,
      '--width': `${drag.width}px`,
      '--tilt': `${drag.tilt}deg`,
    }"
    data-testid="drag-card"
  >
    <div class="drag-card-lift rounded-card">
      <DishCard
        :dish="drag.dish"
        :is-new="isNew"
        :motion="motion"
        seen
      />
    </div>
  </div>
</template>

<style scoped>
/* Dragging a Dish (handoff "Drag lift"). The card lifts under the pointer:
   it grows to 1.04, tilts (-2°, then with the pointer's sideways speed) and
   casts the lift shadow. Near the Column tabs it shrinks to half and hangs
   just below the finger, so the tabs stay visible. Letting go, it settles
   into its slot, upright, or on phones spins into a Column tab (--dur-drop-*
   in main.css). Reduced motion: no scale or tilt,
   an ink outline instead; it jumps into its slot, and fades into a tab. */
.drag-card {
  touch-action: none;
}
.drag-card-lift {
  transform-origin: var(--grab-x) var(--grab-y);
  scale: 1.04;
  rotate: var(--tilt);
  box-shadow: var(--shadow-lift);
  transition:
    rotate var(--dur-tap) var(--ease-tap),
    scale var(--dur-drop-shrink) var(--ease-settle),
    translate var(--dur-drop-shrink) var(--ease-settle),
    box-shadow var(--dur-lift) var(--ease-lift);
  animation: lift var(--dur-lift) var(--ease-lift);
}
.drag-card-lift :deep(article) {
  box-shadow: none;
}
.near-tabs .drag-card-lift {
  scale: .5;
  translate: calc((var(--grab-x) - var(--width) / 2) / 2) calc(var(--grab-y) / 2 + 24px);
}
.drag-card.is-settling {
  transition: translate var(--dur-drop-settle) var(--ease-settle);
}
.is-settling .drag-card-lift {
  scale: 1;
  rotate: 0deg;
  box-shadow: var(--shadow-card);
  transition-duration: var(--dur-drop-settle);
}
.drag-card.is-swallowing {
  transition: translate var(--dur-drop-swallow) var(--ease-swoosh);
}
.is-swallowing .drag-card-lift {
  scale: .05;
  rotate: -40deg;
  transition: scale var(--dur-drop-swallow) var(--ease-swoosh), rotate var(--dur-drop-swallow) var(--ease-swoosh);
}
@keyframes lift {
  from {
    scale: 1;
    rotate: 0deg;
    box-shadow: var(--shadow-card);
  }
}
@media (prefers-reduced-motion: reduce) {
  .drag-card-lift,
  .is-swallowing .drag-card-lift {
    scale: none;
    rotate: none;
    translate: none;
    outline: 2px solid var(--color-text);
    transition: none;
  }
  .near-tabs .drag-card-lift {
    scale: none;
    translate: 0 calc(var(--grab-y) + 24px);
  }
  .drag-card.is-settling,
  .drag-card.is-swallowing {
    transition: none;
  }
  .is-swallowing .drag-card-lift {
    opacity: 0;
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
}
</style>
