<script setup lang="ts">
// A search that found nothing: the still of the handoff's "search-empty"
// clip, its magnifier (assets/shapes/magnifier.svg) tilted over its empty
// plate (plate.svg), on the clip's blue-grey (motion.json "Search empty").
// The shapes are drawn here rather than loaded, so they take the theme's
// ink and surface. The loop comes with #23.
defineProps<{ query: string }>()
const t = useStrings()
</script>

<template>
  <div
    class="flex flex-col items-center py-10 text-center"
    data-empty="search"
  >
    <div class="search-empty-stage flex w-[min(70vw,240px)] justify-center rounded-card py-5">
      <svg
        viewBox="0 0 132 102"
        class="w-[80%] text-text"
        aria-hidden="true"
      >
        <ellipse
          cx="66"
          cy="80"
          rx="54"
          ry="18"
          class="fill-surface"
          stroke="currentColor"
          stroke-width="2.5"
        />
        <ellipse
          cx="66"
          cy="78"
          rx="36"
          ry="10"
          fill="none"
          stroke="currentColor"
          stroke-opacity=".18"
          stroke-width="2"
        />
        <g transform="translate(22 6) rotate(-10 32 32)">
          <circle
            cx="27"
            cy="27"
            r="17"
            class="fill-surface"
            fill-opacity=".6"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            d="M40 40L56 56"
            stroke="currentColor"
            stroke-width="6"
            stroke-linecap="round"
          />
        </g>
      </svg>
    </div>
    <p class="mt-5 font-display text-title-s text-text">
      {{ t.search.noResultsTitle }}
    </p>
    <p class="mt-1 text-small text-text-muted">
      {{ t.search.noResultsBody(query) }}
    </p>
  </div>
</template>

<style scoped>
/* The clip's background: light #DCE3F0, dark #1F2530 (sky into the page). */
.search-empty-stage {
  background: color-mix(in oklch, var(--color-sky) 38%, var(--color-bg));
}
</style>
