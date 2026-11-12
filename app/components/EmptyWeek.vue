<script setup lang="ts">
// An empty week (handoff EmptyWeek): a card with Topfbert pointing, "Die Woche
// ist noch frei.", what to do, and "Gericht aussuchen", which opens the Dish
// picker for today (in a later week, its Monday). A week gone by offers
// nothing: "In dieser Woche war nichts geplant." The card pops in once. Above
// the days on a phone; over the empty week from 1200px. Topfbert idles from
// his layers (TopfbertIdle: paused off screen and under a sheet; his still
// with reduced motion).
defineProps<{
  // The week has gone by: nothing to plan, so no button.
  past: boolean
  // The Member may plan Dishes.
  canPlan: boolean
}>()
const emit = defineEmits<{ pick: [anchor: HTMLElement] }>()
const t = useStrings()
</script>

<template>
  <div
    class="empty-week flex items-center gap-3 rounded-card bg-surface py-3.5 pl-2.5 pr-4 shadow-card desktop:absolute desktop:left-1/2 desktop:top-[110px] desktop:z-[3] desktop:w-[480px] desktop:-translate-x-1/2 desktop:gap-4 desktop:py-5 desktop:pl-4 desktop:pr-6 desktop:shadow-dialog"
    data-testid="empty-week"
  >
    <TopfbertIdle
      mood="pointing"
      class="w-[78px] shrink-0 desktop:w-[100px]"
    />
    <div class="min-w-0">
      <h3 class="font-display text-[21px] font-medium leading-tight">
        {{ past ? t.week.emptyPast : t.week.emptyTitle }}
      </h3>
      <template v-if="!past">
        <p class="mt-1 text-[14px] font-medium leading-snug text-text-muted">
          {{ t.week.emptyText }}
        </p>
        <button
          v-if="canPlan"
          type="button"
          class="mt-3 h-[42px] rounded-pill bg-inverse px-5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          data-empty-pick
          @click="emit('pick', $event.currentTarget as HTMLElement)"
        >
          {{ t.week.emptyButton }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.empty-week {
  animation: pop-in var(--dur-pop) var(--ease-pop) 200ms backwards;
}
@keyframes pop-in {
  from {
    opacity: 0;
    scale: .92;
  }
}
@media (prefers-reduced-motion: reduce) {
  .empty-week {
    animation: none;
  }
}
</style>
