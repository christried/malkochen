<script setup lang="ts">
// "Snackbert melden" under a Cooking in the Dish History (#424, decision 7 in
// #422: a pill). A pill in a butter wash with Snackbert thinking; once the
// viewer has reported the Cooking, plain muted text with his wink, "An
// Snackbert gemeldet ✓". Still a button then: it opens the report sheet
// again (a second helping), and says so to a screen reader.
defineProps<{ reported: boolean }>()
const t = useStrings()
</script>

<template>
  <button
    type="button"
    class="report flex items-center gap-1.5 self-start rounded-pill transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
    :class="reported ? 'px-1 py-0.5 text-caption text-text-muted' : 'is-open px-3 py-1.5 text-label'"
    :aria-label="reported ? t.snackbertReport.reportAgain : undefined"
    data-snackbert-report
    :data-reported="reported || undefined"
  >
    <img
      :src="reported ? '/snackbert/face.webp' : '/snackbert/face_think.webp'"
      alt=""
      :width="reported ? 20 : 24"
      :height="reported ? 20 : 24"
      :class="reported ? 'size-5' : 'size-6'"
    >
    {{ reported ? t.snackbertReport.reported : t.snackbertReport.report }}
  </button>
</template>

<style scoped>
/* Snackbert's butter wash, as his tiles in the report sheet have. */
.report.is-open {
  background: color-mix(in oklab, var(--color-butter) 30%, var(--color-surface-muted));
}
</style>
