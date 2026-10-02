<script setup lang="ts">
// Three dots that say "under way" (handoff components.json: Button "loading
// (3 dots)", Input "loading (dots)"), drawn in the text colour. They rise and
// brighten one after the other; with reduced motion they stand still. What
// is under way is said by the label or status next to them, not the dots.
</script>

<template>
  <span
    class="inline-flex items-center gap-1"
    aria-hidden="true"
    data-loading-dots
  >
    <span class="dot size-1.5 rounded-full bg-current" />
    <span class="dot size-1.5 rounded-full bg-current" />
    <span class="dot size-1.5 rounded-full bg-current" />
  </span>
</template>

<style scoped>
/* The lookup clip's stir pace (1.2s, motion.json "Lookup: Topfbert stirs"),
   each dot a little after the last. Before its turn a dot waits dimmed
   (backwards fill). Reduced motion (main.css) ends the animation at once,
   which leaves all three dots plainly there. */
.dot {
  animation: dot 1.2s var(--ease-idle) infinite backwards;
}
.dot:nth-child(2) { animation-delay: 160ms; }
.dot:nth-child(3) { animation-delay: 320ms; }
@keyframes dot {
  0%, 60%, 100% {
    opacity: .35;
    translate: 0 0;
  }
  30% {
    opacity: 1;
    translate: 0 -40%;
  }
}
</style>
