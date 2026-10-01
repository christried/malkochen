<script setup lang="ts">
import type { InviteView } from '~~/server/utils/invites'

// The invite landing's clip (handoff REMOTION.md invite-intro, invite-loop):
// the intro once, then the loop, with the Board's emoji in the clip's pebble
// and the Members' avatars over it, both drawn here. The intro ends on the
// loop's first frame, which is also the still of both, so the hand-over has
// no seam: the still shows between the two videos.
//
// The overlays move with the clip (remotion/src/clips/invite-intro.tsx,
// invite-loop.tsx): their animations are set to the video's time on every
// frame, so they never drift from it. Showing the still, they rest as the
// loop's first frame has them.
const props = defineProps<{ invite: InviteView }>()
const t = useStrings()

const FPS = 30
const INTRO_FRAMES = 45
// The pebble bobs ±8 canvas px every 84 frames; it is 42% of the 780px-wide
// canvas, so 8px is this much of the emoji's box, which matches the pebble's.
const BOB_FRAMES = 84
const BOB = (8 / (0.42 * 780)) * 100
// The intro pops the pebble in from f6 to f27, and each avatar 3 frames after
// the one before from f33. Easings as Remotion's keys().
const EASE_OUT = 'cubic-bezier(0, 0, .58, 1)'
const EASE_IN_OUT = 'cubic-bezier(.42, 0, .58, 1)'
const AVATARS_AT = 33

const phase = ref<'intro' | 'loop'>('intro')
const clip = useTemplateRef<{ time: () => number | null }>('clip')
const bobbing = useTemplateRef<HTMLElement>('bobbing')
const popping = useTemplateRef<HTMLElement>('popping')
const avatars = useTemplateRef<HTMLElement[]>('avatars')

const ms = (frames: number) => (frames / FPS) * 1000

// Something popping in: scale 0, an overshoot, rest, at frames along the
// intro. Kept paused, for follow() to set.
type Pop = { animation: Animation, end: number }
function pop(el: HTMLElement, keyframes: ({ at: number } & Keyframe)[]): Pop {
  const end = ms(keyframes.at(-1)!.at)
  const animation = el.animate(
    keyframes.map(({ at, ...keyframe }) => ({ ...keyframe, offset: ms(at) / end })),
    { duration: end, fill: 'both' },
  )
  animation.pause()
  return { animation, end }
}

let frame = 0
onMounted(() => {
  const period = ms(BOB_FRAMES)
  const bob = bobbing.value!.animate(
    Array.from({ length: BOB_FRAMES + 1 }, (_, f) => ({ translate: `0 ${-BOB * Math.sin((2 * Math.PI * f) / BOB_FRAMES)}%` })),
    { duration: period, iterations: Infinity },
  )
  bob.pause()
  const pops = [
    pop(popping.value!, [
      { at: 0, scale: 0, rotate: '-12deg' },
      { at: 6, scale: 0, rotate: '-12deg', easing: EASE_OUT },
      { at: 18, scale: 1.1, rotate: '4deg', easing: EASE_IN_OUT },
      { at: 27, scale: 1, rotate: '0deg' },
    ]),
    ...(avatars.value ?? []).map((el, i) => {
      const at = AVATARS_AT + 3 * i
      return pop(el, [
        { at: 0, scale: 0 },
        { at, scale: 0, easing: EASE_OUT },
        { at: at + 5, scale: 1.15, easing: EASE_IN_OUT },
        { at: at + 8, scale: 1 },
      ])
    }),
  ]

  const follow = () => {
    const time = clip.value?.time() ?? null
    const intro = phase.value === 'intro' && time !== null
    // Into the loop; the intro plays the loop's motion 45 frames early.
    const loopMs = time === null ? 0 : time * 1000 - (intro ? ms(INTRO_FRAMES) : 0)
    bob.currentTime = ((loopMs % period) + period) % period
    for (const { animation, end } of pops) animation.currentTime = intro ? time * 1000 : end
    frame = requestAnimationFrame(follow)
  }
  follow()
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template>
  <div class="invite-clip relative aspect-[26/25] w-[min(84vw,360px)]">
    <MotionClip
      ref="clip"
      :src="phase === 'intro' ? '/clips/invite-intro' : '/clips/invite-loop'"
      :loop="phase === 'loop'"
      play
      data-invite-clip
      @ended="phase = 'loop'"
    >
      <!-- The still of both: the loop's first frame. -->
      <img
        src="/clips/invite-loop-light.png"
        alt=""
        class="only-light h-full w-full object-cover"
      >
      <img
        src="/clips/invite-loop-dark.png"
        alt=""
        class="only-dark h-full w-full object-cover"
      >
    </MotionClip>
    <!-- Over the clip's pebble: centred, 14% from the top, 42% wide. -->
    <div
      ref="bobbing"
      class="absolute left-[29%] top-[14%] flex aspect-square w-[42%] items-center justify-center"
      aria-hidden="true"
    >
      <span
        ref="popping"
        class="text-[17cqw] leading-none"
        data-testid="invite-emoji"
      >{{ props.invite.board.emoji }}</span>
    </div>
    <ul
      class="absolute bottom-[10%] left-1/2 flex -translate-x-[10%]"
      :aria-label="t.invite.members"
    >
      <li
        v-for="member in props.invite.members.slice(0, 4)"
        :key="member.id"
        ref="avatars"
        class="-ml-2 rounded-full ring-[2.5px] ring-bg first:ml-0"
      >
        <UserAvatar
          :name="member.name"
          :image="member.image"
          :size="36"
        />
        <span class="sr-only">{{ member.name }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* The emoji's size follows the clip's. */
.invite-clip {
  container-type: inline-size;
}
</style>
