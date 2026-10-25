<script setup lang="ts">
import { impressum } from '~~/app/legal/impressum'

// The Impressum (#391): German only, readable signed out (middleware/auth.global.ts).
const t = useStrings()

useHead({ title: () => `${impressum.title} · ${t.app.name}` })
</script>

<template>
  <main class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10">
    <div class="mx-auto flex max-w-[720px] flex-col gap-8">
      <header class="flex items-center gap-3">
        <NuxtLink
          to="/"
          :aria-label="t.changelog.back"
          :data-tooltip="t.changelog.back"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <AppIcon
            name="back"
            :size="20"
          />
        </NuxtLink>
        <h1 class="font-display text-title-l tablet:text-display-m">
          {{ impressum.title }}
        </h1>
      </header>

      <LegalSections :sections="impressum.sections" />
    </div>
  </main>
</template>
