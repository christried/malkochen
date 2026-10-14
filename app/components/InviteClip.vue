<script setup lang="ts">
import type { InviteView } from '~~/server/utils/invites'
import { loopStyle } from '~/utils/svg-loop'

// The invite landing's clip (handoff REMOTION.md invite-intro, invite-loop),
// drawn in code (SvgLoop, #217) on a butter blob in the page's colour: the
// intro once, then the loop, with the Board's emoji on the clip's pebble and
// the Members' avatars over it, both drawn here. The intro stands at its
// last frame, which is the loop's first and the still of both, so the
// hand-over has no seam: the still shows while the loop's drawing comes in.
//
// The overlays move with the drawing, on its clock (SvgLoop's `over`), by
// its keyframes (assets/css/loops.css): in the intro the emoji pops in with
// the pebble and the avatars pop in one after another; in the loop the emoji
// bobs with the pebble. Showing the still, they rest as it has them.
const props = defineProps<{ invite: InviteView }>()
const t = useStrings()

const phase = ref<'intro' | 'loop'>('intro')
const intro = computed(() => phase.value === 'intro')

const moving = (loop: string) => ({ 'data-loop': loop, 'style': loopStyle(loop, 'center')! })
const still = { 'data-loop': undefined, 'style': undefined }
// The pebble's pop (intro) and bob (loop), as the drawing's pebble layer.
const PEBBLE_POP = moving('iv-pebble-pop 1.5s linear infinite')
const PEBBLE_BOB = moving('iv-bob 2.8s linear infinite')
const AVATARS = [1, 2, 3, 4].map(i => moving(`iv-avatar-${i} 1.5s linear infinite`))
</script>

<template>
  <div class="invite-clip relative aspect-[26/25] w-[min(84vw,360px)]">
    <ClipBlob
      accent="butter"
      :share="22"
      :inset="6"
    />
    <SvgLoop
      :src="intro ? '/clips/invite-intro' : '/clips/invite-loop'"
      :loop="!intro"
      :rest="intro ? 'last' : 'first'"
      transparent
      play
      data-invite-clip
      @ended="phase = 'loop'"
    >
      <!-- The still of both: the loop's first frame. -->
      <img
        src="/clips/invite-loop-light.svg"
        alt=""
        class="only-light h-full w-full object-cover"
      >
      <img
        src="/clips/invite-loop-dark.svg"
        alt=""
        class="only-dark h-full w-full object-cover"
      >
      <template #over>
        <!-- The whole clip's box, so the bob's share of its height is the
             drawing's. -->
        <div
          class="absolute inset-0"
          aria-hidden="true"
          v-bind="intro ? still : PEBBLE_BOB"
        >
          <!-- Over the clip's pebble: centred, 14% from the top, 42% wide. -->
          <div class="absolute left-[29%] top-[14%] flex aspect-square w-[42%] items-center justify-center">
            <span
              class="text-[17cqw] leading-none"
              data-testid="invite-emoji"
              v-bind="intro ? PEBBLE_POP : still"
            >{{ props.invite.board.emoji }}</span>
          </div>
        </div>
        <ul
          class="absolute bottom-[10%] left-1/2 flex -translate-x-[10%]"
          :aria-label="t.invite.members"
        >
          <li
            v-for="(member, i) in props.invite.members.slice(0, 4)"
            :key="member.id"
            class="-ml-2 rounded-full ring-[2.5px] ring-bg first:ml-0"
            v-bind="intro ? AVATARS[i] : still"
          >
            <UserAvatar
              :name="member.name"
              :image="member.image"
              :size="36"
            />
            <span class="sr-only">{{ member.name }}</span>
          </li>
        </ul>
      </template>
    </SvgLoop>
  </div>
</template>

<style scoped>
/* The emoji's size follows the clip's. */
.invite-clip {
  container-type: inline-size;
}
</style>
