<script setup lang="ts">
// The handoff's AchievementBadge, in the Dish detail: a butter-to-orange
// pebble with how often the Dish was cooked, its level under it
// (Ausprobiert, Wird Liebling, Stammgericht, Klassiker) and a pip for each
// Cooking toward the next. As the detail opens, and as the Dish is cooked
// again, the number counts up (170ms a step, at most 10 steps, each with a
// pop and a CLOCK_TICK), and on reaching a level the pebble springs to that
// level's size (420ms); at rest a ring sits around it. Fewer Cookings (one
// deleted) just show. Reduced motion: the final number, at once, and no
// spring.
const props = defineProps<{ count: number }>()
const t = useStrings()

const MAX_STEPS = 10
const SIZES: Record<AchievementLevel, number> = { tried: 58, favourite: 66, regular: 74, classic: 84 }

// Screen readers get the final count at once; the pebble shows the count-up.
const label = computed(() => {
  const achievement = achievementOf(props.count)
  if (!achievement) return ''
  const { level, next } = achievement
  return t.achievement.label(
    t.achievement.level[level],
    props.count,
    next && { level: t.achievement.level[next.level], left: next.pips - next.filled },
  )
})

const shown = ref(props.count)
const counting = ref(false)
const achievement = computed(() => achievementOf(shown.value))

let timer: ReturnType<typeof setTimeout> | undefined
function countUp(from: number) {
  clearTimeout(timer)
  const stepMs = motionMs('badge-step')
  if (!stepMs || from >= props.count) {
    shown.value = props.count
    counting.value = false
    return
  }
  shown.value = Math.max(from, props.count - MAX_STEPS)
  counting.value = true
  const step = () => {
    if (shown.value >= props.count) {
      counting.value = false
      return
    }
    timer = setTimeout(() => {
      shown.value++
      hapticClockTick()
      step()
    }, stepMs)
  }
  step()
}
onMounted(() => countUp(1))
watch(() => props.count, (count, before) => count > before ? countUp(before) : countUp(count))
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div
    v-if="achievement"
    role="img"
    :aria-label="label"
    class="flex flex-col items-center gap-2"
    data-testid="achievement-badge"
  >
    <div
      class="flex h-[84px] items-center justify-center"
      aria-hidden="true"
    >
      <div
        class="badge relative flex items-center justify-center font-display text-neu-ink"
        :class="counting ? 'counting' : 'idle'"
        :style="{ '--size': `${SIZES[achievement.level]}px` }"
        :data-level="achievement.level"
      >
        <span
          :key="shown"
          class="count"
        >{{ t.achievement.count(shown) }}</span>
      </div>
    </div>
    <span
      class="text-label"
      aria-hidden="true"
    >{{ t.achievement.level[achievement.level] }}</span>
    <span
      v-if="achievement.next"
      class="flex gap-1.5"
      aria-hidden="true"
    >
      <span
        v-for="pip in achievement.next.pips"
        :key="pip"
        class="pip h-2 w-2 rounded-full"
        :class="pip <= achievement.next.filled ? 'bg-neu-accent' : 'bg-line-strong'"
        data-pip
        :data-filled="pip <= achievement.next.filled || undefined"
      />
    </span>
  </div>
</template>

<style scoped>
/* A pebble (radius.blob) in the "Neu" gradient, sized by level; counting
   up, it springs to a new size with the pop easing's overshoot. */
.badge {
  width: var(--size);
  height: var(--size);
  border-radius: var(--radius-blob);
  background: var(--gradient-neu);
  box-shadow: var(--shadow-neu);
  font-size: calc(var(--size) * .36);
  /* Display text is 500 (R11), set solid in its pebble. */
  font-weight: 500;
  line-height: 1;
  rotate: -4deg;
}
.badge.counting {
  transition: width var(--dur-badge-grow) var(--ease-pop), height var(--dur-badge-grow) var(--ease-pop), font-size var(--dur-badge-grow) var(--ease-pop);
}
/* At rest, a thin ring sits around it. */
.badge::after {
  content: '';
  position: absolute;
  inset: -5px;
  border-radius: inherit;
  border: 2px solid color-mix(in srgb, var(--color-neu-accent) 45%, transparent);
  opacity: 0;
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.badge.idle::after {
  opacity: 1;
}
/* Each step of the count-up pops the number. */
.count {
  animation: count-pop var(--dur-badge-step) var(--ease-pop);
}
@keyframes count-pop {
  from { scale: 1.25; }
}
.pip {
  transition: background-color var(--dur-fade) var(--ease-fade);
}
</style>
