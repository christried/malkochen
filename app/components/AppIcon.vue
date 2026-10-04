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
    <!-- A cogwheel: rays around a circle read as a sun, i.e. the theme. -->
    <template v-else-if="name === 'settings'">
      <circle
        cx="12"
        cy="12"
        r="3"
      />
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
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
