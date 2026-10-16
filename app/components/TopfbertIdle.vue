<script setup lang="ts">
// Topfbert wherever he stands about (handoff README §7 "Topfbert idle",
// topfbert/layers.json → idle): he breathes, blinks (now and then twice),
// and, but for oops, sways his hat and steams, in a 6s loop drawn in code from
// his layers (public/clips/topfbert-idle-<mood>.svg). Every Topfbert on
// screen keeps the page's clock, so none blinks out of step with another.
// He pauses when less than half of him is on screen, and stands still while
// the modal he's in has another over it. Reduced motion: his still.
//
// The Tour's poses (layers.json → tour.poses) idle the same way, each with
// its own loop on top: waving waves, pointing nudges his arm towards what
// he points at, wink tips his hat. Pointing is drawn pointing right;
// `mirrored` flips him whole to point left (never single layers, so the
// pivots mirror along). Only his steam takes the theme's text colour.
//
// Below 48px wide he only breathes and blinks (loops.css).
const props = defineProps<{
  mood: 'happy' | 'wow' | 'oops' | 'waving' | 'pointing' | 'wink'
  mirrored?: boolean
  // Drawn above every modal (the Gekocht pill): one opening never stills him.
  ignoresModals?: boolean
}>()
const covered = useCoveredByModal()
const play = computed(() => props.ignoresModals || !covered.value)
</script>

<template>
  <!-- His drawing's shape (viewBox 140×150); the caller sets his width. -->
  <div
    class="aspect-[140/150]"
    :class="{ '-scale-x-100': mirrored }"
    data-topfbert-idle
    :data-mood="mood"
  >
    <SvgLoop
      :src="`/clips/topfbert-idle-${mood}`"
      :play="play"
      :themed="false"
      transparent
      sync
      :visible-share="0.5"
    >
      <img
        :src="`/illustrations/topfbert-${mood}.svg`"
        alt=""
        class="h-full w-full"
      >
    </SvgLoop>
  </div>
</template>
