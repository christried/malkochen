<script setup lang="ts">
// The links that end a page: "Was ist neu" (the Changelog, #354) beside the
// legal pages. In the sign-in screen's footer and at the end of the Board, so
// the two can't drift.
const t = useStrings()
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-x-2">
    <NuxtLink
      to="/changelog"
      class="inline-flex min-h-11 items-center rounded-chip px-2 text-small text-text-muted underline-offset-4 transition-colors duration-fade ease-fade hover:text-text hover:underline focus-visible:text-text focus-visible:outline-2 focus-visible:outline-focus"
    >{{ t.changelog.title }}</NuxtLink>
    <LegalLinks class="justify-center" />
  </div>
</template>
