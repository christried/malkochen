<script setup lang="ts">
// "Gekocht ✓" (handoff "Gekocht button"), on a card and in the Cooking
// History. Tapped, it springs from 1.12 back to 1, fills sage and draws its
// check, and says `cook` with its centre, where the celebration's confetti
// bursts from. Cooked before, it is sage anyway. Reduced motion: colour and
// check only.
const props = defineProps<{ cooked: boolean, label?: string }>()
const emit = defineEmits<{ cook: [origin: Point] }>()
const t = useStrings()

const button = useTemplateRef<HTMLButtonElement>('button')
// Counts taps, so the check draws again each time (its key changes).
const taps = ref(0)
const springing = ref(false)
let springEnd: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(springEnd))

function onClick() {
  const el = button.value
  if (!el) return
  const box = el.getBoundingClientRect()
  taps.value++
  springing.value = true
  clearTimeout(springEnd)
  const ms = motionMs('pop')
  // A Web Animation, so it runs over the press's own scale.
  if (ms) el.animate([{ scale: 1.12 }, { scale: 1 }], { duration: ms, easing: 'cubic-bezier(.34,1.56,.64,1)' })
  springEnd = setTimeout(() => (springing.value = false), Math.max(ms, motionMs('fade')))
  emit('cook', { x: box.left + box.width / 2, y: box.top + box.height / 2 })
}
</script>

<template>
  <button
    ref="button"
    type="button"
    class="inline-flex items-center gap-1 rounded-pill text-button transition duration-tap ease-tap active:scale-[.94] focus-visible:outline-2 focus-visible:outline-focus"
    :class="props.cooked || springing ? 'bg-sage text-sage-ink' : 'bg-surface-muted text-text'"
    :aria-label="label ?? t.dish.cook"
    @click="onClick"
  >
    {{ t.dish.cookWord }}
    <svg
      :key="taps"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      stroke-width="2.4"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    ><path
      d="M3 8.5l3.2 3L13 4.5"
      pathLength="20"
      :class="{ draw: taps }"
    /></svg>
  </button>
</template>

<style scoped>
/* The check draws itself 120ms into the spring, over 260ms. */
.draw {
  stroke-dasharray: 20;
  animation: check-draw 260ms var(--ease-swoosh) 120ms backwards;
}
@keyframes check-draw {
  from { stroke-dashoffset: 20; }
}
</style>
