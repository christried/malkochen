<script setup lang="ts">
import { CELEBRATION_PEBBLES, type CelebrationClip } from '~/utils/celebrations'
import { loopStyle } from '~/utils/svg-loop'

// A full-screen celebration (handoff REMOTION.md, Celebrations): a wash in
// its clip's background colour, the one-shot clip in the middle, and a
// headline and a line of text over the wash, rising in as the clip plays.
// The clip is drawn in code (SvgLoop, #215), on nothing but the wash: it
// pops in from its first frame, plays once at the screen's refresh rate
// and holds its last frame, which is also its still.
// A native modal <dialog>, so it shows over whatever is open, the Dish
// detail included; a tap anywhere, Escape or "Schließen" closes it, as does
// the time `closeAfter` (a duration token) if given. Reduced motion: the
// clip's still and the text, at once, and it stays until closed (the
// tokens are 0 then).
//
// `clip` names the clip ('milestone-10x' draws /clips/milestone-10x-*.svg);
// the wash and when the text comes follow from it (the styles below).
// `label` goes on the clip's pebble ("10×", the Board's emoji), taking the
// pebble's keyframes, so it pops in step with the drawing and rests with it
// (SvgLoop's `over`). Slots: the default one sits between the clip and the
// text, `actions` under the text, and `toast` takes the page's Toast: the
// page behind is inert, so the Toast shows in here, above the wash.
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  clip: CelebrationClip
  headline: string
  body: string
  closeLabel: string
  closeAfter?: DurationToken
  label?: string
}>()
defineSlots<{ default?: () => unknown, actions?: () => unknown, toast?: () => unknown }>()

const pebble = computed(() => {
  const loop = CELEBRATION_PEBBLES[props.clip]
  return { loop, style: loopStyle(loop, 'center')! }
})

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const headlineId = useId()
useModalStack(open)

let closing: ReturnType<typeof setTimeout> | undefined
watch(open, (isOpen) => {
  const el = dialog.value
  if (!el) return
  clearTimeout(closing)
  if (isOpen && !el.open) {
    el.showModal()
    const stay = props.closeAfter ? motionMs(props.closeAfter) : 0
    if (stay) closing = setTimeout(() => (open.value = false), stay)
  }
  if (!isOpen && el.open) el.close()
}, { flush: 'post' })
onBeforeUnmount(() => clearTimeout(closing))
</script>

<template>
  <dialog
    ref="dialog"
    class="celebration m-0 h-dvh max-h-none w-screen max-w-none border-0 p-0 text-text"
    :data-clip-wash="clip"
    :aria-labelledby="headlineId"
    @cancel.prevent="open = false"
    @close="open = false"
    @click="open = false"
  >
    <template v-if="open">
      <div class="flex h-full flex-col items-center justify-center px-6 py-10 text-center">
        <button
          type="button"
          class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-glass text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="closeLabel"
          :data-tooltip="closeLabel"
        >
          <AppIcon name="close" />
        </button>
        <div class="clip relative aspect-square w-[min(78vw,48dvh,420px)]">
          <SvgLoop
            :src="`/clips/${clip}`"
            :loop="false"
            rest="last"
            transparent
            play
          >
            <template
              v-if="label"
              #over
            >
              <!-- On the pebble, in the middle. -->
              <div
                class="absolute inset-0 flex items-center justify-center"
                aria-hidden="true"
              >
                <span
                  class="label leading-none"
                  :data-loop="pebble.loop"
                  :style="pebble.style"
                  data-testid="celebration-label"
                >{{ label }}</span>
              </div>
            </template>
          </SvgLoop>
        </div>
        <slot />
        <h2
          :id="headlineId"
          class="rise mt-2 font-display text-display-m tablet:text-display-l"
        >
          {{ headline }}
        </h2>
        <p class="rise mt-2 max-w-[360px] text-body text-text-muted">
          {{ body }}
        </p>
        <div class="rise-actions mt-8 empty:hidden">
          <slot name="actions" />
        </div>
      </div>
      <slot name="toast" />
    </template>
  </dialog>
</template>

<style scoped>
/* Per clip: its wash (main.css) and when its text and actions rise in. */
.celebration[data-clip-wash="milestone-10x"] {
  --wash: var(--wash-milestone-10x);
  --text-delay: var(--dur-milestone-text);
  --actions-delay: var(--dur-milestone-text);
}
.celebration[data-clip-wash="board-created"] {
  --wash: var(--wash-board-created);
  --text-delay: var(--dur-board-created-text);
  --actions-delay: var(--dur-board-created-actions);
}
.celebration {
  background: var(--wash);
}
/* The pebble's label, sized to the pebble (cqw of the clip): the milestone's
   "10×" set as Remotion drew it (Petrona 500, .36 of a pebble .42 wide),
   the Board's emoji as big as before. */
.celebration[data-clip-wash="milestone-10x"] .label {
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 15.12cqw;
}
.celebration[data-clip-wash="board-created"] .label {
  font-size: 16cqw;
}
.clip {
  container-type: inline-size;
}
.celebration::backdrop {
  background: transparent;
}
/* The wash fades in, then the text rises in. Reduced motion: the wash
   still fades (main.css keeps fades), the text is just there. */
.celebration[open] {
  animation: wash-in var(--dur-fade) var(--ease-fade);
}
@keyframes wash-in {
  from { opacity: 0; }
}
.rise,
.rise-actions {
  animation: text-rise var(--dur-settle) var(--ease-settle) var(--text-delay) backwards;
}
.rise-actions {
  animation-delay: var(--actions-delay);
}
@keyframes text-rise {
  from { opacity: 0; translate: 0 16px; }
}
</style>
