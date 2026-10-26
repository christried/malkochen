<script setup lang="ts">
import { datenschutz } from '~~/app/legal/datenschutz'
import { isLanguage, type Language } from '~~/shared/language'

// The Datenschutz (#391): one text at a time, the one the reader asks for with
// ?lang=de|en|it, else in their language (useLanguage). The German text alone
// is binding; the switcher and the link back to it are how to read the others.
const t = useStrings()
const route = useRoute()
const language = useLanguage()

const NAMES: Record<Language, string> = { de: 'Deutsch', en: 'English', it: 'Italiano' }

const chosen = computed<Language>(() => isLanguage(route.query.lang) ? route.query.lang : language.value)
const shown = computed(() => datenschutz.find(text => text.language === chosen.value)!)

useHead({ title: () => `${shown.value.title} · ${t.app.name}` })
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
          {{ shown.title }}
        </h1>
      </header>

      <nav
        :aria-label="t.legal.languages"
        class="flex flex-wrap gap-3 text-small"
      >
        <NuxtLink
          v-for="text in datenschutz"
          :key="text.language"
          :to="`?lang=${text.language}`"
          replace
          :aria-current="text.language === shown.language ? 'page' : undefined"
          :class="[
            'inline-flex min-h-11 items-center rounded-chip px-2 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-focus',
            text.language === shown.language ? 'bg-surface-muted text-text' : 'text-text-muted',
          ]"
        >{{ NAMES[text.language] }}</NuxtLink>
      </nav>

      <div class="flex flex-col gap-3 rounded-card bg-surface-muted p-4">
        <p class="text-body">
          {{ shown.note }}
        </p>
        <NuxtLink
          v-if="!shown.binding"
          to="?lang=de"
          replace
          class="inline-flex min-h-11 items-center self-start text-body underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-focus"
        >{{ t.legal.bindingVersion }}</NuxtLink>
      </div>

      <article
        :id="shown.language"
        :lang="shown.language"
        class="flex scroll-mt-6 flex-col gap-8"
      >
        <LegalSections :sections="shown.sections" />
      </article>
    </div>
  </main>
</template>
