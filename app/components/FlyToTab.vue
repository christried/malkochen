<script setup lang="ts">
// The handoff's "fly-to-tab-pebble" (part of the Gekocht celebration): a
// pebble in the Gekocht Column's accent flies in an arc from the
// "Gekocht ✓" button to that Column's tab (or its name, with the Columns
// side by side), shrinking, in 640ms (swoosh), and says `landed` there.
// Native, not a clip. Skipped with reduced motion (the count just changes).
const props = defineProps<{ from: Point, to: Point, accent: string }>()
const emit = defineEmits<{ landed: [] }>()

const pebble = useTemplateRef<HTMLElement>('pebble')
let flight: Animation | undefined
onMounted(() => {
  const { from, to } = props
  // Up and over: the midpoint lifts above the higher of the two ends.
  const lift = Math.min(from.y, to.y) - 60
  flight = pebble.value?.animate([
    { translate: `${from.x}px ${from.y}px`, scale: 1 },
    { translate: `${(from.x + to.x) / 2}px ${lift}px`, scale: .9, offset: .45 },
    { translate: `${to.x}px ${to.y}px`, scale: .5 },
  ], { duration: motionMs('fly-to-tab'), easing: motionEase('swoosh'), fill: 'forwards' })
  flight?.finished.then(() => emit('landed'), () => {})
})
onBeforeUnmount(() => flight?.cancel())
</script>

<template>
  <span
    ref="pebble"
    aria-hidden="true"
    class="pointer-events-none fixed left-0 top-0 z-drag -ml-2.5 -mt-2 block h-4 w-5"
    :style="{ background: accent, borderRadius: 'var(--radius-blob)' }"
  />
</template>
