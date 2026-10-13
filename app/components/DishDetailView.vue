<script setup lang="ts">
import type { BoardSummary } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'

// The Dish detail's contents: a large image, the title with the Creator
// under it, the note, the Source
// with "Original öffnen", where the Dish is (Board and Column), who added it
// and when, its Cooking History with "Gekocht ✓", "Verschieben nach…" and
// "Löschen". Scrolled past its image, a compact bar at the top keeps close,
// the title and "Bearbeiten" at hand (useDetailScroll).
const props = defineProps<{ dish: DishView, board: BoardSummary, columnName: string }>()
defineEmits<{
  close: []
  edit: []
  move: []
  delete: []
  cook: [origin: Point]
  note: [cooking: CookingView]
  deleteCooking: [cooking: CookingView]
}>()
const t = useStrings()

const added = computed(() => t.detail.added(props.dish.addedBy?.name ?? null, new Date(props.dish.createdAt)))

const { barShown, scrollDriven } = useDetailScroll(useTemplateRef('frame'), useTemplateRef('bar'))
</script>

<template>
  <div class="flex min-h-full flex-col">
    <!-- The compact bar sticks to the top of the detail, taking no room.
         Hidden, it is out of reach; shown, its close and "Bearbeiten" are
         the ones in view, the header's having scrolled away with the
         image. -->
    <div class="sticky top-0 z-[1] h-0">
      <div
        ref="bar"
        class="detail-bar absolute inset-x-0 top-0 flex items-center gap-3 bg-glass px-4 py-2 shadow-card backdrop-blur-md"
        data-detail-bar
        :data-shown="barShown || undefined"
        :inert="!barShown"
        :aria-hidden="!barShown || undefined"
      >
        <RoundButton
          :aria-label="t.detail.close"
          :data-tooltip="t.detail.close"
          @click="$emit('close')"
        >
          <AppIcon name="close" />
        </RoundButton>
        <p class="min-w-0 flex-1 truncate font-display text-title-s">
          {{ dish.title }}
        </p>
        <button
          type="button"
          class="shrink-0 rounded-pill bg-surface-muted px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="$emit('edit')"
        >
          {{ t.detail.edit }}
        </button>
      </div>
    </div>

    <div class="relative">
      <!-- Portrait (TikTok, Reels, Shorts) and landscape (blogs) both fill
           the frame; a tall image is cropped to at most 60% of the screen. -->
      <div
        ref="frame"
        class="detail-image aspect-[4/3] max-h-[60dvh] w-full overflow-hidden bg-surface-muted"
        :data-scroll-driven="scrollDriven || undefined"
        data-detail-image
        data-morph-field="image"
      >
        <div
          class="parallax h-full w-full"
          data-parallax
        >
          <DishImage
            :image-url="dish.imageUrl"
            :focus="dish.imageFocus"
            :placeholder="dish.placeholder"
            motion="loop"
          />
        </div>
      </div>
      <div
        class="absolute inset-x-0 top-0 flex justify-between p-4"
        data-detail-actions
        data-morph-field="actions"
      >
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-glass text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="t.detail.close"
          :data-tooltip="t.detail.close"
          @click="$emit('close')"
        >
          <AppIcon name="close" />
        </button>
        <button
          type="button"
          class="rounded-pill bg-glass px-4 py-2.5 text-button text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          data-edit
          @click="$emit('edit')"
        >
          {{ t.detail.edit }}
        </button>
      </div>
    </div>

    <div
      class="flex flex-1 flex-col gap-5 px-5 pb-10 pt-6 tablet:px-7"
      data-detail-body
    >
      <div
        class="flex flex-col gap-2"
        data-morph-field="title"
      >
        <p class="text-small text-text-muted">
          <span aria-hidden="true">{{ board.emoji }}</span> {{ t.detail.placement(board.name, columnName) }}
        </p>
        <h1 class="font-display text-title-l"
        >
          {{ dish.title }}
        </h1>
      </div>

      <!-- Its own morph field, so edit mode's Creator field morphs from it;
           as close under the title as the title's lines are to each other. -->
      <p
        v-if="dish.creator"
        class="-mt-3 break-words text-small text-text-muted"
        data-creator
        data-morph-field="creator"
      >
        <span class="sr-only">{{ `${t.dish.creator} ` }}</span>{{ dish.creator }}
      </p>

      <p
        v-if="dish.note"
        class="whitespace-pre-line text-body"
        data-morph-field="note"
      >
        {{ dish.note }}
      </p>

      <div
        v-if="dish.source"
        class="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface-muted p-3 pl-4"
        data-morph-field="source"
      >
        <SourceBadge :kind="dish.source.kind" />
        <a
          :href="dish.source.link"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-pill bg-inverse px-5 py-3 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {{ t.detail.openOriginal }}
        </a>
      </div>

      <p
        class="flex items-center gap-2 text-small text-text-muted"
        data-morph-field="added"
      >
        <UserAvatar
          v-if="dish.addedBy"
          :name="dish.addedBy.name"
          :image="dish.addedBy.image"
        />
        <span>{{ added }}</span>
      </p>

      <CookingHistory
        :dish="dish"
        data-morph-field="history"
        @cook="origin => $emit('cook', origin)"
        @note="cooking => $emit('note', cooking)"
        @delete="cooking => $emit('deleteCooking', cooking)"
      />

      <div
        class="mt-auto flex flex-wrap gap-3"
        data-morph-field="buttons"
      >
        <button
          type="button"
          class="rounded-pill bg-surface-muted px-5 py-3.5 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          aria-haspopup="dialog"
          data-move
          @click="$emit('move')"
        >
          {{ t.dish.moveTo }}
        </button>
        <DangerButton @click="$emit('delete')">
          {{ t.dish.delete }}
        </DangerButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The far end of the card → detail morph with View Transitions (utils/
   dish-morph.ts): only one detail shows at a time, so the name is unique.
   The parallax follows it scrolling away (its view timeline). */
.detail-image {
  view-transition-name: dish-image;
  view-timeline: --detail-image block;
}

/* Detail parallax (handoff motion.json "Detail parallax + bar"): from the
   top until the image has scrolled away, it moves half as fast as the
   content, fades to 60% and grows by 8%. Scroll-driven where the browser
   can; elsewhere from `--parallax` (useDetailScroll). */
.parallax {
  --parallax-drift: 50%;
  --parallax-fade: .4;
  --parallax-grow: .08;
  translate: 0 calc(var(--parallax, 0) * var(--parallax-drift));
  scale: calc(1 + var(--parallax, 0) * var(--parallax-grow));
  opacity: calc(1 - var(--parallax, 0) * var(--parallax-fade));
}
[data-scroll-driven] .parallax {
  animation: detail-parallax linear both;
  animation-timeline: --detail-image;
  animation-range: exit;
}
@keyframes detail-parallax {
  from { translate: 0 0; scale: 1; opacity: 1; }
  to {
    translate: 0 var(--parallax-drift);
    scale: calc(1 + var(--parallax-grow));
    opacity: calc(1 - var(--parallax-fade));
  }
}
/* Reduced motion: no parallax. */
@media (prefers-reduced-motion: reduce) {
  .parallax,
  [data-scroll-driven] .parallax {
    translate: none;
    scale: none;
    opacity: 1;
    animation: none;
  }
}

/* The compact bar settles in from above (settle), and goes back up. Reduced
   motion: it fades in and out. */
.detail-bar {
  translate: 0 -100%;
  opacity: 0;
  visibility: hidden;
  transition:
    translate var(--dur-settle) var(--ease-settle),
    opacity var(--dur-fade) var(--ease-fade),
    visibility 0s linear var(--dur-fade);
}
.detail-bar[data-shown] {
  translate: none;
  opacity: 1;
  visibility: visible;
  transition:
    translate var(--dur-settle) var(--ease-settle),
    opacity var(--dur-fade) var(--ease-fade);
}
</style>
