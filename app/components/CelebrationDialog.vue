<script setup lang="ts">
// A full-screen celebration (handoff REMOTION.md, Celebrations): a wash in
// its clip's background colour, the one-shot clip in the middle, and a
// headline and a line of text over the wash, rising in as the clip plays
// (`textDelay` ms in). A native modal <dialog>, so it shows over whatever is
// open, the Dish detail included; a tap anywhere, Escape or "Schließen"
// closes it, as does `closeAfter` ms if given. Reduced motion: the clip's
// still and the text, at once, and it stays until closed.
//
// `clip` names the clip ('milestone-10x' plays /clips/milestone-10x-*), and
// the wash takes its colour. The `clip` slot draws over the clip (sized in
// cqw of it, and following its `time()`), `actions` under the text.
type Clip = 'milestone-10x' | 'board-created'
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{
  clip: Clip
  headline: string
  body: string
  closeLabel: string
  textDelay: number
  closeAfter?: number
}>()
defineSlots<{ clip?: () => unknown, actions?: () => unknown }>()

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
    if (props.closeAfter && !prefersReducedMotion()) closing = setTimeout(() => (open.value = false), props.closeAfter)
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
    :data-wash="clip"
    :aria-labelledby="headlineId"
    @cancel.prevent="open = false"
    @close="open = false"
    @click="open = false"
  >
    <div
      v-if="open"
      class="flex h-full flex-col items-center justify-center px-6 py-10 text-center"
      :style="{ '--text-delay': `${textDelay}ms` }"
    >
      <button
        type="button"
        class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-glass text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="closeLabel"
      >
        <AppIcon name="close" />
      </button>
      <div class="clip relative aspect-square w-[min(78vw,52dvh,420px)]">
        <MotionClip
          ref="motionClip"
          :src="`/clips/${clip}`"
          :loop="false"
          play
        />
        <slot name="clip" />
      </div>
      <h2
        :id="headlineId"
        class="rise mt-2 font-display text-display-m tablet:text-display-l"
      >
        {{ headline }}
      </h2>
      <p class="rise mt-2 max-w-[360px] text-body text-text-muted">
        {{ body }}
      </p>
      <div class="rise mt-8 empty:hidden">
        <slot name="actions" />
      </div>
    </div>
  </dialog>
</template>

<style scoped>
/* The wash: each clip's background (REMOTION.md), so the clip sits in it
   without an edge. Light, and dark as tokens.css decides it. */
.celebration {
  --wash: var(--wash-light);
  background: var(--wash);
}
.celebration[data-wash="milestone-10x"] {
  --wash-light: #D1DAC5;
  --wash-dark: #686B59;
}
.celebration[data-wash="board-created"] {
  --wash-light: #F3E9CB;
  --wash-dark: #483723;
}
[data-theme="dark"] .celebration {
  --wash: var(--wash-dark);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .celebration {
    --wash: var(--wash-dark);
  }
}
.clip {
  container-type: inline-size;
}
.celebration::backdrop {
  background: transparent;
}
/* The wash fades in, then the text rises in. Reduced motion: both are just
   there (main.css). */
.celebration[open] {
  animation: wash-in var(--dur-fade) var(--ease-fade);
}
@keyframes wash-in {
  from { opacity: 0; }
}
.rise {
  animation: text-rise var(--dur-settle) var(--ease-settle) var(--text-delay) backwards;
}
@keyframes text-rise {
  from { opacity: 0; translate: 0 16px; }
}
</style>
