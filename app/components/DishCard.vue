<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'
import type { ClipMotion } from '~/utils/motion'

// The handoff's compact DishCard: 86px thumb + text, 128px high. The thumb
// crops any image, portrait (TikTok, Reels, Shorts) or landscape (blogs), to
// fill it. The Board puts the "…" menu button in its top-right corner and
// "Gekocht ✓" in its bottom-right one, so the title and the bottom line leave
// room for them. "N× gekocht" goes under the title, above the button, where
// it has the whole width. A New Dish wears the "Neu" pebble on the thumb's
// corner.
const props = defineProps<{
  dish: DishView
  isNew?: boolean
  // Shown before (the dragged copy of a card): no pop-in, no ring.
  seen?: boolean
  // The Placeholder's loop, when the Board lets this card play it.
  motion?: ClipMotion
}>()
defineEmits<{ motionEnded: [] }>()
const t = useStrings()

// The "Neu" pebble (handoff "Neu pebble") pops in as the card enters, and a
// ring pulses around it until the card has been in view for a moment.
const SEEN_MS = 2_000
const root = useTemplateRef<HTMLElement>('root')
const pulsing = ref(!props.seen)
let observer: IntersectionObserver | undefined
let seenTimer: ReturnType<typeof setTimeout> | undefined
onMounted(() => watch(() => props.isNew && pulsing.value, (watching) => {
  observer?.disconnect()
  clearTimeout(seenTimer)
  if (!watching || !root.value) return
  observer = new IntersectionObserver(([entry]) => {
    clearTimeout(seenTimer)
    if (entry?.isIntersecting) seenTimer = setTimeout(() => (pulsing.value = false), SEEN_MS)
  }, { threshold: 0.5 })
  observer.observe(root.value)
}, { immediate: true }))
onBeforeUnmount(() => {
  observer?.disconnect()
  clearTimeout(seenTimer)
})

// A title longer than two lines ends in "…"; the full title then comes up
// under it on hover or keyboard focus.
const titleEl = useTemplateRef<HTMLElement>('title')
const titleCut = useTextCut(titleEl, () => props.dish.title)
</script>

<template>
  <article
    ref="root"
    class="relative flex h-32 gap-3 rounded-card bg-surface p-2.5 text-text shadow-card"
    :aria-label="dish.title"
  >
    <span
      v-if="isNew"
      class="neu absolute -left-1.5 -top-1.5 z-[1] px-2.5 py-1 text-overline uppercase text-neu-ink"
      :class="{ 'neu-pop': !seen, 'neu-pulsing': pulsing }"
      data-neu
    >{{ t.dish.new }}</span>
    <div
      class="relative w-[86px] shrink-0 overflow-hidden rounded-thumb bg-surface-muted"
      data-thumb
    >
      <DishImage
        :image-url="dish.imageUrl"
        :focus="dish.imageFocus"
        :placeholder="dish.placeholder"
        :motion="motion"
        lazy
        @ended="$emit('motionEnded')"
      />
      <SourceBadge
        v-if="dish.source"
        :kind="dish.source.kind"
        class="absolute bottom-1.5 left-1.5 max-w-[calc(100%-12px)]"
      />
    </div>
    <div class="flex min-w-0 flex-1 flex-col py-1 pr-1">
      <h3
        ref="title"
        class="title pr-8 font-display text-title-s"
      >
        {{ dish.title }}
      </h3>
      <!-- One line under the title: the Creator, cut with "…" if long, then
           "N× gekocht", which is never cut. Two lines would not fit under a
           two-line title. -->
      <p
        v-if="dish.creator || dish.cookings.length"
        class="mt-0.5 flex min-w-0 pr-1 text-caption text-text-muted"
      >
        <span
          v-if="dish.creator"
          class="truncate"
          :title="dish.creator"
          data-creator
        ><span class="sr-only">{{ `${t.dish.creator} ` }}</span>{{ dish.creator }}</span>
        <span
          v-if="dish.creator && dish.cookings.length"
          aria-hidden="true"
          class="shrink-0 px-1"
        >·</span>
        <span
          v-if="dish.cookings.length"
          class="shrink-0"
          data-cooked-count
        >{{ t.dish.cookedCount(dish.cookings.length) }}</span>
      </p>
      <div class="mt-auto flex min-w-0 items-center gap-2 pr-[108px] text-text-muted">
        <span
          v-if="dish.addedBy"
          :title="t.dish.addedBy(dish.addedBy.name)"
          class="inline-flex"
        >
          <UserAvatar
            :name="dish.addedBy.name"
            :image="dish.addedBy.image"
          />
          <span class="sr-only">{{ t.dish.addedBy(dish.addedBy.name) }}</span>
        </span>
        <span
          v-if="dish.note"
          :title="t.dish.hasNote"
          class="inline-flex"
          data-note-icon
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M5 4h11l3 3v13H5z" />
            <path d="M9 10h6M9 14h6M9 18h3" />
          </svg>
          <span class="sr-only">{{ t.dish.hasNote }}</span>
        </span>
      </div>
    </div>
    <!-- For the eyes only: the heading and the card's link already give
         screen readers the whole title. -->
    <span
      v-if="titleCut"
      class="title-tip pointer-events-none absolute inset-x-2.5 top-16 z-[1] rounded-chip bg-inverse px-3 py-2 text-small text-on-inverse shadow-card"
      aria-hidden="true"
      data-title-tip
    >{{ dish.title }}</span>
  </article>
</template>

<style scoped>
/* At most two lines, the second ending in "…". Below the second line the
   title is clipped 0.1em short of its box, not at it: with title-s's tight
   line height (1.16), Newsreader's accented capitals (Ä, Ö, Ü, É) reach
   above their line, so a third line starting with one used to show the tops
   of its accents under the second. The second line's descenders end 0.11em
   above the box, the third line's accents start 0.08–0.09em above it
   (measured at 19px), so the cut falls between them. Above and before the
   first line nothing is cut, so its own accents keep their tops. The lines
   cut off are clipped (not hidden), so that they don't make the lane
   scrollable either. Recheck these numbers if the font changes;
   dish-card-title.spec.ts catches a third line showing. */
.title {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: clip;
  overflow-clip-margin: 0.5em;
  clip-path: inset(-0.5em 0 0.1em -0.5em);
}

/* The full title of a cut one (handoff Toast colours): under the title,
   across the card, so it stays within the card unless the title is very
   long. It comes up after a short hover, so it doesn't flash while the mouse
   crosses the Board, and at once with keyboard focus; not while a Dish is
   being dragged. The pointer goes through it to "Gekocht ✓" under it. Until
   it shows it takes no room, so a long one doesn't make the lane scrollable. */
.title-tip {
  display: none;
}
@media (hover: hover) and (pointer: fine) {
  :where(article:hover) .title-tip {
    display: block;
    animation: tip-in var(--dur-fade) var(--ease-fade) 400ms backwards;
  }
}
:where(:focus-visible > article) .title-tip {
  display: block;
  animation: tip-in var(--dur-fade) var(--ease-fade) backwards;
}
.dragging article .title-tip {
  display: none;
}
@keyframes tip-in {
  from {
    opacity: 0;
    translate: 0 -4px;
  }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes tip-in {
    from {
      opacity: 0;
    }
  }
}

/* The "Neu" pebble: a butter-to-orange pebble, tilted like a sticker. It
   pops in from -20° just after the card has entered, and a ring pulses out
   of it every 3.2s until the card has been seen. Reduced motion: it is
   simply there, with no ring. */
.neu {
  border-radius: var(--radius-blob);
  background: var(--gradient-neu);
  box-shadow: var(--shadow-neu);
  rotate: -6deg;
}
.neu-pop {
  animation: neu-pop 560ms var(--ease-pop) 620ms backwards;
}
.neu-pulsing::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 2px solid var(--color-neu-accent);
  animation: neu-ring 3.2s var(--ease-fade) 1.2s infinite backwards;
}
@keyframes neu-pop {
  from {
    scale: 0;
    rotate: -20deg;
  }
}
@keyframes neu-ring {
  0% {
    scale: 1;
    opacity: .9;
  }
  40%, 100% {
    scale: 1.7;
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .neu-pop,
  .neu-pulsing::after {
    animation: none;
  }
  .neu-pulsing::after {
    display: none;
  }
}
</style>
