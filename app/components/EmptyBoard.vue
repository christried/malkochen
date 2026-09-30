<script setup lang="ts">
// A Board with no Dishes at all: the still of the handoff's "empty-board" clip
// (Topfbert with veggies resting on the rim, on a butter blob). The loop comes
// with the motion clips (#23).
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center px-2 py-6 text-center"
    data-empty="board"
  >
    <div class="relative aspect-[10/9] w-[min(70vw,240px)]">
      <div class="absolute inset-[6%] rounded-blob bg-[color-mix(in_oklch,var(--color-butter)_24%,var(--color-bg))]" />
      <img
        src="/illustrations/topfbert-happy.svg"
        alt=""
        class="absolute bottom-[4%] left-1/2 w-[62%] -translate-x-1/2"
      >
      <img
        src="/illustrations/veggie-carrot.svg"
        alt=""
        class="absolute left-[14%] top-[18%] w-[18%] -rotate-12"
      >
      <img
        src="/illustrations/veggie-pea.svg"
        alt=""
        class="absolute right-[14%] top-[12%] w-[14%]"
      >
      <img
        src="/illustrations/veggie-pepper.svg"
        alt=""
        class="absolute right-[6%] top-[42%] w-[16%] rotate-12"
      >
    </div>
    <p class="mt-5 font-display text-title-m">
      {{ t.board.emptyBoardTitle }}
    </p>
    <p class="mt-1 text-body text-text-muted">
      {{ t.board.emptyBoardBody }}
    </p>
  </div>
</template>
