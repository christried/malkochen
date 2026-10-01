<script setup lang="ts">
// The layout of the Offline and error screens: an illustration on a blob,
// a headline, a line of text and an action. Stills for now; their loops come
// with the motion clips (#23).
defineProps<{
  headline: string
  body: string
  headlineId?: string
}>()
</script>

<template>
  <div class="flex min-h-dvh flex-col items-center justify-center bg-bg px-6 py-10 text-center text-text">
    <div class="relative aspect-[11/10] w-[min(72vw,300px)]">
      <slot name="illustration" />
    </div>
    <h1
      :id="headlineId"
      class="mt-6 font-display text-title-l tablet:text-display-m"
    >
      {{ headline }}
    </h1>
    <p class="mt-2 max-w-[360px] text-body text-text-muted">
      {{ body }}
    </p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <slot name="actions" />
    </div>
  </div>
</template>
