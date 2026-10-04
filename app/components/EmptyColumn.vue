<script setup lang="ts">
import type { ColumnAccent } from '~/utils/columns'

// A Column with no Dishes: the handoff's "empty-column" clip (Round 11), a
// pea rolling in a bowl on a blob in the Column's accent, looping while
// `play` asks: the Board loops one empty state, whatever its cards play
// (useBoardLoop). Drawn in code (SvgLoop), its still is the loop's frame 0:
// the pea rests in the middle and starts rolling from there. No background
// of its own: it sits on the Column's.
defineProps<{ play: boolean, accent: ColumnAccent }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center py-6 text-center text-text-muted"
    data-empty="column"
  >
    <div class="aspect-[19/15] w-[min(50vw,150px)]">
      <SvgLoop
        :src="`/clips/empty-column-${accent}`"
        :play="play"
        transparent
      />
    </div>
    <p class="mt-3 text-small">
      {{ t.board.emptyColumn }}
    </p>
  </div>
</template>
