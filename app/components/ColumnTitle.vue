<script setup lang="ts">
// A Column's name (the slot) and its Column Subtitle, at the top of its lane
// (handoff ColumnTabs "lane header"): from 768px the name large and the
// subtitle in italic below it, sized so "Diese Woche" fits a 330px lane.
// Phones keep the name small and leave the subtitle out. Both are in the
// display font through its token, so changing the font is a token change.
defineProps<{ subtitle: string | null }>()
</script>

<template>
  <hgroup class="title px-1">
    <h2 class="text-title-s tablet:text-display-l">
      <slot />
    </h2>
    <p
      v-if="subtitle"
      class="mt-1 hidden text-subline italic text-text-muted tablet:block"
      data-column-subtitle
    >
      {{ subtitle }}
    </p>
  </hgroup>
</template>

<style scoped>
.title {
  font-family: var(--font-display);
}
</style>
