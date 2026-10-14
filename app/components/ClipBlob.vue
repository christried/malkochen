<script setup lang="ts">
// The soft blob a system clip sits on (Offline, the error screen, Not
// unlocked's circle, the invite landing), its accent mixed into the page's
// own colour, as the clips' videos mixed it into a background they baked in
// before they were drawn in code (#217). Drawn by the page, behind the
// drawing, so no box ever shows around it, in light or dark.
// `inset` is how far in from the clip's box it sits, in % of each side, as
// the videos had it; `circle` makes it round instead, where its box is in %
// of the clip's.
const props = defineProps<{
  accent: 'sky' | 'carrot' | 'butter'
  share: number
  inset?: number
  circle?: { left: number, top: number, width: number, height: number }
}>()

const style = computed(() => ({
  background: `color-mix(in oklch, var(--color-${props.accent}) ${props.share}%, var(--color-bg))`,
  ...(props.circle
    ? { left: `${props.circle.left}%`, top: `${props.circle.top}%`, width: `${props.circle.width}%`, height: `${props.circle.height}%` }
    : { inset: `${props.inset ?? 0}%` }),
}))
</script>

<template>
  <div
    class="absolute"
    :class="circle ? 'rounded-full' : 'rounded-blob'"
    :style="style"
    aria-hidden="true"
    data-blob
  />
</template>
