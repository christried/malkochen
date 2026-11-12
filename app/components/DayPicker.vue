<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'
import { addWeeks, isCurrentWeek, isPastDay, weekDays, weekStart } from '~/board/week-days'

// The day picker (handoff DayPicker): the days of a week to put a Dish on, one
// row each: its date pebble (butter today), the weekday, and up to three tiny
// images of what is planned on it already. It starts on the week of `from`
// (never earlier than today's), past days aren't offered, and ‹ › browse the
// weeks to come (‹ is off on the current week). A Planned Dish being moved
// shows its day as "Liegt hier". "Auf anderen Tag legen" opens it for a
// Planned Dish; "Einplanen" in the Dish detail opens it from today's week.
const props = defineProps<{
  // Whether the picker is showing: it starts afresh each time.
  open: boolean
  // The title is the sheet's; this is the line under it.
  subtitle: string
  today: string
  // A day in the week to start on.
  from: string
  // The day the Planned Dish being moved lies on.
  lies?: string
  // What is planned on a day, for the tiny images.
  dishesOn: (day: string) => DishView[]
}>()
const emit = defineEmits<{ pick: [day: string] }>()
const t = useStrings()

const monday = ref(weekStart(props.from))
const earliest = computed(() => weekStart(props.today))
const direction = ref(1)
watch(() => props.open, (isOpen) => {
  if (!isOpen) return
  const start = weekStart(props.from)
  monday.value = start < earliest.value ? earliest.value : start
}, { immediate: true })

const days = computed(() => weekDays(monday.value).filter(day => !isPastDay(day, props.today)))
const onFirstWeek = computed(() => monday.value <= earliest.value)

function browse(weeks: number) {
  direction.value = weeks
  monday.value = addWeeks(monday.value, weeks)
}
</script>

<template>
  <div data-testid="day-picker">
    <p class="mt-1 truncate text-body text-text-muted">
      {{ subtitle }}
    </p>
    <div class="mt-4 flex items-center justify-between gap-2">
      <button
        type="button"
        class="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-30"
        :disabled="onFirstWeek"
        :aria-label="t.week.previous"
        @click="browse(-1)"
      >
        <AppIcon
          name="back"
          :size="18"
        />
      </button>
      <Transition
        name="fade"
        mode="out-in"
      >
        <p
          :key="monday"
          class="text-label"
          aria-live="polite"
        >
          {{ isCurrentWeek(monday, today) ? t.week.today + ': ' : '' }}{{ t.week.title(monday) }}
        </p>
      </Transition>
      <button
        type="button"
        class="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        :aria-label="t.week.next"
        @click="browse(1)"
      >
        <AppIcon
          name="back"
          :size="18"
          class="rotate-180"
        />
      </button>
    </div>
    <Transition
      :name="direction > 0 ? 'days-next' : 'days-previous'"
      mode="out-in"
    >
      <ul
        :key="monday"
        class="mt-3"
      >
        <li
          v-for="day in days"
          :key="day"
          class="border-t border-line first:border-t-0"
        >
          <button
            type="button"
            class="flex h-14 w-full items-center gap-3 rounded-field px-1 text-left transition-transform duration-tap ease-tap focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
            :class="day === lies ? 'cursor-default bg-surface-muted' : 'active:scale-[.98]'"
            :data-pick-day="day"
            :aria-disabled="day === lies || undefined"
            @click="day !== lies && emit('pick', day)"
          >
            <span
              class="flex h-[34px] w-9 shrink-0 items-center justify-center font-display text-[17px] font-medium [border-radius:var(--radius-blob)]"
              :class="day === today ? 'bg-butter text-on-accent' : 'bg-surface-muted'"
            >{{ t.week.dayOfMonth(day) }}</span>
            <span class="text-[15.5px] font-semibold">{{ t.week.weekday(day) }}</span>
            <span
              v-if="day === today"
              class="rounded-pill bg-butter px-2 py-0.5 text-[12px] font-bold text-on-accent"
            >{{ t.week.today }}</span>
            <span class="flex-1" />
            <span
              v-if="day === lies"
              class="text-caption text-text-muted"
            >{{ t.week.liesHere }}</span>
            <span
              v-else
              class="flex"
              aria-hidden="true"
            >
              <span
                v-for="(dish, i) in dishesOn(day).slice(0, 3)"
                :key="dish.id + i"
                class="-ml-1.5 h-6 w-6 overflow-hidden bg-surface-muted ring-2 ring-surface first:ml-0 [border-radius:9px_8px_10px_8px]"
              >
                <DishImage
                  :image-url="dish.imageUrl"
                  :focus="dish.imageFocus"
                  :placeholder="dish.placeholder"
                  lazy
                />
              </span>
            </span>
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.days-next-enter-active,
.days-previous-enter-active {
  transition: translate var(--dur-settle) var(--ease-settle), opacity var(--dur-fade) var(--ease-fade);
}
.days-next-leave-active,
.days-previous-leave-active {
  transition: translate 160ms ease-in, opacity 160ms ease-in;
}
.days-next-enter-from,
.days-previous-leave-to {
  translate: 24px 0;
  opacity: 0;
}
.days-previous-enter-from,
.days-next-leave-to {
  translate: -24px 0;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .days-next-enter-from,
  .days-previous-leave-to,
  .days-previous-enter-from,
  .days-next-leave-to {
    translate: none;
  }
}
</style>
