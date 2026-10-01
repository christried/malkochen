<script setup lang="ts">
// The handoff's board-created celebration, right after "Neues Board" is
// saved: its clip (a pebble pops in with a twist as pebble confetti bursts
// out), with the Board's emoji drawn on the pebble here, a headline and
// "Los geht’s", which goes to the Board.
//
// The emoji moves with the clip (remotion/src/clips/board-created.tsx): its
// pop is set to the video's time on every frame, so it never drifts from
// it. Showing the still, it rests as the last frame has it.
const open = defineModel<boolean>('open', { required: true })
defineProps<{ board: { emoji: string, name: string } }>()
const t = useStrings()

// The pebble pops from f3 (scale 0, −30°) to f9 (1.08, +8°) and rests at
// f13, at 30fps. Easings as Remotion's keys().
const FPS = 30
const ms = (frames: number) => (frames / FPS) * 1000
const POP_END = ms(13)

const celebration = useTemplateRef<{ time: () => number | null }>('celebration')
const emoji = useTemplateRef<HTMLElement>('emoji')

let followRequest = 0
watch(open, async (isOpen) => {
  cancelAnimationFrame(followRequest)
  if (!isOpen) return
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
onBeforeUnmount(() => cancelAnimationFrame(followRequest))
</script>

<template>
  <CelebrationDialog
    ref="celebration"
    v-model:open="open"
    clip="board-created"
    :headline="t.boardCreated.headline(board.emoji, board.name)"
    :body="t.boardCreated.body"
    :close-label="t.boards.close"
    :text-delay="400"
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
