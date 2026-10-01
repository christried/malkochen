<script setup lang="ts">
// A Board with no Dishes: the handoff's "empty-board" clip (Topfbert with
// veggies hopping out of his pot, on a butter blob), looping while `play`
// asks: it is the Board's one loop when nothing else plays (useBoardLoop).
defineProps<{ play: boolean }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center px-2 py-6 text-center"
    data-empty="board"
  >
    <div class="aspect-[660/588] w-[min(70vw,240px)]">
      <MotionClip
        src="/clips/empty-board"
        :play="play"
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
