<script setup lang="ts">
// "Darstellung" as the handoff's segmented Input: equal segments in a pill,
// an ink thumb behind the chosen one that slides over when another is
// chosen (420ms, with a little overshoot). Reduced motion: it moves at once.
// The segments aren't `rounded-pill`, so they don't grow under the mouse.
// The new theme is revealed from the chosen segment (utils/theme-reveal.ts).
const t = useStrings()
const { preference, themes } = useTheme()
const chosen = computed(() => Math.max(0, themes.indexOf(preference.value)))

function choose(theme: ThemePreference, option: HTMLElement) {
  if (theme === preference.value) return
  const changes = themeShownFor(theme) !== themeShownFor(preference.value)
  revealTheme(option, changes, () => (preference.value = theme))
}
</script>

<template>
  <div
    class="relative grid rounded-pill bg-surface-muted p-1"
    :style="{ gridTemplateColumns: `repeat(${themes.length}, minmax(0, 1fr))`, '--chosen': chosen, '--count': themes.length }"
    role="radiogroup"
    :aria-label="t.theme.label"
  >
    <span
      aria-hidden="true"
      class="thumb absolute inset-y-1 left-1 rounded-pill bg-inverse"
    />
    <button
      v-for="theme in themes"
      :key="theme"
      type="button"
      role="radio"
      :aria-checked="preference === theme"
      class="relative rounded-[var(--radius-pill)] px-4 py-2.5 text-button transition-colors duration-fade ease-fade focus-visible:outline-2 focus-visible:outline-focus"
      :class="preference === theme ? 'text-on-inverse' : 'text-text'"
      @click="choose(theme, $event.currentTarget as HTMLElement)"
    >
      {{ t.theme[theme] }}
    </button>
  </div>
</template>

<style scoped>
.thumb {
  width: calc((100% - .5rem) / var(--count));
  translate: calc(var(--chosen) * 100%) 0;
  transition: translate 420ms var(--ease-pop);
}
@media (prefers-reduced-motion: reduce) {
  .thumb {
    transition: none;
  }
}
</style>
