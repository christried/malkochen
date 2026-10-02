<script setup lang="ts">
// The line icons buttons share: a 24-unit grid, drawn in the text colour.
withDefaults(defineProps<{ name: 'search' | 'close' | 'settings' | 'back' | 'up' | 'down' | 'grip' | 'check', size?: number }>(), { size: 18 })
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
    stroke-linejoin="round"
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
    <template v-else-if="name === 'settings'">
      <circle
        cx="12"
        cy="12"
        r="3"
      />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
    </template>
    <path
      v-else-if="name === 'back'"
      d="M15 6l-6 6 6 6"
    />
    <path
      v-else-if="name === 'up'"
      d="M6 15l6-6 6 6"
    />
    <path
      v-else-if="name === 'down'"
      d="M6 9l6 6 6-6"
    />
    <path
      v-else-if="name === 'check'"
      d="M5 12.5l4.5 4.5L19 7.5"
    />
    <path
      v-else-if="name === 'grip'"
      d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"
      stroke-width="3.5"
    />
    <path
      v-else
      d="M6 6l12 12M18 6L6 18"
    />
  </svg>
</template>
