<script setup lang="ts">
import { datenschutz } from '~~/app/legal/datenschutz'

// The Datenschutz (#391): the German text, which alone is binding, then the
// English and the Italian translations, all three readable signed out.
const t = useStrings()

const NAMES: Record<string, string> = { de: 'Deutsch', en: 'English', it: 'Italiano' }

useHead({ title: () => `${datenschutz[0]!.title} · ${t.app.name}` })
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
          {{ datenschutz[0]!.title }}
        </h1>
      </header>

      <nav
        aria-label="Sprachen"
        class="flex flex-wrap gap-3 text-small"
      >
        <a
          v-for="text in datenschutz"
          :key="text.language"
          :href="`#${text.language}`"
          class="inline-flex min-h-11 items-center rounded-chip px-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus"
        >{{ NAMES[text.language] }}</a>
      </nav>

      <article
        v-for="text in datenschutz"
        :id="text.language"
        :key="text.language"
        class="flex scroll-mt-6 flex-col gap-8"
      >
        <div class="flex flex-col gap-1 rounded-card bg-surface-muted p-4">
          <p class="text-small text-text-muted">
            {{ NAMES[text.language] }}<template v-if="text.binding"> · verbindlich</template>
          </p>
          <p class="text-body">
            {{ text.note }}
          </p>
        </div>
        <LegalSections :sections="text.sections" />
      </article>
    </div>
  </main>
</template>
