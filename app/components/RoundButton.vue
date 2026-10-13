<script setup lang="ts">
// A round icon button, 44px: a thumb-sized tap target. Name it with aria-label.
// `raised`: on surface with the card's shadow, as in the Board's header,
// beside the Board switcher's pill; otherwise on surface-muted.
defineProps<{ raised?: boolean }>()
</script>

<template>
  <button
    type="button"
    class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
    :class="raised ? 'bg-surface shadow-card' : 'bg-surface-muted'"
  >
    <slot />
  </button>
</template>
