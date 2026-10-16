<script setup lang="ts">
import type { BoardSummary } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'
import { videoEmbed } from '~~/shared/video-embed'

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

// Click-to-play video (#221): a TikTok, YouTube Short or Instagram Dish shows
// its image with "Video abspielen"; tapping it puts the platform's player in
// the image's place (DishVideo). Nothing from the platform loads before. The
// detail closing takes the player with it; another Dish starts with its
// image again.
const video = computed(() => videoEmbed(props.dish.source))
const playing = ref(false)
const player = computed(() => playing.value ? video.value : null)
watch(() => video.value?.src, () => playing.value = false)

// Some Reels Instagram's embed only shows with "Auf Instagram ansehen"
// (#279): for those the detail links to the post instead of offering a
// player that would only send the Member to Instagram. The server asks
// Instagram as the detail opens, so a post Instagram changes its mind about
// is never stuck either way. Until it answers there is no button; when it
// can't tell, "Video abspielen" as before.
const instagramLink = computed(() => video.value?.platform === 'instagram' ? video.value.link : null)
const playsInPlace = ref<boolean | null | undefined>()
watch(instagramLink, async (link, _, onCleanup) => {
  playsInPlace.value = undefined
  if (!link || import.meta.server) return
  let stale = false
  onCleanup(() => stale = true)
  const answer = await $fetch<{ playsInPlace: boolean | null }>('/api/instagram-plays', { query: { link } })
    .then(({ playsInPlace }) => playsInPlace, () => null)
  if (!stale) playsInPlace.value = answer
}, { immediate: true })
const offer = computed<'play' | 'instagram' | null>(() => {
  if (!video.value || playing.value) return null
  if (!instagramLink.value) return 'play'
  if (playsInPlace.value === undefined) return null
  return playsInPlace.value === false ? 'instagram' : 'play'
})
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
           the frame; a tall image is cropped to at most 60% of the screen.
           Playing, the frame holds the player under the buttons instead
           (their row: 44px with 16px around, 4.75rem), as tall as the
           player is. -->
      <div
        ref="frame"
        class="detail-image w-full overflow-hidden bg-surface-muted"
        :class="player ? 'pb-4 pt-[4.75rem]' : 'aspect-[4/3] max-h-[60dvh]'"
        :data-scroll-driven="scrollDriven || undefined"
        data-detail-image
        data-morph-field="image"
      >
        <DishVideo
          v-if="player"
          :embed="player"
        />
        <div
          v-else
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
      <button
        v-if="offer === 'play'"
        type="button"
        class="absolute bottom-4 left-4 flex items-center gap-2 rounded-pill bg-glass py-2.5 pl-3.5 pr-4 text-button text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        data-play-video
        @click="playing = true"
      >
        <AppIcon name="play" />
        {{ t.detail.playVideo }}
      </button>
      <a
        v-else-if="offer === 'instagram' && video"
        :href="video.link"
        target="_blank"
        rel="noopener noreferrer"
        class="absolute bottom-4 left-4 flex items-center gap-2 rounded-pill bg-glass py-2.5 pl-3.5 pr-4 text-button text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        data-play-video
      >
        <AppIcon name="play" />
        {{ t.detail.watchOnInstagram }}
      </a>
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

      <!-- Who added it opens their popover (#213), picture and line alike. -->
      <div
        class="flex text-small text-text-muted"
        data-morph-field="added"
      >
        <PersonPopover
          v-if="dish.addedBy"
          :person="dish.addedBy"
          :board-id="board.id"
          class="-mx-2 -my-1 flex items-center gap-2 rounded-pill px-2 py-1 text-left transition-colors duration-tap ease-tap hover:bg-surface-muted hover:text-text focus-visible:outline-2 focus-visible:outline-focus"
          data-added
        >
          <UserAvatar
            :name="dish.addedBy.name"
            :image="dish.addedBy.image"
          />
          <span>{{ added }}</span>
        </PersonPopover>
        <p
          v-else
          data-added
        >
          {{ added }}
        </p>
      </div>

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
