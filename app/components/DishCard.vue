<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'
import type { ClipMotion } from '~/utils/motion'

// The handoff's compact DishCard: 86px thumb + text, 128px high. The thumb
// crops any image, portrait (TikTok, Reels, Shorts) or landscape (blogs), to
// fill it. The Board puts the "…" menu button in its top-right corner and
// "Gekocht ✓" in its bottom-right one, so the title and the line below leave
// room for them. A New Dish wears the "Neu" pebble on the thumb's corner.
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
      <h3 class="line-clamp-2 pr-8 font-display text-title-s">
        {{ dish.title }}
      </h3>
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
        <span
          v-if="dish.cookings.length"
          class="truncate text-caption"
          data-cooked-count
        >{{ t.dish.cookedCount(dish.cookings.length) }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
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
