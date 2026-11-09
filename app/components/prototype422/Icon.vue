<script setup lang="ts">
// PROTOTYPE #422: throwaway. Camera, gallery and microphone, in AppIcon's line style.
defineProps<{ name: 'camera' | 'image' | 'mic' }>()
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    width="18"
    height="18"
    fill="none"
    stroke="currentColor"
    stroke-width="2.3"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-if="name === 'camera'">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle
        cx="12"
        cy="13"
        r="3.5"
      />
    </template>
    <template v-else-if="name === 'image'">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
      />
      <path d="M4 16l5-5 4 4 2-2 5 5" />
      <circle
        cx="15.5"
        cy="9.5"
        r="1.5"
      />
    </template>
    <template v-else>
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
      />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </template>
  </svg>
</template>
