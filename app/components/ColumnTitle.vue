<script setup lang="ts">
// A Column's name (the slot) and its Column Subtitle (handoff ColumnTabs
// "lane header"): the name large and the subtitle in italic below it. At the
// top of a lane (from 768px), sized so "Diese Woche" fits a 330px lane; on
// phones in the Board's headline above the tabs (ColumnHeadline), larger
// still. A Column without a subtitle keeps its line, so the lanes' Dishes
// line up, and a long name breaks rather than leaving its place. Both are in
// the display font through its token, so changing the font is a token
// change. The Gekocht Column's subtitle is fixed and not stored with the
// Board: it is shown in the viewer's language (#328).
const props = defineProps<{ subtitle: string | null, gekocht?: boolean }>()
const t = useStrings()
const shown = computed(() => props.gekocht ? t.board.gekochtSubtitle : props.subtitle)
</script>

<template>
  <hgroup class="title px-1">
    <h2 class="text-display-l">
      <slot />
    </h2>
    <p
      class="mt-1 min-h-[1lh] text-subline italic text-text-muted"
      :aria-hidden="shown ? undefined : 'true'"
      :data-column-subtitle="shown ? '' : undefined"
    >
      {{ shown }}
    </p>
  </hgroup>
</template>

<style scoped>
.title {
  font-family: var(--font-display);
  overflow-wrap: anywhere;
}
</style>
