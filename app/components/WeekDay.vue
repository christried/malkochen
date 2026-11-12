<script setup lang="ts">
// One day of the Week Plan (handoff WeekDay): its header with the date pebble
// and the weekday, "Heute" on today, and its Planned Dishes in the slot, in
// order. On a phone a block in the list of the week, with "+" in its header;
// from 1200px a column of the week, with a dashed "+" row at its end, where
// a Dish picked lands. Today is tinted. A past day has no "+" and takes
// nothing; a Member who may not move Dishes has no "+" either. While a
// Planned Dish is dragged over the day, it is the drop target: tinted with a
// ring.
defineProps<{
  day: string
  today: string
  past: boolean
  canPlan: boolean
  target?: boolean
  // The animation of Planned Dishes arriving and leaving ("none": a drop that settled already).
  listName?: string
}>()
const emit = defineEmits<{ plan: [anchor: HTMLElement] }>()
const t = useStrings()
</script>

<template>
  <div
    class="week-day relative flex min-w-0 scroll-mt-4 flex-col"
    :class="{ 'is-today': day === today, 'is-past': past, 'is-target': target }"
    :data-day="day"
    :data-today="day === today || undefined"
    :data-past="past || undefined"
  >
    <header class="flex min-h-[40px] items-center gap-2.5 desktop:min-h-[38px] desktop:gap-2">
      <span
        class="pebble flex h-[38px] w-10 shrink-0 items-center justify-center font-display text-[18px] font-medium [border-radius:var(--radius-blob)] desktop:h-9 desktop:w-[38px]"
        :class="day === today ? 'bg-butter text-on-accent' : 'bg-surface-muted'"
        aria-hidden="true"
      >{{ t.week.dayOfMonth(day) }}</span>
      <h3 class="min-w-0 truncate text-[16px] font-semibold">
        <span class="desktop:hidden">{{ t.week.weekday(day) }}</span>
        <span class="hidden desktop:inline">{{ t.week.weekdayShort(day) }}</span>
      </h3>
      <span
        v-if="day === today"
        class="rounded-pill bg-butter px-2 py-1 text-[12px] font-bold leading-none text-on-accent"
        data-today-chip
      >{{ t.week.today }}</span>
      <span class="flex-1" />
      <button
        v-if="canPlan && !past"
        type="button"
        class="plan-plus flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface shadow-small transition-transform duration-tap ease-tap active:scale-90 focus-visible:outline-2 focus-visible:outline-focus desktop:hidden"
        :aria-label="t.week.planOn(day)"
        data-plan-plus
        @click="emit('plan', $event.currentTarget as HTMLElement)"
      >
        <AppIcon
          name="plus"
          :size="18"
        />
      </button>
    </header>
    <TransitionGroup
      tag="ol"
      role="list"
      :name="listName"
      class="planned-list relative mt-2 flex flex-col gap-2 desktop:gap-[10px]"
      :aria-label="t.week.dayName(day)"
      data-planned-list
    >
      <slot />
    </TransitionGroup>
    <button
      v-if="canPlan && !past"
      type="button"
      class="plan-row mt-2.5 hidden h-10 w-full items-center justify-center rounded-field border-2 border-dashed border-line-strong text-text-muted transition-transform duration-tap ease-tap active:scale-[.97] focus-visible:outline-2 focus-visible:outline-focus desktop:flex"
      :aria-label="t.week.planOn(day)"
      data-plan-plus
      @click="emit('plan', $event.currentTarget as HTMLElement)"
    >
      <AppIcon
        name="plus"
        :size="18"
      />
    </button>
  </div>
</template>

<style scoped>
/* A phone: today's block is tinted; a day dragged over is washed in butter. */
.week-day {
  border-radius: var(--radius-card);
  transition: background-color var(--dur-fade) var(--ease-fade), box-shadow var(--dur-fade) var(--ease-fade);
}
.week-day.is-today {
  background: var(--color-today-tint);
  padding: 8px 10px 12px;
}
.week-day.is-target {
  background: color-mix(in srgb, var(--color-butter) 12%, var(--color-bg));
}
@media (min-width: 1200px) {
  /* A column of the week, to its bottom like a lane. */
  .week-day,
  .week-day.is-today {
    border-radius: 26px 22px 0 0;
    background: var(--color-day-fill);
    padding: 10px 8px 14px;
  }
  .week-day.is-today {
    background: var(--color-today-tint);
  }
  .week-day.is-target {
    background: color-mix(in srgb, var(--color-butter) 16%, var(--color-bg));
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-butter) 55%, transparent);
    animation: day-pop 240ms var(--ease-pop);
  }
}
@keyframes day-pop {
  from { scale: .985; }
}
@media (prefers-reduced-motion: reduce) {
  .week-day.is-target {
    animation: none;
  }
}
</style>
