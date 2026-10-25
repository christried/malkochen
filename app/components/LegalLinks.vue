<script setup lang="ts">
// "Impressum" and "Datenschutz" side by side (utils/legal.ts), small and
// muted: in the sign-in screen's footer, on the Username page and at the end
// of the Board (AppFooterLinks). Each opens in a new tab, so the app stays
// where it was.
const t = useStrings()
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-2 text-small text-text-muted">
    <a
      v-for="link in LEGAL_LINKS"
      :key="link.label"
      :href="link.href"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex min-h-11 items-center rounded-chip px-2 underline-offset-4 transition-colors duration-fade ease-fade hover:text-text hover:underline focus-visible:text-text focus-visible:outline-2 focus-visible:outline-focus"
    >{{ t.legal[link.label] }}</a>
  </div>
</template>
