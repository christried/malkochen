<script setup lang="ts">
// The small "Staging" label on every page of Staging (#414): so the Operator
// always knows which app he is in. Fixed in a corner, above the content, and
// it never catches a tap. app.vue renders it only where the runtime flag says
// the app runs as Staging (nuxt.config.ts).
</script>

<template>
  <div
    class="pointer-events-none fixed left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-50 rounded-chip bg-surface-muted px-2 py-0.5 text-overline uppercase text-text-muted shadow-card"
  >
    Staging
  </div>
</template>
