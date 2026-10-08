<script setup lang="ts">
// A search that found nothing: the handoff's "search-empty" clip, a magnifier
// swinging over an empty plate while a pea peeks out, looping. Drawn in code
// (SvgLoop), its still is the loop's frame 0. No background of its own: it
// sits on the page, whose tint follows the Column on phones (#180).
defineProps<{ query: string }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center py-10 text-center"
    data-empty="search"
  >
    <div class="aspect-[22/17] w-[min(70vw,240px)]">
      <SvgLoop
        src="/clips/search-empty"
        play
        transparent
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
