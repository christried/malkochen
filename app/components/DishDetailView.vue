<script setup lang="ts">
import type { BoardSummary } from '~~/server/utils/boards'
import type { CookingView } from '~~/server/utils/cookings'
import type { DishView } from '~~/server/utils/dishes'

// The Dish detail's contents: a large image, the title and note, the Source
// with "Original öffnen", where the Dish is (Board and Column), who added it
// and when, its Cooking History with "Gekocht ✓", and "Löschen".
const props = defineProps<{ dish: DishView, board: BoardSummary, columnName: string }>()
defineEmits<{
  close: []
  edit: []
  delete: []
  cook: []
  note: [cooking: CookingView]
  deleteCooking: [cooking: CookingView]
}>()
const t = useStrings()

const added = computed(() => t.detail.added(props.dish.addedBy?.name ?? null, new Date(props.dish.createdAt)))
</script>

<template>
  <div class="flex min-h-full flex-col">
    <div class="relative">
      <!-- Portrait (TikTok, Reels, Shorts) and landscape (blogs) both fill
           the frame; a tall image is cropped to at most 60% of the screen. -->
      <div class="aspect-[4/3] max-h-[60dvh] w-full overflow-hidden bg-surface-muted">
        <DishImage
          :image-url="dish.imageUrl"
          :placeholder="dish.placeholder"
        />
      </div>
      <div class="absolute inset-x-0 top-0 flex justify-between p-4">
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center rounded-full bg-glass text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="t.detail.close"
          @click="$emit('close')"
        >
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            aria-hidden="true"
          ><path d="M6 6l12 12M18 6L6 18" /></svg>
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

    <div class="flex flex-1 flex-col gap-5 px-5 pb-10 pt-6 tablet:px-7">
      <div class="flex flex-col gap-2">
        <p class="text-small text-text-muted">
          <span aria-hidden="true">{{ board.emoji }}</span> {{ t.detail.placement(board.name, columnName) }}
        </p>
        <h1 class="font-display text-title-l"
        >
          {{ dish.title }}
        </h1>
      </div>

      <p
        v-if="dish.note"
        class="whitespace-pre-line text-body"
      >
        {{ dish.note }}
      </p>

      <div
        v-if="dish.source"
        class="flex flex-wrap items-center justify-between gap-3 rounded-panel bg-surface-muted p-3 pl-4"
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

      <p class="flex items-center gap-2 text-small text-text-muted">
        <UserAvatar
          v-if="dish.addedBy"
          :name="dish.addedBy.name"
          :image="dish.addedBy.image"
        />
        <span>{{ added }}</span>
      </p>

      <CookingHistory
        :dish="dish"
        @cook="$emit('cook')"
        @note="cooking => $emit('note', cooking)"
        @delete="cooking => $emit('deleteCooking', cooking)"
      />

      <DangerButton
        class="mt-auto self-start"
        @click="$emit('delete')"
      >
        {{ t.dish.delete }}
      </DangerButton>
    </div>
  </div>
</template>
