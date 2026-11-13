<script setup lang="ts">
// The line icons buttons share: a 24-unit grid, drawn in the text colour.
withDefaults(defineProps<{ name: 'search' | 'close' | 'settings' | 'back' | 'up' | 'down' | 'grip' | 'check' | 'camera' | 'link' | 'copy' | 'sign-out' | 'plus' | 'play' | 'forward' | 'bag' | 'bag-plus' | 'trash' | 'pencil', size?: number }>(), { size: 18 })
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
    <!-- A cogwheel. Rays around a circle looked like a sun, so like a theme switch. -->
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
      v-else-if="name === 'forward'"
      d="M9 6l6 6-6 6"
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
      v-else-if="name === 'plus'"
      d="M12 5v14M5 12h14"
    />
    <!-- A play triangle, filled: an outline alone reads thin at button size. -->
    <path
      v-else-if="name === 'play'"
      d="M8 5.5v13l10.5-6.5z"
      fill="currentColor"
    />
    <path
      v-else-if="name === 'grip'"
      d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"
      stroke-width="3.5"
    />
    <template v-else-if="name === 'camera'">
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2.5h6L16.5 7h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z" />
      <circle
        cx="12"
        cy="13"
        r="3.5"
      />
    </template>
    <path
      v-else-if="name === 'link'"
      d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
    />
    <!-- Two sheets, one behind the other. -->
    <path
      v-else-if="name === 'copy'"
      d="M10.5 8h7A2.5 2.5 0 0 1 20 10.5v7a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 8 17.5v-7A2.5 2.5 0 0 1 10.5 8zM4.5 15.5A2 2 0 0 1 4 14V6.5A2.5 2.5 0 0 1 6.5 4H14a2 2 0 0 1 1.5.5"
    />
    <!-- A door with an arrow leaving it. -->
    <path
      v-else-if="name === 'sign-out'"
      d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M15 16.5l4.5-4.5L15 7.5M19.5 12H9"
    />
    <!-- The Shopping List's bag (R15): the view switch's "Einkauf"; with a
         plus, what puts a Dish or a week on it. -->
    <path
      v-else-if="name === 'bag'"
      d="M5.5 8h13l-.9 11.1a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9zM9 8V6.5a3 3 0 0 1 6 0V8"
    />
    <path
      v-else-if="name === 'bag-plus'"
      d="M5.5 8h13l-.9 11.1a2 2 0 0 1-2 1.9H8.4a2 2 0 0 1-2-1.9zM9 8V6.5a3 3 0 0 1 6 0V8M12 11.5v6M9 14.5h6"
    />
    <path
      v-else-if="name === 'trash'"
      d="M4.5 7h15M10 4h4M6.5 7l.8 11.6a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7M10 11v5.5M14 11v5.5"
    />
    <path
      v-else-if="name === 'pencil'"
      d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"
    />
    <path
      v-else
      d="M6 6l12 12M18 6L6 18"
    />
  </svg>
</template>
