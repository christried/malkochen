<script setup lang="ts">
// The handoff's board-created celebration, right after "Neues Board" is
// saved (motion.json "Board created build-in"): its clip (a pebble pops in
// with a twist as pebble confetti bursts out), with the Board's emoji drawn
// on the pebble here; then its Columns rise in one after another, with a
// light tick each, and the headline and "Los geht’s", which goes to the
// Board. Reduced motion: the still, and everything shown at once.
//
// The emoji moves with the clip (remotion/src/clips/board-created.tsx), so
// unlike other UI motion it is a paused Web Animation set to the video's
// time on every frame (as InviteClip does), with Remotion's easings: it
// never drifts from the pebble. Showing the still, it rests as the last
// frame has it.
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ board: { emoji: string, name: string, columns: { id: string, name: string }[] } }>()
const t = useStrings()

// The pebble pops from f3 (scale 0, −30°) to f9 (1.08, +8°) and rests at
// f13, at 30fps.
const FPS = 30
const ms = (frames: number) => (frames / FPS) * 1000
const POP_END = ms(13)

const celebration = useTemplateRef<{ time: () => number | null }>('celebration')
const emoji = useTemplateRef<HTMLElement>('emoji')

let followRequest = 0
let ticks: ReturnType<typeof setTimeout>[] = []
function stop() {
  cancelAnimationFrame(followRequest)
  ticks.forEach(clearTimeout)
  ticks = []
}
watch(open, async (isOpen) => {
  stop()
  if (!isOpen) return
  // A light tick as each Column rises in.
  const first = motionMs('board-created-columns')
  const gap = motionMs('board-created-column-gap')
  if (gap) ticks = props.board.columns.map((_, i) => setTimeout(hapticTick, first + i * gap))

  await nextTick()
  if (!emoji.value) return
  const pop = emoji.value.animate([
    { scale: 0, rotate: '-30deg', offset: 0 },
    { scale: 0, rotate: '-30deg', offset: ms(3) / POP_END, easing: 'cubic-bezier(0, 0, .58, 1)' },
    { scale: 1.08, rotate: '8deg', offset: ms(9) / POP_END, easing: 'cubic-bezier(.42, 0, .58, 1)' },
    { scale: 1, rotate: '0deg', offset: 1 },
  ], { duration: POP_END, fill: 'both' })
  pop.pause()
  const follow = () => {
    const time = celebration.value?.time() ?? null
    pop.currentTime = time === null ? POP_END : Math.min(time * 1000, POP_END)
    // With reduced motion the clip never plays: the emoji just rests.
    if (open.value && !prefersReducedMotion()) followRequest = requestAnimationFrame(follow)
  }
  follow()
}, { flush: 'post' })
onBeforeUnmount(stop)
</script>

<template>
  <CelebrationDialog
    ref="celebration"
    v-model:open="open"
    clip="board-created"
    :headline="t.boardCreated.headline(board.emoji, board.name)"
    :body="t.boardCreated.body"
    :close-label="t.boardCreated.close"
  >
    <template #clip>
      <!-- Over the clip's pebble: centred, 40% wide. -->
      <div
        class="absolute inset-[30%] flex items-center justify-center"
        aria-hidden="true"
      >
        <span
          ref="emoji"
          class="text-[16cqw] leading-none"
          data-testid="board-created-emoji"
        >{{ board.emoji }}</span>
      </div>
    </template>
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
