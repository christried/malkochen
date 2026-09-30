<script setup lang="ts">
// A round icon button, 44px: a thumb-sized tap target. Name it with aria-label.
</script>

<template>
  <button
    type="button"
    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
  >
    <slot />
  </button>
</template>
