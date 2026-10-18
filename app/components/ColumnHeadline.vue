<script setup lang="ts">
// The phone Board's headline (handoff mockup; motion.json "Headline
// parallax"), above the Column tabs: the active Column's name large, with its
// Column Subtitle in italic below (ColumnTitle, as at the top of a lane).
// Every Column's title is in it, one over the other, so it is as high as the
// highest and nothing below jumps as the Column changes; only the active one
// shows. While the Board is swiped (`progress` is the Column index,
// fractional mid-swipe) each title drifts 70px per Column and has faded out
// 5/8 of the way; let go, they settle with the Board. A long name shrinks
// to fit its line, down to display-m, and then wraps. Reduced motion: no
// drift, the title cuts to the next Column's. From 768px every lane has
// its own title, and there is no headline.
const props = defineProps<{
  columns: { id: string, name: string, subtitle: string | null, isGekocht: boolean }[]
  active: number
  progress: number
  // True while a finger drags the Board: the titles follow without easing.
  following: boolean
}>()

function titleStyle(index: number, name: string) {
  const offset = index - props.progress
  return {
    '--title-x': `${offset * 70}px`,
    '--title-fade': Math.max(0, 1 - Math.abs(offset) * 1.6),
    // In letters, so an emoji counts once.
    '--name-length': Array.from(name).length,
  }
}
</script>

<template>
  <div
    class="headline"
    :class="{ following }"
    data-column-headline
  >
    <ColumnTitle
      v-for="(column, index) in columns"
      :key="column.id"
      :subtitle="column.subtitle"
      :gekocht="column.isGekocht"
      :class="{ active: index === active }"
      :style="titleStyle(index, column.name)"
      :aria-hidden="index === active ? undefined : 'true'"
    >
      {{ column.name }}
    </ColumnTitle>
  </div>
</template>

<style scoped>
/* The titles stack in one cell. Drifting off, they are clipped at the
   screen's edges (the headline runs across the page's gutters). The ones
   out of sight can't be pressed or selected through the one that shows. */
.headline {
  display: grid;
  container-type: inline-size;
  overflow-x: clip;
}
@media (min-width: 768px) {
  .headline {
    display: none;
  }
}
.headline > * {
  grid-area: 1 / 1;
  translate: var(--title-x) 0;
  opacity: var(--title-fade);
  transition: translate var(--dur-settle) var(--ease-settle), opacity var(--dur-settle) var(--ease-fade);
}
.headline > :not(.active) {
  pointer-events: none;
  user-select: none;
}
.headline.following > * {
  transition: none;
}
/* display-xl (54px) where the name fits a line at that size, smaller where
   it doesn't, down to display-m (32px); by its length, as a Petrona letter
   is at most about half as wide as it is high (0.45–0.52 across the default
   Column names, with the title's letter spacing). Long words break at their syllables (the page is German). */
.headline :deep(h2) {
  font-size: clamp(32px, (100cqi - .5rem) / (max(var(--name-length), 1) * .5), 54px);
  line-height: 1;
  letter-spacing: -.025em;
  hyphens: auto;
  text-wrap: balance;
}
@media (prefers-reduced-motion: reduce) {
  .headline > * {
    translate: none;
    opacity: 0;
    transition: none;
  }
  .headline > .active {
    opacity: 1;
  }
}
</style>
