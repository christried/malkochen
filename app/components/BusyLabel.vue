<script setup lang="ts">
// A saving button's label (handoff components.json: Button "loading (3
// dots)"). While the button's work runs, the three dots take the label's
// place. The label stays in the layout, unseen, so the button keeps its
// width, and the button's accessible name becomes `busyLabel`.
defineProps<{ label: string, busyLabel: string, busy: boolean }>()
</script>

<template>
  <span class="relative">
    <span :class="{ invisible: busy }">{{ label }}</span>
    <template v-if="busy">
      <span class="sr-only">{{ busyLabel }}</span>
      <span class="absolute inset-0 flex items-center justify-center">
        <LoadingDots />
      </span>
    </template>
  </span>
</template>
