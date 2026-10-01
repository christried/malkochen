<script setup lang="ts">
// The handoff's "fly-to-tab-pebble" (part of the Gekocht celebration on
// phones): a pebble in the Gekocht Column's accent flies in an arc from the
// "Gekocht ✓" button to that Column's tab, shrinking, in 640ms (swoosh), and
// says `landed` there. Native, not a clip. The Board skips it with reduced
// motion (the tab's count just changes).
const props = defineProps<{ from: Point, to: Point, accent: string }>()
const emit = defineEmits<{ landed: [] }>()

const FLIGHT_MS = 640
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
  ], { duration: FLIGHT_MS, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' })
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
