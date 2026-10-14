<script setup lang="ts">
// The soft blob an empty Column's picture sits on (EmptyColumn, EmptyBoard),
// filled with its lane's own colour, a little fuller toward the lane's
// accent (#215): it fits whatever lane it is in, the tinted lanes once every
// Column shows and the phone's plain ones, in light and dark, where a blob
// drawn into the picture in one fixed tint clashed with some of them.
// `--lane` is what the lane is filled with (main.css), `--accent` its
// accent. Drawn behind the picture, in the picture's own viewBox, so it lies
// exactly where the picture had it.
defineProps<{ viewBox: string, path: string }>()
</script>

<template>
  <svg
    class="absolute inset-0 h-full w-full"
    :viewBox="viewBox"
    aria-hidden="true"
  >
    <path
      class="blob"
      :d="path"
      data-blob
    />
  </svg>
</template>

<style scoped>
.blob {
  fill: color-mix(in oklab, var(--accent) 16%, var(--lane));
}
</style>
