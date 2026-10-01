<script setup lang="ts">
// A search that found nothing: the handoff's "search-empty" clip, a magnifier
// swinging over an empty plate while a pea peeks out, looping. A card, as the
// page behind it takes the Column's tint on phones.
defineProps<{ query: string }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center py-10 text-center"
    data-empty="search"
  >
    <div class="aspect-[22/17] w-[min(70vw,240px)] overflow-hidden rounded-card">
      <MotionClip
        src="/clips/search-empty"
        play
      />
    </div>
    <p class="mt-5 font-display text-title-s text-text">
      {{ t.search.noResultsTitle }}
    </p>
    <p class="mt-1 text-small text-text-muted">
      {{ t.search.noResultsBody(query) }}
    </p>
  </div>
</template>
