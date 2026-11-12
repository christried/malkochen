<script setup lang="ts">
import type { PlanEntry } from '~/board/board-module'

// A Planned Dish on the Week Plan (handoff PlannedDish; CONTEXT.md: Planned
// Dish): smaller than a Dish card, with the Dish's image and title, and
// nothing of its Votes, Comments, Creator or Column. The whole card is a
// link to the Dish detail (a stretched link, so the buttons on it stay
// their own). On a phone it is a row 64px high; from 1200px a small card
// 166px high with the image on top.
//
// Who cooks it, "Gekocht ✓" and the tick (#518): the `cook` slot (the cook's
// Profile Picture, beside "⋯" on a phone, at the start of the bottom row on
// desktop; it pops in and fades out), the `action` slot ("Gekocht ✓", a row
// of its own under the title on a phone, at the end of the bottom row on
// desktop) and the tick on the image's corner, which pops onto the image when
// the Dish has a Cooking that day (`entry.cooked`) and fades when it goes.
// "Gekocht ✓" is for `cookable` ones (today's, for a Member who may move
// Dishes) and only while not cooked: the card is taller for it on a phone
// (100px). Once cooked, the button stays 2.2s, sage, so the celebration is
// seen with it, then fades and the card shortens (settle 480ms); an undone
// Cooking brings it back.
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
  // Today's for a Member who may move Dishes: "Gekocht ✓" until it is cooked.
  cookable?: boolean
  // The room for "Gekocht ✓" under the title (phones), for the lifted copy.
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
const wide = useMediaQuery('(min-width: 1200px)')

// "Gekocht ✓" shows until the Dish is cooked today, and 2.2s after.
const lingering = ref(false)
let lingerTimer: ReturnType<typeof setTimeout> | undefined
watch(() => props.entry.cooked, (cooked) => {
  clearTimeout(lingerTimer)
  lingering.value = cooked && !!props.cookable
  if (lingering.value) lingerTimer = setTimeout(() => (lingering.value = false), 2200)
})
onBeforeUnmount(() => clearTimeout(lingerTimer))
const showAction = computed(() => !!props.cookable && (!props.entry.cooked || lingering.value))
const isTall = computed(() => props.tall || showAction.value)
</script>

<template>
  <div
    class="planned relative grid rounded-planned bg-surface text-text shadow-small"
    :class="{ tall: isTall, lifted }"
    :data-planned-card="entry.id"
    :data-week-dish="dish.id"
  >
    <NuxtLink
      :to="to"
      :aria-label="t.week.plannedDish(dish.title, entry.day, entry.cook?.name, entry.cooked)"
      :tabindex="lifted ? -1 : undefined"
      class="planned-link title font-display"
      @click="emit('open', $event)"
    >
      {{ dish.title }}
    </NuxtLink>
    <span
      class="thumb relative rounded-planned-thumb"
      data-thumb
    >
      <span class="block h-full w-full overflow-hidden bg-surface-muted [border-radius:inherit]">
        <DishImage
          :image-url="dish.imageUrl"
          :focus="dish.imageFocus"
          :placeholder="dish.placeholder"
          lazy
        />
      </span>
      <Transition name="tick">
        <span
          v-if="entry.cooked"
          class="tick"
          aria-hidden="true"
          data-cooked-tick
        >
          <svg
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            stroke-width="2.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          ><path d="M3 8.5l3.2 3L13 4.5" /></svg>
        </span>
      </Transition>
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
      <Transition
        name="cook"
        mode="out-in"
      >
        <slot name="cook">
          <!-- The lifted copy has no slots: the cook's picture, plain. -->
          <UserAvatar
            v-if="lifted && entry.cook"
            :name="entry.cook.name"
            :image="entry.cook.image"
            :size="wide ? 22 : 28"
          />
        </slot>
      </Transition>
    </span>
    <span class="action relative z-[2] flex items-center">
      <Transition name="action">
        <span
          v-if="showAction"
          class="flex items-center"
          :inert="entry.cooked || undefined"
          data-cook-action
        >
          <slot name="action" />
        </span>
      </Transition>
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
   and "⋯". The cook and "Gekocht ✓" have their areas. */
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
  transition: scale var(--dur-tap) var(--ease-tap), height var(--dur-settle) var(--ease-settle);
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

/* The tick: 22px sage with a check, ringed in the card's colour, on the
   image's bottom right corner. It pops on (scale 0 to 1.25 to 1, turning
   from -30 degrees, 460ms) and fades when the Cooking is undone (150ms). */
.tick {
  position: absolute;
  right: -5px;
  bottom: -5px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-sage);
  color: var(--color-sage-ink);
  box-shadow: 0 0 0 2.5px var(--color-surface);
  pointer-events: none;
}
.tick-enter-active {
  animation: r14-tick var(--dur-pop) var(--ease-pop);
}
.tick-leave-active {
  transition: opacity 150ms var(--ease-fade);
}
.tick-leave-to {
  opacity: 0;
}
/* "Gekocht ✓" fades out once it has done its job (240ms), and comes back
   with an undone Cooking. */
.action-enter-active,
.action-leave-active {
  transition: opacity var(--dur-fade) var(--ease-fade);
}
.action-enter-from,
.action-leave-to {
  opacity: 0;
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
  .tick {
    right: -4px;
    bottom: -6px;
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
  .tick-enter-active {
    animation: none;
  }
  .tick-leave-active,
  .action-enter-active,
  .action-leave-active {
    transition: none;
  }
  .planned:not(.lifted):active {
    scale: none;
  }
}
</style>
