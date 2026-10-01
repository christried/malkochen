<script setup lang="ts">
// The still of the handoff's "offline" clip (frame 40): sleeping Topfbert on
// a sky blob, beside a Wi-Fi sign whose two outer arcs have faded. The arcs
// are inline so they take the text colour in either theme. public/offline.html
// draws the same picture for the service worker.
</script>

<template>
  <div class="absolute inset-[6%] rounded-blob bg-[color-mix(in_oklch,var(--color-sky)_28%,var(--color-bg))]" />
  <img
    src="/illustrations/topfbert-sleep.svg"
    alt=""
    class="absolute bottom-[4%] left-[12%] w-[56%] saturate-[.4]"
  >
  <svg
    viewBox="0 0 64 64"
    aria-hidden="true"
    class="absolute right-[10%] top-[10%] w-[26%] text-text"
  >
    <path
      d="M8 26A34 34 0 0 1 56 26"
      fill="none"
      stroke="currentColor"
      stroke-width="5"
      stroke-linecap="round"
      opacity=".12"
    />
    <path
      d="M17 36A21 21 0 0 1 47 36"
      fill="none"
      stroke="currentColor"
      stroke-width="5"
      stroke-linecap="round"
      opacity=".12"
    />
    <path
      d="M26 46A8 8 0 0 1 38 46"
      fill="none"
      stroke="currentColor"
      stroke-width="5"
      stroke-linecap="round"
    />
    <circle
      cx="32"
      cy="54"
      r="3.5"
      fill="currentColor"
    />
  </svg>
</template>
