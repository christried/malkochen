<script setup lang="ts">
// The handoff's "gekocht-topfbert" (part of the Gekocht celebration),
// built from Topfbert's happy layers rather than a clip, as it sits over the
// live Board. He pops up from behind the Gekocht toast, overshoots, settles,
// wiggles and says one of his cheers ("Mmh!", "Lecker!", …); then he idles
// (steam, hat, a blink) while the toast stays. Reduced motion: his still,
// with the bubble.

// The layers (assets/topfbert/layers.json → happy), back to front, and how
// each one idles.
const LAYERS = ['01-steam_1', '02-steam_2', '03-handles', '04-body', '05-eyes', '06-cheeks', '07-mouth', '08-rim', '09-hat'] as const
// What he says: one of his cheers, picked with the Gekocht toast (utils/cheer).
defineProps<{ cheer: string }>()
const still = prefersReducedMotion()
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none"
    data-topfbert
  >
    <div class="cheer relative aspect-[140/150] w-full">
      <img
        v-if="still"
        src="/illustrations/topfbert-happy.svg"
        alt=""
        class="absolute inset-0 h-full w-full"
      >
      <img
        v-for="layer in (still ? [] : LAYERS)"
        :key="layer"
        :src="`/illustrations/topfbert-happy/${layer}.svg`"
        alt=""
        class="absolute inset-0 h-full w-full"
        :class="`layer-${layer.slice(3)}`"
      >
      <!-- Anchored on its left, where "Mmh!" always started (61% of his
           width), so a longer cheer grows to the right over the toast
           rather than over his face; one line. -->
      <span
        class="bubble absolute left-[61%] top-1 whitespace-nowrap rounded-pill bg-surface px-2.5 py-1 font-display text-title-s text-text shadow-card"
        data-cheer
      >
        {{ cheer }}
      </span>
    </div>
  </div>
</template>

<style scoped>
/* remotion-briefs.json → gekocht-topfbert, 36 frames at 30fps (1.2s): from
   below the toast at .6, up past his place at 1.06 (f8), settle (f12),
   wiggle −4° / +3° (f18), his cheer pops (f20), hold. He comes 100ms after the
   toast (which waits --dur-toast-delay). Pivot: the bottom of his pot. */
.cheer {
  transform-origin: 50% 100%;
  animation: cheer-pop 1200ms var(--ease-settle) calc(var(--dur-toast-delay) + 100ms) both;
}
@keyframes cheer-pop {
  0% { translate: 0 46px; scale: .6; rotate: 0deg; }
  22% { translate: 0 -10px; scale: 1.06; }
  33% { translate: 0 0; scale: 1; rotate: 0deg; }
  45% { rotate: -4deg; }
  52% { rotate: 3deg; }
  60%, 100% { translate: 0 0; scale: 1; rotate: 0deg; }
}
.bubble {
  transform-origin: 0% 100%;
  rotate: 6deg;
  animation: bubble-pop var(--dur-pop) var(--ease-pop) calc(var(--dur-toast-delay) + 767ms) both;
}
@keyframes bubble-pop {
  from { scale: 0; rotate: -10deg; }
}
/* Idle (layers.json → happy). Steam rises and fades, the second puff .9s
   behind; the hat (authored upright, worn at −14°) bobs; he blinks every 4s. */
.layer-steam_1,
.layer-steam_2 {
  opacity: 0;
  animation: steam 2.2s ease-out infinite;
}
.layer-steam_2 {
  animation-delay: .9s;
}
@keyframes steam {
  0% { opacity: 0; translate: 0 6px; scale: 1 .8; }
  40% { opacity: .8; }
  100% { opacity: 0; translate: 0 -14px; scale: 1 1.1; }
}
.layer-hat {
  transform-origin: 25.7% 44%;
  rotate: -14deg;
  animation: hat 3s var(--ease-idle) infinite alternate;
}
@keyframes hat {
  to { rotate: -9deg; translate: 0 -2px; }
}
.layer-eyes {
  transform-origin: 50% 62%;
  animation: blink 4s linear infinite;
}
@keyframes blink {
  0%, 92%, 100% { scale: 1 1; }
  96% { scale: 1 .1; }
}
</style>
