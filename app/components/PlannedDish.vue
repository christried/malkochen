<script setup lang="ts">
import type { PlanEntry } from '~/board/board-module'

// A Planned Dish on the Week Plan (handoff PlannedDish; CONTEXT.md: Planned
// Dish): smaller than a Dish card, with the Dish's image and title, and
// nothing of its Votes, Comments, Creator or Column. The whole card is a
// link to the Dish detail (a stretched link, so the buttons on it stay
// their own). On a phone it is a row 64px high; from 1200px a small card
// 166px high with the image on top.
//
// Who cooks it, "Gekocht ✓" and the tick belong to the next ticket (#518) and
// have their places here: the `cook` slot (the cook's Profile Picture,
// beside "⋯" on a phone, at the start of the bottom row on desktop), the
// `action` slot ("Gekocht ✓", a row of its own under the title when the card
// is `tall`, today's on a phone, at the end of the bottom row on desktop) and
// the `badge` slot (the tick on the image's corner).
//
// "⋯" opens its menu: on a phone always there, on desktop it comes with the
// pointer or the keyboard. The card is a lifted copy (`lifted`) while being
// dragged, and the dashed slot the lift leaves behind is the list's
// (WeekPlan).
const props = defineProps<{
  entry: PlanEntry
  to: string
  // The Member may change the plan: "⋯" is there.
  canChange?: boolean
  // Today's, with the room for "Gekocht ✓" under the title (phones).
  tall?: boolean
  // The dragged copy: lifted, with nothing to press.
  lifted?: boolean
}>()
const emit = defineEmits<{
  open: [event: MouseEvent]
  menu: [button: HTMLElement]
}>()
const t = useStrings()
const dish = computed(() => props.entry.dish)
</script>

<template>
  <div
    class="planned relative grid rounded-planned bg-surface text-text shadow-small"
    :class="{ tall, lifted }"
    :data-planned-card="entry.id"
    :data-week-dish="dish.id"
  >
    <NuxtLink
      :to="to"
      :aria-label="t.week.plannedDish(dish.title, entry.day)"
      :tabindex="lifted ? -1 : undefined"
      class="planned-link title font-display"
      @click="emit('open', $event)"
    >
      {{ dish.title }}
    </NuxtLink>
    <span
      class="thumb relative overflow-hidden rounded-planned-thumb bg-surface-muted"
      data-thumb
    >
      <DishImage
        :image-url="dish.imageUrl"
        :focus="dish.imageFocus"
        :placeholder="dish.placeholder"
        lazy
      />
      <slot name="badge" />
    </span>
    <span
      v-if="entry.unsent"
      class="mark flex items-center gap-1 text-text-muted"
      data-unsent
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
        class="shrink-0"
      ><path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z" /></svg>
      <span class="truncate">{{ t.unsent.notSent }}</span>
    </span>
    <span class="cook relative z-[2] flex items-center">
      <slot name="cook" />
    </span>
    <span class="action relative z-[2] flex items-center">
      <slot name="action" />
    </span>
    <button
      v-if="canChange && !lifted"
      type="button"
      class="more"
      :aria-label="t.week.more(dish.title)"
      aria-haspopup="menu"
      data-planned-more
      @click="emit('menu', $event.currentTarget as HTMLElement)"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="currentColor"
        aria-hidden="true"
      ><circle
        cx="5"
        cy="12"
        r="2"
      /><circle
        cx="12"
        cy="12"
        r="2"
      /><circle
        cx="19"
        cy="12"
        r="2"
      /></svg>
    </button>
  </div>
</template>

<style scoped>
/* Phones: a row, 64px (100px with room for "Gekocht ✓"): the image 48px,
   the title (two lines, one with the unsent mark under it), then the cook
   and "⋯". The areas keep what #518 adds in place. */
.planned {
  isolation: isolate;
  height: var(--size-pd);
  grid-template-columns: 48px minmax(0, 1fr) auto 36px;
  grid-template-rows: auto auto;
  grid-template-areas:
    'thumb title cook more'
    'thumb mark cook more';
  align-content: center;
  align-items: center;
  column-gap: 12px;
  padding: 8px 4px 8px 8px;
  transition: scale var(--dur-tap) var(--ease-tap);
}
.planned.tall {
  height: var(--size-pd-today);
  grid-template-columns: 64px minmax(0, 1fr) auto 36px;
  grid-template-rows: auto auto 36px;
  grid-template-areas:
    'thumb title cook more'
    'thumb mark cook more'
    'thumb action action more';
}
.planned:not(.lifted):active {
  scale: .98;
}
.thumb {
  grid-area: thumb;
  width: 48px;
  height: 48px;
}
.tall .thumb {
  width: 64px;
  height: 64px;
  align-self: start;
  margin-top: 6px;
}
.title {
  grid-area: title;
  min-width: 0;
  font-size: 17px;
  line-height: 1.18;
  font-weight: 500;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  overflow-wrap: break-word;
  hyphens: auto;
}
/* An unsent Planned Dish gives the mark a line: the title keeps one. */
.planned:has(.mark) .title {
  -webkit-line-clamp: 1;
}
.mark {
  grid-area: mark;
  min-width: 0;
  font-size: 12.5px;
  line-height: 1.3;
  font-weight: 500;
}
.cook {
  grid-area: cook;
}
.action {
  grid-area: action;
}
.more {
  grid-area: more;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  width: 36px;
  height: 44px;
  border-radius: 14px;
  color: var(--color-text-muted);
}
.more:focus-visible {
  outline: 2px solid var(--color-focus);
}
/* The link covers the whole card; the cook, "Gekocht ✓" and "⋯" lie over it. */
.planned-link::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
}
.planned-link:focus-visible {
  outline: none;
}
.planned-link:focus-visible::after {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
.lifted {
  box-shadow: var(--shadow-lift);
}

/* From 1200px a small card: the image on top (72px), the title in two lines,
   then a row for the cook, the unsent mark and "Gekocht ✓". "⋯" is a glass
   circle on the image, there with the pointer or the keyboard. */
@media (min-width: 1200px) {
  .planned,
  .planned.tall {
    height: var(--size-pd-desktop);
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-rows: 72px 37px 28px;
    grid-template-areas:
      'thumb thumb thumb'
      'title title title'
      'cook mark action';
    row-gap: 6px;
    column-gap: 6px;
    padding: 6px 6px 8px;
    align-content: start;
  }
  .thumb,
  .tall .thumb {
    width: 100%;
    height: 72px;
    margin: 0;
    border-radius: 17px 14px 18px 15px;
    align-self: stretch;
  }
  .title {
    font-size: 15.5px;
    line-height: 1.2;
    -webkit-line-clamp: 2;
    padding: 0 2px;
    align-self: start;
  }
  .planned:has(.mark) .title {
    -webkit-line-clamp: 2;
  }
  .mark {
    font-size: 11.5px;
    justify-self: start;
  }
  .more {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--color-glass);
    color: var(--color-text);
  }
}
/* Under a mouse "⋯" comes with the pointer or focus; a finger has it all
   the time. */
@media (min-width: 1200px) and (hover: hover) and (pointer: fine) {
  .more {
    opacity: 0;
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .planned:hover .more,
  .planned:focus-within .more,
  .more:focus-visible {
    opacity: 1;
  }
}
@media (prefers-reduced-motion: reduce) {
  .planned {
    transition: none;
  }
  .planned:not(.lifted):active {
    scale: none;
  }
}
</style>
