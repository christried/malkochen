<script setup lang="ts">
// Topfbert wherever he stands about (handoff README §7 "Topfbert idle",
// topfbert/layers.json → idle): he breathes, blinks (now and then twice),
// sways his hat and, but for oops, steams, in a 6s loop drawn in code from
// his layers (public/clips/topfbert-idle-<mood>.svg). Every Topfbert on
// screen keeps the page's clock, so none blinks out of step with another.
// He pauses when less than half of him is on screen, and stands still while
// the modal he's in has another over it. Reduced motion: his still.
//
// None of the places he appears draws him below 48px, where the handoff
// would leave out the steam and the hat.
const props = defineProps<{
  mood: 'happy' | 'wow' | 'oops'
  // Drawn above every modal (the Gekocht pill): none ever covers him.
  onTop?: boolean
}>()
const covered = useCoveredByModal()
const play = computed(() => props.onTop || !covered.value)
</script>

<template>
  <!-- His drawing's shape (viewBox 140×150); the caller sets his width. -->
  <div
    class="aspect-[140/150]"
    data-topfbert-idle
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
