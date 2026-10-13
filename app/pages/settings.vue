<script setup lang="ts">
import type { Me } from '~~/server/utils/people'
import { PHOTO_ACCEPT } from '~~/shared/photo'
import { photoUploadTo, type PhotoProblem, type UploadedPhoto } from '~/composables/usePhotoUpload'

// Your own settings (PRD stories 73–75): the Google account you're signed in
// with and your Profile Picture, Darstellung, a place kept for Sprache
// (German only for now), the Board's keyboard shortcuts and signing out.
// Reached from your photo on the Board (on phones, from the Board switcher).
const t = useStrings()
const { signOut } = useAuth()

const { data: me } = await useMe()

// Your own Profile Picture: a picked photo is uploaded (checked, cut square
// and cleaned by the server) and shown round in a preview; only "Übernehmen"
// makes it yours, for every Member. Removed, your Google photo is back.
const pictureUpload = usePhotoUpload()
const { uploading } = pictureUpload
const problem = ref<PhotoProblem | null>(null)
const problemMessage = computed(() => problem.value && photoProblemMessage(t, problem.value))

// The uploaded picture the preview shows. Kept after closing, so the sheet
// moves out with it; the next upload replaces it.
const previewed = ref<UploadedPhoto | null>(null)
const saving = ref(false)
const previewShown = ref(false)
// Once "Übernehmen" is under way, it can't be called off: the preview stays
// until it is done.
const previewOpen = computed({
  get: () => previewShown.value,
  set: (open) => {
    if (!saving.value) previewShown.value = open
  },
})
// Picking, uploading or saving: one thing at a time.
const busy = computed(() => uploading.value || saving.value)

async function pickPicture(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Picking the same file again must still count.
  input.value = ''
  if (!file) return
  problem.value = null
  const uploaded = await pictureUpload.upload(photoUploadTo.picture(), file)
  problem.value = pictureUpload.problem.value
  if (!uploaded) return
  previewed.value = uploaded
  previewShown.value = true
}

// Typed as a plain string: Nitro's route typing runs too deep here.
const OWN_PICTURE: string = '/api/me/picture'

async function changePicture(change: () => Promise<Me>) {
  if (saving.value) return
  saving.value = true
  problem.value = null
  try {
    me.value = await change()
  }
  catch {
    problem.value = 'failed'
  }
  finally {
    saving.value = false
    previewShown.value = false
  }
}

function usePicture() {
  const picture = previewed.value
  if (!picture || !previewShown.value) return
  return changePicture(() => $fetch<Me>(OWN_PICTURE, { method: 'PUT', body: picture }))
}

function removePicture() {
  return changePicture(() => $fetch<Me>(OWN_PICTURE, { method: 'DELETE' }))
}

useHead({ title: () => `${t.userSettings.title} · ${t.app.name}` })
</script>

<template>
  <main class="min-h-dvh bg-bg px-4 pb-32 pt-6 text-text tablet:px-10">
    <div class="mx-auto flex max-w-[560px] flex-col gap-8">
      <header class="flex items-center gap-3">
        <NuxtLink
          to="/"
          :aria-label="t.userSettings.back"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        >
          <AppIcon
            name="back"
            :size="20"
          />
        </NuxtLink>
        <h1 class="font-display text-title-l tablet:text-display-m">
          {{ t.userSettings.title }}
        </h1>
      </header>

      <section
        v-if="me"
        class="flex flex-col gap-3"
        aria-labelledby="settings-account"
      >
        <h2
          id="settings-account"
          class="section-heading px-1"
        >
          {{ t.userSettings.account }}
        </h2>
        <div class="flex flex-col gap-4 rounded-card bg-surface p-4">
          <div class="flex items-center gap-4">
            <UserAvatar
              :name="me.name"
              :image="me.image"
              :size="56"
            />
            <div class="flex min-w-0 flex-col">
              <span class="truncate font-display text-title-s">{{ me.name }}</span>
              <span class="truncate text-small text-text-muted">{{ me.email }}</span>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <!-- A label around the file input: the browser's own picker,
                 which on phones offers the camera too. -->
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-pill bg-surface-muted px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus"
              :class="{ 'pointer-events-none opacity-60': busy }"
            >
              <input
                type="file"
                :accept="PHOTO_ACCEPT"
                class="sr-only"
                :disabled="busy"
                @change="pickPicture"
              >
              <LoadingDots v-if="uploading" />
              <AppIcon
                v-else
                name="camera"
              />
              {{ me.ownPicture ? t.userSettings.changePicture : t.userSettings.pickPicture }}
            </label>
            <button
              v-if="me.ownPicture"
              type="button"
              class="rounded-pill px-4 py-2.5 text-button text-text-muted transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
              :disabled="busy"
              @click="removePicture"
            >
              {{ t.userSettings.removePicture }}
            </button>
          </div>
          <p
            v-if="problemMessage"
            role="alert"
            class="text-small text-danger"
          >
            {{ problemMessage }}
          </p>
          <p
            v-else
            role="status"
            class="text-small text-text-muted empty:hidden"
          >{{ uploading ? t.userSettings.uploadingPicture : '' }}</p>
        </div>
      </section>

      <AppSheet
        v-model:open="previewOpen"
        variant="dialog"
        :title="t.userSettings.previewTitle"
        :close-label="t.userSettings.closePreview"
      >
        <div
          v-if="previewed"
          class="mt-5 flex flex-col items-center gap-4"
        >
          <img
            :src="previewed.url"
            :alt="t.userSettings.previewAlt"
            class="size-40 rounded-full bg-surface-muted object-cover"
          >
          <p class="text-center text-body text-text-muted">
            {{ t.userSettings.previewHint }}
          </p>
        </div>
        <div class="mt-5 flex flex-col gap-2">
          <button
            type="button"
            class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
            :disabled="saving"
            @click="usePicture"
          >
            <BusyLabel
              :label="t.userSettings.usePicture"
              :busy-label="t.userSettings.savingPicture"
              :busy="saving"
            />
          </button>
          <button
            type="button"
            class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60"
            :disabled="saving"
            @click="previewOpen = false"
          >
            {{ t.userSettings.cancelPicture }}
          </button>
        </div>
      </AppSheet>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-theme"
      >
        <h2
          id="settings-theme"
          class="section-heading px-1"
        >
          {{ t.theme.label }}
        </h2>
        <ThemePicker />
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-language"
      >
        <h2
          id="settings-language"
          class="section-heading px-1"
        >
          {{ t.userSettings.language }}
        </h2>
        <div class="flex flex-col gap-1 rounded-card bg-surface p-4">
          <span class="text-body">{{ t.userSettings.german }}</span>
          <span class="text-small text-text-muted">{{ t.userSettings.moreLanguages }}</span>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-shortcuts"
      >
        <h2
          id="settings-shortcuts"
          class="section-heading px-1"
        >
          {{ t.shortcuts.title }}
        </h2>
        <div class="flex flex-col gap-4 rounded-card bg-surface p-4">
          <p class="text-small text-text-muted">
            {{ t.shortcuts.intro }}
          </p>
          <ShortcutList />
        </div>
      </section>

      <button
        type="button"
        class="self-start rounded-pill bg-surface-muted px-5 py-3.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        @click="signOut"
      >
        {{ t.userSettings.signOut }}
      </button>
    </div>
  </main>
</template>
