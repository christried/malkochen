<script setup lang="ts">
// The handoff's "veggie-confetti" (part of the Gekocht celebration): 14
// pieces, veggies and pebbles in the Column accents, burst up from `origin`,
// spin over the top of their arc and fall off the screen, once. Native CSS
// particles over the live UI, not a clip. Reduced motion: none at all.
const props = defineProps<{ origin: Point }>()
const emit = defineEmits<{ done: [] }>()

// remotion-briefs.json → veggie-confetti: 48 frames at 30fps.
const LIFE_MS = 1600
const VEGGIES = ['carrot', 'pea', 'pepper'] as const
const COUNT = 14

const between = (min: number, max: number) => min + Math.random() * (max - min)
// Launch dx ±90–170px, up 110–200px, then fall 140–300px below the start.
const pieces = prefersReducedMotion()
  ? []
  : Array.from({ length: COUNT }, (_, i) => ({
      veggie: i % 7 < 4 ? VEGGIES[i % VEGGIES.length] : null,
      style: {
        '--dx': `${(i % 2 ? 1 : -1) * between(90, 170)}px`,
        '--up': `${-between(110, 200)}px`,
        '--fall': `${between(140, 300)}px`,
        '--spin': `${(i % 2 ? 1 : -1) * between(180, 540)}deg`,
        '--accent': columnAccent(i),
      },
    }))

let timer: ReturnType<typeof setTimeout> | undefined
onMounted(() => {
  timer = setTimeout(() => emit('done'), pieces.length ? LIFE_MS : 0)
})
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none fixed inset-0 z-toast overflow-hidden"
    data-confetti
  >
    <span
      v-for="(piece, i) in pieces"
      :key="i"
      class="piece"
      :style="{ left: `${props.origin.x}px`, top: `${props.origin.y}px`, ...piece.style }"
      data-confetti-piece
    >
      <img
        v-if="piece.veggie"
        :src="`/illustrations/veggies/${piece.veggie}.svg`"
        alt=""
        class="arc h-7 w-7"
      >
      <span
        v-else
        class="arc pebble block h-2.5 w-3"
      />
    </span>
  </div>
</template>

<style scoped>
/* Two layers, so the sideways drift and the gravity arc ease apart: the
   piece drifts out (ease-out) while its inner part rises to the apex at a
   third of its life (ease-out) and falls (ease-in), fading at the end. */
.piece {
  position: absolute;
  margin: -14px 0 0 -14px;
  animation: confetti-drift 1600ms cubic-bezier(.2, .6, .4, 1) forwards;
}
.arc {
  animation: confetti-arc 1600ms forwards;
}
.pebble {
  margin: 9px 8px;
  border-radius: var(--radius-blob);
  background: var(--accent);
}
@keyframes confetti-drift {
  to { translate: var(--dx) 0; }
}
@keyframes confetti-arc {
  0% {
    translate: 0 0;
    rotate: 0deg;
    animation-timing-function: cubic-bezier(.2, .7, .4, 1);
  }
  33% {
    translate: 0 var(--up);
    animation-timing-function: cubic-bezier(.5, 0, .9, .5);
  }
  80% { opacity: 1; }
  100% {
    translate: 0 var(--fall);
    rotate: var(--spin);
    opacity: 0;
  }
}
</style>
