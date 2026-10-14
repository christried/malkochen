<script setup lang="ts">
// A Board with no Dishes: the handoff's "empty-board" clip (Topfbert with
// veggies hopping out of his pot), on a blob in the lane's own colour
// (LaneBlob), looping while `play` asks: it is the Board's one loop when
// nothing else plays (useBoardLoop). Drawn in code (SvgLoop), its still is
// the loop's frame 0. No background of its own: it sits on the first
// Column's (#180).
defineProps<{ play: boolean }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center px-2 py-6 text-center"
    data-empty="board"
  >
    <div class="relative aspect-[660/588] w-[min(70vw,240px)]">
      <LaneBlob
        view-box="0 0 220 196"
        path="M106.13 11.76A100.67 86.24 0 0 1 206.8 98A89.06 86.24 0 0 1 117.74 184.24A104.54 77.62 0 0 1 13.2 106.62A92.93 94.86 0 0 1 106.13 11.76Z"
      />
      <SvgLoop
        src="/clips/empty-board"
        :play="play"
        transparent
      />
    </div>
    <p class="mt-5 font-display text-title-m">
      {{ t.board.emptyBoardTitle }}
    </p>
    <p class="mt-1 text-body text-text-muted">
      {{ t.board.emptyBoardBody }}
    </p>
  </div>
</template>
