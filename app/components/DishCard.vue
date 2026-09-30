<script setup lang="ts">
import type { DishView } from '~~/server/utils/dishes'

// The handoff's compact DishCard: 86px thumb + text, 128px high. The Source
// badge, "N× gekocht", "Neu" and the card's actions come with later tickets.
defineProps<{ dish: DishView }>()
const t = useStrings()
</script>

<template>
  <article
    class="flex h-32 gap-3 rounded-card bg-surface p-2.5 text-text shadow-card"
    :aria-label="dish.title"
  >
    <div class="relative w-[86px] shrink-0 overflow-hidden rounded-thumb bg-surface-muted">
      <PlaceholderStill :placeholder="dish.placeholder" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col py-1 pr-1">
      <h3 class="line-clamp-2 font-display text-title-s">
        {{ dish.title }}
      </h3>
      <div class="mt-auto flex items-center gap-2 text-text-muted">
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
  </article>
</template>
