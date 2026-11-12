<script setup lang="ts">
import { isPastDay } from '~/board/week-days'
import { tabRadius } from '~/utils/columns'

// The day strip (handoff DayStrip): on a phone, while a Planned Dish is
// lifted, the week's seven days as pebbles under the week's title, so a
// Planned Dish reaches a day that is off screen. The day under the pointer
// grows and wiggles (butter, a ring); past days are dimmed and no target.
// Dropping on a pebble puts it at the end of that day (useWeekDrag).
defineProps<{
  days: string[]
  today: string
  // The pebble the pointer is over.
  target: string | null
}>()
const t = useStrings()
</script>

<template>
  <div
    aria-hidden="true"
    class="strip fixed inset-x-3 top-3 z-strip flex justify-between gap-1 bg-glass p-2 backdrop-blur-md [border-radius:26px_22px_27px_23px]"
    data-testid="day-strip"
  >
    <span
      v-for="(day, i) in days"
      :key="day"
      class="pebble flex h-[50px] w-[38px] flex-col items-center justify-center bg-surface-muted"
      :class="{ past: isPastDay(day, today), target: day === target, dim: target && day !== target }"
      :style="{ borderRadius: tabRadius(i) }"
      :data-strip-day="day"
    >
      <span class="text-[11px] font-bold leading-none">{{ t.week.weekdayShort(day) }}</span>
      <span class="mt-0.5 font-display text-[17px] font-medium leading-none">{{ t.week.dayOfMonth(day) }}</span>
    </span>
  </div>
</template>

<style scoped>
.strip {
  animation: r14-strip var(--dur-settle) var(--ease-settle);
}
.pebble {
  transition: scale 240ms var(--ease-pop), opacity var(--dur-fade) var(--ease-fade), background-color var(--dur-fade) var(--ease-fade);
}
.pebble.dim {
  opacity: .6;
}
.pebble.past {
  opacity: .3;
}
.pebble.target {
  scale: 1.16;
  background: var(--color-butter);
  color: var(--color-on-accent);
  box-shadow: 0 0 0 6px color-mix(in srgb, var(--color-butter) 35%, transparent);
  animation: wiggle 1.2s ease-in-out infinite;
}
@keyframes wiggle {
  0%, 100% { rotate: -3deg; }
  50% { rotate: 3deg; }
}
@media (prefers-reduced-motion: reduce) {
  .strip {
    animation: none;
  }
  .pebble.target {
    scale: none;
    animation: none;
  }
}
</style>
