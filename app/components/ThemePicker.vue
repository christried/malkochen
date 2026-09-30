<script setup lang="ts">
const t = useStrings()
const { preference, themes } = useTheme()
</script>

<template>
  <div
    class="flex gap-2"
    role="radiogroup"
    :aria-label="t.theme.label"
  >
    <button
      v-for="theme in themes"
      :key="theme"
      type="button"
      role="radio"
      :aria-checked="preference === theme"
      class="rounded-pill px-4 py-2.5 text-button transition-colors duration-fade ease-fade focus-visible:outline-2 focus-visible:outline-focus"
      :class="preference === theme ? 'bg-inverse text-on-inverse' : 'bg-surface-muted text-text'"
      @click="preference = theme"
    >
      {{ t.theme[theme] }}
    </button>
  </div>
</template>
