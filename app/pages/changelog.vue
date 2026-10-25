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
//
// Laid out as decided on #392 (B): a card per Version with a button that
// copies its link, the newest marked, and on desktop a rail of the Versions
// that follows the scroll.

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
// Typed as a plain string: Nitro's route typing runs too deep here.
const VERSION_SEEN: string = '/api/me/version-seen'
onMounted(async () => {
  if (!me.value?.newVersion) return
  me.value = await $fetch<Me>(VERSION_SEEN, { method: 'PUT' }).catch(() => me.value)
})

// One entry per card, in page order: what the rail lists and follows.
interface Entry { id: string, version?: string, date?: string }
const entries = computed<Entry[]>(() => [
  ...(changelog.value.unreleased.length ? [{ id: 'changelog-unreleased' }] : []),
  ...changelog.value.versions.map(r => ({ id: `changelog-${r.version}`, version: r.version, date: r.date })),
])
const current = ref<string>()
const currentId = computed(() => current.value ?? entries.value[0]?.id)

const origin = useRequestURL().origin
const toast = ref<Toast | null>(null)
async function copyLink(version: string) {
  try {
    await navigator.clipboard.writeText(`${origin}/changelog#changelog-${version}`)
    toast.value = { text: t.changelog.copied, duration: NOTICE_MS }
  }
  catch {
    toast.value = { text: t.changelog.copyFailed, duration: NOTICE_MS }
  }
}

function go(id: string, event: Event) {
  event.preventDefault()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  history.replaceState(null, '', `#${id}`)
  current.value = id
}

// The current card is the last whose top has passed the top 40% of the window.
let observer: IntersectionObserver | undefined
const passed = new Set<string>()
onMounted(() => {
  const named = entries.value.find(e => e.id === decodeURIComponent(location.hash.slice(1)))
  if (named) {
    document.getElementById(named.id)?.scrollIntoView({ behavior: 'auto', block: 'start' })
    current.value = named.id
  }
  observer = new IntersectionObserver((seen) => {
    for (const { target, isIntersecting, boundingClientRect } of seen) {
      // In the band or above it: passed. Below it: not yet.
      if (isIntersecting || boundingClientRect.top < 0) passed.add(target.id)
      else passed.delete(target.id)
    }
    const last = entries.value.filter(e => passed.has(e.id)).at(-1)
    if (last) current.value = last.id
  }, { rootMargin: '0px 0px -60% 0px', threshold: 0 })
  for (const entry of entries.value) {
    const el = document.getElementById(entry.id)
    if (el) observer.observe(el)
  }
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <main class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10">
    <div class="mx-auto max-w-[1040px]">
      <header class="flex items-center gap-3">
        <div class="flex min-w-0 flex-col items-start gap-4">
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
          <div class="flex flex-col items-start gap-2">
            <span class="rounded-pill bg-surface-muted px-3 py-1 text-caption text-text-muted">{{ t.changelog.eyebrow }}</span>
            <h1 class="font-display text-display-l tablet:text-display-xl">
              {{ t.changelog.title }}
            </h1>
          </div>
        </div>
        <TopfbertIdle
          mood="happy"
          class="ml-auto w-[120px] shrink-0 tablet:w-[168px]"
        />
      </header>

      <div class="mt-8 grid gap-6 desktop:grid-cols-[200px_minmax(0,1fr)]">
        <aside class="hidden desktop:block">
          <nav
            :aria-label="t.changelog.eyebrow"
            class="sticky top-6 flex flex-col gap-1 rounded-card bg-surface p-3 shadow-card"
          >
            <a
              v-for="entry in entries"
              :key="entry.id"
              :href="`#${entry.id}`"
              :aria-current="entry.id === currentId ? 'true' : undefined"
              class="flex flex-col gap-0.5 rounded-chip px-3 py-2 text-button focus-visible:outline-2 focus-visible:outline-focus"
              :class="entry.id === currentId ? 'bg-butter text-on-accent' : 'text-text-muted hover:text-text'"
              @click="go(entry.id, $event)"
            >
              <template v-if="entry.version">
                {{ entry.version }}
                <span class="text-caption">{{ t.changelog.date(entry.date!) }}</span>
              </template>
              <template v-else>
                {{ t.changelog.unreleased }}
              </template>
            </a>
          </nav>
        </aside>

        <div class="flex min-w-0 flex-col gap-6">
          <p
            v-if="!changelog.unreleased.length && !changelog.versions.length"
            class="px-1 text-body text-text-muted"
          >
            {{ t.changelog.empty }}
          </p>

          <section
            v-if="changelog.unreleased.length"
            id="changelog-unreleased"
            aria-labelledby="changelog-heading-unreleased"
            class="flex scroll-mt-6 flex-col gap-5 rounded-[28px] bg-surface p-6 shadow-card tablet:p-8"
          >
            <h2
              id="changelog-heading-unreleased"
              class="font-display text-title-l"
            >
              {{ t.changelog.unreleased }}
            </h2>
            <ChangelogSections :sections="changelog.unreleased" />
          </section>

          <section
            v-for="(release, index) in changelog.versions"
            :id="`changelog-${release.version}`"
            :key="release.version"
            :aria-labelledby="`changelog-heading-${release.version}`"
            class="flex scroll-mt-6 flex-col gap-5 rounded-[28px] bg-surface p-6 shadow-card tablet:p-8"
          >
            <div class="flex items-start gap-3">
              <div class="flex min-w-0 flex-col gap-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h2
                    :id="`changelog-heading-${release.version}`"
                    class="font-display text-display-xl"
                  >
                    <span class="sr-only">{{ t.changelog.versionPrefix }}</span>{{ release.version }}
                  </h2>
                  <span
                    v-if="index === 0"
                    class="rounded-pill bg-butter px-3 py-1 text-caption text-on-accent"
                  >{{ t.changelog.newest }}</span>
                </div>
                <time
                  :datetime="release.date"
                  class="text-small text-text-muted"
                >{{ t.changelog.date(release.date) }}</time>
              </div>
              <button
                type="button"
                :aria-label="t.changelog.copyLink(release.version)"
                :data-tooltip="t.changelog.copyLink(release.version)"
                class="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                @click="copyLink(release.version)"
              >
                <AppIcon
                  name="link"
                  :size="18"
                />
              </button>
            </div>
            <ChangelogSections :sections="release.sections" />
          </section>
        </div>
      </div>
    </div>
    <AppToast v-model="toast" />
  </main>
</template>
