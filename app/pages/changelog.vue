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

// PROTOTYPE #392 (throwaway): A is the page as it is; B and C are Winnie's
// CL-a after the handoff, made malkochen's. Dev only, from ?cl=.
const route = useRoute()
const variant = computed(() => import.meta.dev ? p392Variant('changelog', route.query) : 'A')
const SECTION_MARK: Record<string, string> = { added: 'bg-butter', changed: 'bg-sky', removed: 'bg-carrot', fixed: 'bg-sage', security: 'bg-orchid' }
function copyLink(version: string) {
  try {
    void navigator.clipboard.writeText(`${location.origin}/changelog#changelog-${version}`)
  }
  catch {
    // The prototype: no clipboard, no harm.
  }
}

// Signed out, /api/me answers 401 and there's nothing to record.
const { data: me } = useMe()
// Typed as a plain string: Nitro's route typing runs too deep here.
const VERSION_SEEN: string = '/api/me/version-seen'
onMounted(async () => {
  if (!me.value?.newVersion) return
  me.value = await $fetch<Me>(VERSION_SEEN, { method: 'PUT' }).catch(() => me.value)
})
</script>

<template>
  <main
    v-if="variant === 'A'"
    class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10"
  >
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

  <main
    v-else
    class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10"
    :data-variant="variant"
  >
    <div class="mx-auto max-w-[1040px]">
      <header class="flex items-center gap-4">
        <NuxtLink
          to="/"
          :aria-label="t.changelog.back"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted"
        >
          <AppIcon
            name="back"
            :size="20"
          />
        </NuxtLink>
        <div class="flex min-w-0 flex-1 items-center gap-4">
          <div class="flex min-w-0 flex-col gap-2">
            <span class="w-fit rounded-chip bg-surface-muted px-2.5 py-1 text-caption text-text-muted">Versionen</span>
            <h1 class="font-display text-display-l tablet:text-display-xl">
              {{ t.changelog.title }}
            </h1>
          </div>
          <TopfbertIdle
            mood="happy"
            class="ml-auto w-[120px] shrink-0 tablet:w-[168px]"
          />
        </div>
      </header>

      <div
        v-if="variant === 'C'"
        class="sticky top-2 z-[1] mt-6 flex gap-2 overflow-x-auto rounded-pill bg-glass p-2 backdrop-blur-md"
      >
        <a
          v-if="changelog.unreleased.length"
          href="#"
          class="shrink-0 rounded-pill bg-butter px-4 py-2 text-button text-on-accent"
        >Gerade neu</a>
        <a
          v-for="(release, i) in changelog.versions"
          :key="release.version"
          href="#"
          class="shrink-0 rounded-pill px-4 py-2 text-button"
          :class="i === 0 ? 'bg-surface text-text' : 'text-text-muted'"
        >{{ release.version }}</a>
      </div>

      <div
        class="mt-8 grid gap-6"
        :class="variant === 'B' ? 'desktop:grid-cols-[200px_minmax(0,1fr)]' : ''"
      >
        <aside
          v-if="variant === 'B'"
          class="hidden desktop:block"
        >
          <nav class="sticky top-6 flex flex-col gap-1 rounded-card bg-surface p-3 shadow-card">
            <a
              v-if="changelog.unreleased.length"
              href="#"
              class="rounded-chip px-3 py-2 text-button text-text-muted"
            >Gerade neu</a>
            <a
              v-for="(release, i) in changelog.versions"
              :key="release.version"
              href="#"
              class="rounded-chip px-3 py-2 text-button"
              :class="i === 0 ? 'bg-butter text-on-accent' : 'text-text-muted'"
              :aria-current="i === 0 ? 'true' : undefined"
            >
              {{ release.version }}
              <span class="block text-caption opacity-80">{{ t.changelog.date(release.date) }}</span>
            </a>
          </nav>
        </aside>

        <div class="flex min-w-0 flex-col gap-6">
          <section
            v-for="(release, i) in changelog.versions"
            :key="release.version"
            class="flex flex-col gap-5 rounded-[28px] bg-surface p-6 shadow-card tablet:p-8"
            :aria-labelledby="`changelog-${release.version}`"
          >
            <div class="flex items-start gap-3">
              <div class="flex min-w-0 flex-1 flex-col gap-2">
                <div class="flex flex-wrap items-center gap-2">
                  <h2
                    :id="`changelog-${release.version}`"
                    class="font-display text-display-xl"
                  >
                    {{ release.version }}
                  </h2>
                  <span
                    v-if="i === 0"
                    class="rounded-pill bg-butter px-3 py-1 text-caption text-on-accent"
                  >Neueste</span>
                </div>
                <time
                  :datetime="release.date"
                  class="text-small text-text-muted"
                >{{ t.changelog.date(release.date) }}</time>
              </div>
              <button
                type="button"
                :aria-label="`Link zu Version ${release.version} kopieren`"
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted"
                @click="copyLink(release.version)"
              >
                <AppIcon
                  name="link"
                  :size="18"
                />
              </button>
            </div>
            <div
              v-for="section in release.sections"
              :key="section.kind"
              class="flex flex-col gap-2"
            >
              <h3 class="flex items-center gap-2 font-display text-title-s">
                <span
                  class="h-5 w-1.5 rounded-full"
                  :class="SECTION_MARK[section.kind]"
                />
                {{ t.changelog.sections[section.kind] }}
              </h3>
              <ul class="flex list-disc flex-col gap-1.5 pl-5 text-body">
                <li
                  v-for="entry in section.entries"
                  :key="entry"
                >
                  {{ entry }}
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  </main>
</template>
