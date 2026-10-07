<script setup lang="ts">
import type { ColumnAccent } from '~/utils/columns'
import type { EmptyColumnIllustration } from '~/utils/empty-column'

// A Column with no Dishes: one of the handoff's three empty-Column clips
// (Round 11), the Board's pick for this Column (utils/empty-column.ts): a pea
// rolling in a bowl, Knobi the garlic rocking in it, or Schoti the chili
// hopping, on a blob in the Column's accent. It loops while `play` asks: the
// Board loops one empty state, whatever its cards play (useBoardLoop). Drawn
// in code (SvgLoop), its still is the loop's frame 0, so it starts from
// where it rests. No background of its own: it sits on the Column's.
defineProps<{ play: boolean, accent: ColumnAccent, illustration: EmptyColumnIllustration }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center py-6 text-center text-text-muted"
    data-empty="column"
  >
    <div class="aspect-[19/15] w-[min(50vw,150px)]">
      <SvgLoop
        :src="`/clips/${illustration}-${accent}`"
        :play="play"
        transparent
      />
    </div>
    <p class="mt-3 text-small">
      {{ t.board.emptyColumn }}
    </p>
  </div>
</template>
