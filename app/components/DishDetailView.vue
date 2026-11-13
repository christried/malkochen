<script setup lang="ts">
import type { BoardSummary } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'
import { videoEmbed, videoPill } from '~~/shared/video-embed'
import { allowedOnceSent } from '~/board/allowed-once-sent'
import type { CommentResult } from '~/board/dish-histories'
import type { VoteResult } from '~/board/dish-votes'

// The Dish detail's contents, in the handoff's order (#476): a large image,
// two chips (the Source, and where the Dish is: Board and Column), the
// title with the Creator and Caption under it, "Original öffnen" beside
// "Gekocht ✓", "Einplanen" (Week Plan, #518), "Link teilen" and "Kopieren"
// on one row, its Dish History ("Verlauf":
// who added it and when, its Cookings, Votes and Comments, the comment
// field), "Verschieben nach…" and "Löschen". Scrolled past its image, a compact bar
// at the top keeps close, the title and "Bearbeiten" at hand
// (useDetailScroll). Each action only for a Member it is allowed to
// (their Permissions): "Bearbeiten" with "edit Dishes", "Verschieben
// nach…", "Einplanen" and "Gekocht ✓" with "move Dishes", "Löschen" with "archive
// Dishes"; the last and the first also for a Dish they added themselves.
// "Link teilen" (Dish Link, #401) is for every Member who sees the Dish.
const props = defineProps<{ dish: DishView, board: BoardSummary, columnName: string }>()
const emit = defineEmits<{
  close: []
  edit: []
  // The Recipe's own edit mode (RecipeEditor), which the page opens.
  editRecipe: []
  move: []
  delete: []
  cook: [origin: Point]
  // "Einplanen": the page opens the day picker at the button.
  plan: [anchor: HTMLElement]
  // "Auf die Einkaufsliste" (#537): the page opens the Ingredient picker at
  // the button.
  putOn: [anchor: HTMLElement]
  deleteCooking: [cooking: CookingView]
  comment: [result: CommentResult]
  vote: [result: VoteResult]
  // "Kopieren": the Member picks another Board for a Copy (#402).
  copy: []
  // Something to tell the Member, as a Toast.
  notice: [text: string]
  // A Recipe arrived by itself while the Recipe was out of sight (#504): the
  // page says so in a Toast that scrolls to it.
  recipeFound: []
}>()
const t = useStrings()
const boardModule = useBoardModule()
const mayEdit = computed(() => boardModule.may('editDishes', props.dish.id))
const mayMove = computed(() => boardModule.may('moveDishes'))
const quietButton = 'flex min-w-0 items-center justify-center rounded-pill bg-surface-muted py-3.5 text-center text-button text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-focus'
// With "Einplanen" the row has three, so each gives up a little room.
const shareButton = computed(() => `${quietButton} ${mayMove.value ? 'gap-1.5 px-2' : 'gap-2 px-3'}`)
// Added offline and not sent yet (#462): sharing, copying and deleting wait
// for the server to have the Dish; they are greyed out like what needs a
// connection.
const onlyIfSent = computed(() => allowedOnceSent(boardModule, props.dish.id))
// While malkochen can't be reached (#458), the Dish is there to read: its
// changes are greyed out. "Bearbeiten" opens all the same (#460): the title
// can be changed offline, and the rest of its form is greyed out.
function edit() {
  emit('edit')
}

// "Link teilen": the Dish's Dish Link (made on the first share), then the
// phone's share sheet, or on a computer the link on the clipboard.
const origin = useRequestURL().origin
const sharing = ref(false)
async function shareLink() {
  if (sharing.value) return
  sharing.value = true
  try {
    const { path } = await $fetch<{ path: string }>(`/api/dishes/${props.dish.id}/link`, { method: 'POST' })
    const url = `${origin}${path}`
    if (typeof navigator.share === 'function' && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ title: props.dish.title, url })
      }
      catch (err) {
        // Closing the share sheet without sharing is no failure.
        if (!(err instanceof DOMException && err.name === 'AbortError')) throw err
      }
    }
    else {
      await navigator.clipboard.writeText(url)
      hapticConfirm()
      emit('notice', t.settings.copied)
    }
  }
  catch {
    emit('notice', t.detail.shareFailed)
  }
  finally {
    sharing.value = false
  }
}

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

// "Video abspielen" shows only for a video that plays in malkochen (#394, #395):
// the Dish says so, found when its Source was added or backfilled. Nothing is
// asked of Instagram when the detail opens (#279's per-open check is gone), so
// a Dish whose value is not known yet shows no button.
// What the pill on the image offers: the player, or nothing.
const videoAction = computed(() => playing.value ? null : videoPill(props.dish))
const pillClass = 'absolute bottom-4 left-4 flex items-center gap-2 rounded-pill bg-glass py-2.5 pl-3.5 pr-4 text-button text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
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
          v-if="mayEdit"
          type="button"
          class="shrink-0 rounded-pill bg-surface-muted px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="edit"
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
          v-if="mayEdit"
          type="button"
          class="rounded-pill bg-glass px-4 py-2.5 text-button text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          data-edit
          @click="edit"
        >
          {{ t.detail.edit }}
        </button>
      </div>
      <button
        v-if="videoAction === 'play'"
        type="button"
        :class="pillClass"
        data-play-video
        @click="playing = true"
      >
        <AppIcon name="play" />
        {{ t.detail.playVideo }}
      </button>
    </div>

    <div
      class="flex flex-1 flex-col gap-5 px-5 pb-10 pt-6 tablet:px-7"
      data-detail-body
    >
      <div
        class="flex flex-col gap-2"
        data-morph-field="title"
      >
        <!-- Chips above the title: the Source, then where the Dish is. They
             wrap, and a long Board name breaks inside its chip. -->
        <div
          class="flex flex-wrap gap-2"
          data-detail-chips
        >
          <SourceBadge
            v-if="dish.source"
            :kind="dish.source.kind"
            chip
          />
          <p class="min-w-0 rounded-chip bg-surface-muted px-2.5 py-1.5 text-caption text-text [overflow-wrap:anywhere]">
            <span aria-hidden="true">{{ board.emoji }}</span> {{ t.detail.placement(board.name, columnName) }}
          </p>
        </div>
        <h1 class="font-display text-title-l">
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

      <!-- Nothing in its place without a Caption (#393). -->
      <DishCaption
        v-if="dish.caption"
        :caption="dish.caption"
      />

      <!-- The action row, right under the title, so a Cooking needs no
           scrolling (#476): "Original öffnen" takes the width "Gekocht ✓"
           leaves. Without a link "Gekocht ✓" stands alone at the row's
           start; without "move Dishes" the link has the row; with neither
           there is no row. Edit mode's Source field morphs from it. -->
      <div
        v-if="dish.source || mayMove"
        class="flex items-stretch gap-2.5"
        data-main-actions
        data-morph-field="source"
      >
        <a
          v-if="dish.source"
          :href="dish.source.link"
          target="_blank"
          rel="noopener noreferrer"
          class="flex min-w-0 flex-1 items-center justify-center rounded-pill bg-inverse px-5 py-3.5 text-center text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {{ t.detail.openOriginal }}
        </a>
        <!-- The detail's only "Gekocht ✓", always sage: the main action. -->
        <CookButton
          v-if="mayMove"
          class="shrink-0 px-5 py-3.5"
          filled
          @cook="origin => $emit('cook', origin)"
        />
      </div>

      <!-- Under the action row, on a phone and in the desktop panel alike:
           "Link teilen" and "Kopieren" (#402, a Copy on another of the
           user's Boards), two equal, quiet buttons on one row (#476). With
           "move Dishes", "Einplanen" (#518) comes first: it opens the day
           picker, and the detail itself shows nothing of the plan. It works
           offline (an Unsent Change) once the Dish has been sent. -->
      <div
        class="grid gap-2"
        :class="mayMove ? 'grid-cols-3' : 'grid-cols-2'"
        data-share-actions
      >
        <NeedsNet
          v-if="mayMove"
          :note="false"
          :allowed="!boardModule.isUnsentAdd(dish.id)"
        >
          <button
            type="button"
            :class="shareButton"
            aria-haspopup="dialog"
            data-plan-dish
            @click="emit('plan', $event.currentTarget as HTMLElement)"
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
              class="shrink-0"
            ><rect
              x="4"
              y="5"
              width="16"
              height="15"
              rx="3"
            /><path d="M4 10h16M9 3v4M15 3v4M12 13v5M9.5 15.5h5" /></svg>
            {{ t.week.plan }}
          </button>
        </NeedsNet>
        <NeedsNet
          :note="false"
          :allowed="onlyIfSent"
        >
          <button
            type="button"
            :class="shareButton"
            :disabled="sharing"
            data-share-link
            @click="shareLink"
          >
            <AppIcon
              name="link"
              class="shrink-0"
            />
            {{ t.settings.shareLink }}
          </button>
          <button
            type="button"
            :class="shareButton"
            data-copy-dish
            @click="emit('copy')"
          >
            <AppIcon
              name="copy"
              class="shrink-0"
            />
            {{ t.detail.copy }}
          </button>
        </NeedsNet>
      </div>

      <!-- The Recipe (#496), after the share row, so the actions above it
           never move and it starts in the same place on every Dish. Its
           Zutaten card ends with "Auf die Einkaufsliste" (#537). -->
      <RecipeSection
        :dish="dish"
        :may-edit="mayEdit"
        :unsent="boardModule.hasUnsentRecipe(dish.id)"
        @edit="emit('editRecipe')"
        @found="emit('recipeFound')"
        @put-on="anchor => emit('putOn', anchor)"
      />

      <DishHistory
        :dish="dish"
        :board-id="board.id"
        :is-owner="board.isOwner"
        data-morph-field="history"
        @delete-cooking="cooking => $emit('deleteCooking', cooking)"
        @comment="result => $emit('comment', result)"
        @vote="result => $emit('vote', result)"
      />

      <div
        class="mt-auto flex flex-wrap gap-3"
        data-morph-field="buttons"
      >
        <NeedsNet :note="false">
          <button
            v-if="mayMove"
            type="button"
            class="rounded-pill bg-surface-muted px-5 py-3.5 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            aria-haspopup="dialog"
            data-move
            @click="$emit('move')"
          >
            {{ t.dish.moveTo }}
          </button>
        </NeedsNet>
        <!-- A Dish added offline can't be deleted until it has arrived. -->
        <NeedsNet
          :note="false"
          :allowed="onlyIfSent"
        >
          <DangerButton
            v-if="boardModule.may('archiveDishes', dish.id)"
            @click="$emit('delete')"
          >
            {{ t.dish.delete }}
          </DangerButton>
        </NeedsNet>
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
