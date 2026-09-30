<script setup lang="ts">
import type { Placeholder } from '~~/shared/placeholders'

// A Placeholder Image's still in the current theme. Both variants are in the
// page; main.css shows one. The hidden one is lazy, so it never downloads.
defineProps<{ placeholder: Placeholder }>()
</script>

<template>
  <img
    :src="`/placeholders/${placeholder}-light.svg`"
    alt=""
    class="only-light h-full w-full object-cover"
    data-theme-still="light"
    loading="lazy"
  >
  <img
    :src="`/placeholders/${placeholder}-dark.svg`"
    alt=""
    class="only-dark h-full w-full object-cover"
    data-theme-still="dark"
    loading="lazy"
  >
</template>
