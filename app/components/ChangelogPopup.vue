<script setup lang="ts">
import type { Me } from '~~/server/utils/people'
import { unseenReleases } from '~~/shared/changelog'

// The Changelog Popup (CONTEXT.md, #406, decided on #392: B): a centred card
// over the Board with Topfbert, "Was ist neu" and every Version newer than
// the one the user saw, newest first, in their language, from the same
// Changelog files the page uses ("Gerade neu" isn't in it). Closing it,
// whichever way, marks the Version as seen, as opening the Changelog does,
// so Your Settings' "Neu" goes too. "Alle Änderungen" opens the whole
// Changelog. BoardScreen decides when it is due and loads it lazily, so the
// Changelog files come with the popup, not with every Board. If there turns
// out to be nothing to list, it says so (`empty`), marks the Version as seen
// all the same, and shows nothing.
const emit = defineEmits<{ empty: [] }>()
const t = useStrings()
const language = useLanguage()
const { data: me } = useMe()

const releases = unseenReleases(changelogFor(language.value), me.value?.versionSeen ?? null)

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const done = useTemplateRef<HTMLButtonElement>('done')
const titleId = useId()
const open = ref(false)
useModalStack(open)

onMounted(() => {
  if (!releases.length) {
    void close()
    emit('empty')
    return
  }
  dialog.value?.showModal()
  open.value = true
  done.value?.focus()
})

// Typed as a plain string: Nitro's route typing runs too deep here.
const VERSION_SEEN: string = '/api/me/version-seen'
// Seen at once on this device, and for good on the server; if that fails, it
// shows again on the next visit.
async function close() {
  const el = dialog.value
  open.value = false
  if (el?.open) el.close()
  if (!me.value?.newVersion) return
  me.value = { ...me.value, newVersion: false, versionSeen: me.value.version }
  me.value = await $fetch<Me>(VERSION_SEEN, { method: 'PUT' }).catch(() => me.value)
}
</script>

<template>
  <dialog
    ref="dialog"
    class="popup m-auto max-h-[min(560px,80dvh)] w-[min(420px,calc(100%-32px))] overflow-hidden rounded-dialog border-0 bg-surface p-0 text-text shadow-dialog"
    :aria-labelledby="titleId"
    @cancel.prevent="close"
    @click.self="close"
  >
    <!-- The card itself: only the backdrop is the dialog's own, so a click
         on the dialog element is a click outside the card. -->
    <div class="flex max-h-[min(560px,80dvh)] flex-col gap-3.5 p-5">
    <div class="flex shrink-0 items-end gap-3">
      <TopfbertIdle
        mood="wow"
        class="w-[92px] shrink-0"
      />
      <h2
        :id="titleId"
        class="font-display text-title-m"
      >
        {{ t.changelog.title }}
      </h2>
    </div>
    <div class="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain">
      <section
        v-for="release in releases"
        :key="release.version"
        class="flex flex-col gap-3"
        :data-version="release.version"
      >
        <header class="flex flex-col">
          <h3 class="font-display text-title-s">
            {{ t.changelog.version(release.version) }}
          </h3>
          <p class="text-small text-text-muted">
            {{ t.changelog.date(release.date) }}
          </p>
        </header>
        <ChangelogSections :sections="release.sections" />
      </section>
    </div>
    <div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
      <NuxtLink
        to="/changelog"
        class="text-button text-text underline focus-visible:outline-2 focus-visible:outline-focus"
      >
        {{ t.changelog.popupAll }}
      </NuxtLink>
      <button
        ref="done"
        type="button"
        class="rounded-pill bg-butter px-5 py-2.5 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        @click="close"
      >
        {{ t.changelog.popupDone }}
      </button>
    </div>
    </div>
  </dialog>
</template>

<style scoped>
.popup::backdrop {
  background: var(--color-scrim);
}
.popup[open] {
  animation: popup-in var(--dur-settle) var(--ease-settle);
}
.popup[open]::backdrop {
  animation: scrim-in var(--dur-fade) var(--ease-fade);
}
@keyframes popup-in {
  from { opacity: 0; scale: .94; }
}
</style>
