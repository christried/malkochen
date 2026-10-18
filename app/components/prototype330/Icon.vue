<script setup lang="ts">
// PROTOTYPE #330: throwaway. The prototype's line icons, on AppIcon's grid.
withDefaults(defineProps<{ name: 'up' | 'down' | 'bubble' | 'send' | 'pot' | 'plus' | 'more' | 'trash', size?: number, filled?: boolean }>(), { size: 16 })
</script>

<template>
  <svg
    viewBox="0 0 24 24"
    :width="size"
    :height="size"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="2.2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="shrink-0"
    aria-hidden="true"
  >
    <template v-if="name === 'up'">
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" />
      <path d="M7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18.1 21H7" />
    </template>
    <template v-else-if="name === 'down'">
      <path d="M17 14V3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1z" />
      <path d="M17 14l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 5.9 3H17" />
    </template>
    <path
      v-else-if="name === 'bubble'"
      d="M20 12.5a7.5 7 0 0 1-10.8 6.3L4 20l1.3-4.2A7 7 0 0 1 4.5 12.5 7.75 7 0 0 1 20 12.5z"
    />
    <template v-else-if="name === 'send'">
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </template>
    <template v-else-if="name === 'pot'">
      <path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
      <path d="M2 10h20M9 6c0-1 1-1.5 1-2.5M14 6c0-1 1-1.5 1-2.5" />
    </template>
    <path
      v-else-if="name === 'plus'"
      d="M12 5v14M5 12h14"
    />
    <template v-else-if="name === 'more'">
      <circle
        cx="5"
        cy="12"
        r="1.4"
      />
      <circle
        cx="12"
        cy="12"
        r="1.4"
      />
      <circle
        cx="19"
        cy="12"
        r="1.4"
      />
    </template>
    <path
      v-else-if="name === 'trash'"
      d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"
    />
  </svg>
</template>
