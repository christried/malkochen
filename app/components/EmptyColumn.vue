<script setup lang="ts">
// A Column with no Dishes: the handoff's "empty-column" clip, a pea rolling
// in a dashed bowl, looping while `play` asks: the Board loops one empty
// state, whatever its cards play (useBoardLoop).
defineProps<{ play: boolean }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center py-6 text-center text-text-muted"
    data-empty="column"
  >
    <div class="aspect-[19/15] w-[min(50vw,150px)]">
      <MotionClip
        src="/clips/empty-column"
        :play="play"
      />
    </div>
    <p class="mt-3 text-small">
      {{ t.board.emptyColumn }}
    </p>
  </div>
</template>
