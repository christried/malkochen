<script setup lang="ts">
// A Column with no Dishes: the still of the handoff's "empty-column" clip, a
// pea resting in the middle of a dashed bowl. The loop comes with #23.
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center py-6 text-center text-text-muted"
    data-empty="column"
  >
    <div class="relative aspect-[19/15] w-[min(50vw,150px)]">
      <img
        src="/illustrations/pea.svg"
        alt=""
        class="absolute left-1/2 top-[8%] w-[34%] -translate-x-1/2"
      >
      <svg
        viewBox="0 0 120 80"
        class="absolute bottom-0 w-full"
        aria-hidden="true"
      >
        <path
          d="M10 22H110A50 50 0 0 1 10 22Z"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-dasharray="7 6"
          stroke-linecap="round"
        />
      </svg>
    </div>
    <p class="mt-3 text-small">
      {{ t.board.emptyColumn }}
    </p>
  </div>
</template>
