<script setup lang="ts">
const t = useStrings()
const { preference, themes } = useTheme()
</script>

<template>
  <main class="min-h-dvh bg-bg text-text px-5 py-10 tablet:px-10 desktop:px-16">
    <p class="text-overline uppercase text-text-muted">
      {{ t.app.name }}
    </p>
    <h1 class="mt-3 font-display text-display-m tablet:text-display-l desktop:text-display-xl">
      {{ t.home.headline }}
    </h1>
    <p class="mt-4 text-body text-text-muted">
      {{ t.home.intro }}
    </p>

    <section
      class="mt-8 max-w-md rounded-card bg-surface p-5 shadow-card"
      data-testid="token-card"
    >
      <h2 class="font-display text-title-s">
        {{ t.theme.label }}
      </h2>
      <div
        class="mt-4 flex gap-2"
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
    </section>
  </main>
</template>
