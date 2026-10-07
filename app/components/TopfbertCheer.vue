<script setup lang="ts">
// The handoff's "gekocht-topfbert" (part of the Gekocht celebration),
// built from Topfbert's happy layers rather than a clip, as it sits over the
// live Board. Sitting in the Gekocht pill (GekochtPill), 58px wide, he pops
// up, overshoots, settles, wiggles and says one of his cheers ("Mmh!",
// "Lecker!", …) in a bubble beside him; then he idles (TopfbertIdle) while
// the pill stays. Reduced motion: his still, with the bubble.

// What he says: one of his cheers, picked with the Gekocht pill (utils/cheer).
defineProps<{ cheer: string }>()
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none flex items-start"
    data-topfbert
  >
    <!-- The pill is in the top layer, over any modal. -->
    <TopfbertIdle
      mood="happy"
      on-top
      class="cheer w-[58px] shrink-0"
    />
    <!-- Beside him, from 61% of his width (where "Mmh!" always started),
         over his side but not his face; one line. Laid out with him, so a
         longer cheer makes room for itself and pushes what follows him in
         the pill along. -->
    <span
      class="bubble relative -ml-[23px] mt-1 whitespace-nowrap rounded-pill bg-surface px-2.5 py-1 font-display text-title-s text-text shadow-card"
      data-cheer
    >
      {{ cheer }}
    </span>
  </div>
</template>

<style scoped>
/* remotion-briefs.json → gekocht-topfbert, 36 frames at 30fps (1.2s): from
   below his place at .6, up past it at 1.06 (f8), settle (f12),
   wiggle −4° / +3° (f18), his cheer pops (f20), hold. He comes 100ms after the
   pill (which waits --dur-toast-delay). Pivot: the bottom of his pot. */
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
</style>
