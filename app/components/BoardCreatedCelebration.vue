<script setup lang="ts">
// The handoff's board-created celebration, right after "Neues Board" is
// saved (motion.json "Board created build-in"): its clip (a pebble pops in
// with a twist as pebble confetti bursts out), with the Board's emoji on the
// pebble, popping with it; then its Columns rise in one after another, with
// a light tick each, and the headline and "Los geht’s", which goes to the
// Board. Reduced motion: the still, and everything shown at once.
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ board: { emoji: string, name: string, columns: { id: string, name: string }[] } }>()
const t = useStrings()

let ticks: ReturnType<typeof setTimeout>[] = []
function stop() {
  ticks.forEach(clearTimeout)
  ticks = []
}
watch(open, (isOpen) => {
  stop()
  if (!isOpen) return
  // A light tick as each Column rises in.
  const first = motionMs('board-created-columns')
  const gap = motionMs('board-created-column-gap')
  if (gap) ticks = props.board.columns.map((_, i) => setTimeout(hapticTick, first + i * gap))
})
onBeforeUnmount(stop)
</script>

<template>
  <CelebrationDialog
    v-model:open="open"
    clip="board-created"
    :label="board.emoji"
    :headline="t.boardCreated.headline(board.emoji, board.name)"
    :body="t.boardCreated.body"
    :close-label="t.boardCreated.close"
  >
    <ol
      class="mb-3 flex flex-wrap justify-center gap-2"
      aria-hidden="true"
    >
      <li
        v-for="(column, index) in board.columns"
        :key="column.id"
        class="column rounded-pill px-3.5 py-1.5 text-label text-text"
        :style="{ '--accent': columnAccent(index), '--index': index }"
        data-board-created-column
      >
        {{ column.name }}
      </li>
    </ol>
    <template #actions>
      <!-- Focused as it opens: the way on. -->
      <button
        type="button"
        autofocus
        class="rounded-pill bg-inverse px-6 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {{ t.boardCreated.start }}
      </button>
    </template>
  </CelebrationDialog>
</template>

<style scoped>
/* Each Column rises in with an overshoot, one after another (main.css
   tokens). Reduced motion: they are just there. */
.column {
  background: color-mix(in oklch, var(--accent) 45%, var(--color-surface));
  animation: column-rise var(--dur-settle) var(--ease-pop) backwards;
  animation-delay: calc(var(--dur-board-created-columns) + var(--index) * var(--dur-board-created-column-gap));
}
@keyframes column-rise {
  from { opacity: 0; translate: 0 24px; scale: .9; }
}
</style>
