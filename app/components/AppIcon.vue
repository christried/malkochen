<script setup lang="ts">
// The line icons buttons share: a 24-unit grid, drawn in the text colour.
withDefaults(defineProps<{ name: 'search' | 'close', size?: number }>(), { size: 18 })
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    fill="none"
    stroke="currentColor"
    stroke-width="2.5"
    stroke-linecap="round"
    aria-hidden="true"
  >
    <template v-if="name === 'search'">
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
      />
      <path d="M15.5 15.5L20 20" />
    </template>
    <path
      v-else
      d="M6 6l12 12M18 6L6 18"
    />
  </svg>
</template>
