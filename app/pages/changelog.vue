<script setup lang="ts">
import type { Me } from '~~/server/utils/people'
import { parseChangelog, type Changelog } from '~~/shared/changelog'
import type { Language } from '~~/shared/language'
import english from '~~/CHANGELOG.md?raw'
import german from '~~/CHANGELOG.de.md?raw'
import italian from '~~/CHANGELOG.it.md?raw'

// The Changelog (CONTEXT.md, #354, PRD #323 stories 1–10): what changed for
// users in each Version, newest first, in the viewer's language, with what's
// live but in no Version yet on top ("Gerade neu"). Built from the
// CHANGELOG files at the repo root when the app is built, so there's nothing
// to keep in step by hand. Public: the page guard lets anyone in, and the
// sign-in screen links here. Opened signed in, the app's Version is no
// longer new to you, so Your Settings drops its "Neu".

const CHANGELOGS: Record<Language, Changelog> = {
  en: parseChangelog(english),
  de: parseChangelog(german),
  it: parseChangelog(italian),
}

const t = useStrings()
const language = useLanguage()
const changelog = computed(() => CHANGELOGS[language.value])

useHead({ title: () => `${t.changelog.title} · ${t.app.name}` })

// Signed out, /api/me answers 401 and there's nothing to record.
const { data: me } = useMe()
const VERSION_SEEN: string = '/api/me/version-seen'
onMounted(async () => {
  if (!me.value?.newVersion) return
  me.value = await $fetch<Me>(VERSION_SEEN, { method: 'PUT' }).catch(() => me.value)
})
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
          {{ t.changelog.title }}
        </h1>
      </header>

      <p
        v-if="!changelog.unreleased.length && !changelog.versions.length"
        class="px-1 text-body text-text-muted"
      >
        {{ t.changelog.empty }}
      </p>

      <section
        v-if="changelog.unreleased.length"
        class="flex flex-col gap-4 rounded-card bg-surface-muted p-4"
        aria-labelledby="changelog-unreleased"
      >
        <h2
          id="changelog-unreleased"
          class="font-display text-title-m"
        >
          {{ t.changelog.unreleased }}
        </h2>
        <ChangelogSections :sections="changelog.unreleased" />
      </section>

      <section
        v-for="release in changelog.versions"
        :key="release.version"
        class="flex flex-col gap-4 rounded-card bg-surface-muted p-4"
        :aria-labelledby="`changelog-${release.version}`"
      >
        <div class="flex flex-wrap items-baseline gap-x-3">
          <h2
            :id="`changelog-${release.version}`"
            class="font-display text-title-m"
          >
            {{ t.changelog.version(release.version) }}
          </h2>
          <time
            :datetime="release.date"
            class="text-small text-text-muted"
          >{{ t.changelog.date(release.date) }}</time>
        </div>
        <ChangelogSections :sections="release.sections" />
      </section>
    </div>
  </main>
</template>
