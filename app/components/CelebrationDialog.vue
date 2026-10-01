<script setup lang="ts">
// A full-screen celebration (handoff REMOTION.md, Celebrations): a wash in
// its clip's background colour, the one-shot clip in the middle, and a
// headline and a line of text over the wash, rising in as the clip plays.
// A native modal <dialog>, so it shows over whatever is open, the Dish
// detail included; a tap anywhere, Escape or "Schließen" closes it, as does
// the time `closeAfter` (a duration token) if given. Reduced motion: the
// clip's still and the text, at once, and it stays until closed (the
// tokens are 0 then).
//
// `clip` names the clip ('milestone-10x' plays /clips/milestone-10x-*); the
// wash and when the text comes follow from it (the styles below). Slots:
// `clip` draws over the clip (sized in cqw of it, following its `time()`),
// the default one sits between the clip and the text, `actions` under the
// text, and `toast` takes the page's Toast: the page behind is inert, so
// the Toast shows in here, above the wash.
type Clip = 'milestone-10x' | 'board-created'
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  clip: Clip
  headline: string
  body: string
  closeLabel: string
  closeAfter?: DurationToken
}>()
defineSlots<{ clip?: () => unknown, default?: () => unknown, actions?: () => unknown, toast?: () => unknown }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const motionClip = useTemplateRef<{ time: () => number | null }>('motionClip')
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

defineExpose({ time: () => motionClip.value?.time() ?? null })
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
        >
          <AppIcon name="close" />
        </button>
        <div class="clip relative aspect-square w-[min(78vw,48dvh,420px)]">
          <MotionClip
            ref="motionClip"
            :src="`/clips/${clip}`"
            :loop="false"
            play
          />
          <slot name="clip" />
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
