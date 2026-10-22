<script setup lang="ts">
import type { Me } from '~~/server/utils/people'
import { PHOTO_ACCEPT } from '~~/shared/photo'
import { photoUploadTo, type PhotoProblem, type UploadedPhoto } from '~/composables/usePhotoUpload'

// Your own settings (PRD stories 73–75), in a sheet over the Board (#210),
// from 768px on its right edge (#283):
// your Username, the Google account you're signed in with and your Profile
// Picture, Darstellung, Sprache (LanguagePicker), the
// Board's keyboard shortcuts (where there's a keyboard and mouse),
// "Rundgang starten", which starts the Tour again (`startTour`: the Board
// closes the sheet and starts it), signing out and "Konto löschen"; then,
// for the Operator only, the link to the Admin Page (#348); last, "Was ist
// neu" (the Changelog, #354) with the Version you have, marked "Neu" while
// it is new to you. Opened by the cogwheel
// in the Board's header (#282), and by /settings (pages/settings.vue).
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ startTour: [] }>()
const t = useStrings()
const { signOut } = useAuth()

const { data: me } = useMe()

// Your Username: changed here at any time, for every Member to see.
const username = useUsernameForm(me)
const usernameId = useId()
const usernameHintId = useId()
const usernameSaved = ref(false)
watch(username.typed, () => (usernameSaved.value = false))
async function saveUsername() {
  usernameSaved.value = await username.save()
}
// Push notifications (#219), for this device: checked again whenever the
// sheet opens, since the browser's permission may have changed meanwhile.
const push = usePushNotifications()
const pushOn = computed(() => push.state.value === 'on')
// Not while it is checked or turned, nor where only the browser can change it.
const pushSwitchable = computed(() => !push.busy.value && (push.state.value === 'on' || push.state.value === 'off'))
const pushMessage = computed(() => {
  if (push.failed.value) return t.push.failed
  if (push.state.value === 'blocked') return t.push.blocked
  if (push.state.value === 'unsupported') return t.push.unsupported
  return null
})
// The Email Digest (#220): one switch for all your Boards and devices, so
// it is read again whenever the sheet opens, in case it was switched
// elsewhere.
const digest = useEmailDigest()

// Opened again, it starts from the Username you have, not from what was
// typed and left unsaved.
watch(open, (isOpen) => {
  if (!isOpen) return
  username.typed.value = me.value?.name ?? ''
  usernameSaved.value = false
})
watch(open, (isOpen) => {
  if (!isOpen) return
  void push.refresh()
  void digest.refresh()
}, { immediate: true })

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
  set: (isOpen) => {
    if (!saving.value) previewShown.value = isOpen
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
  // Closed meanwhile, the preview doesn't come up over the Board.
  if (!uploaded || !open.value) return
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

// "Konto löschen" (#346): what happens is said first, then the Username is
// typed (whatever the case, as the server takes it) to delete the account
// for good. Done, the visitor lands signed out on the sign-in page.
const confirmingDelete = ref(false)
const typedUsername = ref('')
const deletingAccount = ref(false)
const deleteFailed = ref<string | null>(null)
watch(confirmingDelete, () => {
  typedUsername.value = ''
  deleteFailed.value = null
})
const usernameTyped = computed(() => !!me.value?.name && typedUsername.value.trim().toLowerCase() === me.value.name.toLowerCase())

async function deleteAccount() {
  if (!usernameTyped.value || deletingAccount.value) return
  deletingAccount.value = true
  deleteFailed.value = null
  try {
    await $fetch('/api/me', { method: 'DELETE', body: { username: typedUsername.value } })
    hapticReject()
    await navigateTo('/login')
  }
  catch (error) {
    deleteFailed.value = (error as { data?: { data?: { message?: string } } }).data?.data?.message ?? t.deleteAccount.failed
  }
  finally {
    deletingAccount.value = false
  }
}
</script>

<template>
  <AppSheet
    v-model:open="open"
    variant="side"
    :title="t.userSettings.title"
    :close-label="t.userSettings.close"
  >
    <div class="mt-5 flex flex-col gap-8">
      <section
        v-if="me"
        class="flex flex-col gap-3"
        aria-labelledby="settings-account"
      >
        <h3
          id="settings-account"
          class="section-heading px-1"
        >
          {{ t.userSettings.account }}
        </h3>
        <div class="flex flex-col gap-4 rounded-card bg-surface-muted p-4">
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
          <form
            class="flex flex-col gap-2"
            novalidate
            @submit.prevent="saveUsername"
          >
            <div class="flex items-start gap-2">
              <AppField
                class="min-w-0 flex-1"
                :label="t.username.label"
                :control-id="usernameId"
              >
                <input
                  :id="usernameId"
                  v-model="username.typed.value"
                  type="text"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  :aria-invalid="username.message.value ? true : undefined"
                  :aria-describedby="usernameHintId"
                >
              </AppField>
              <button
                type="submit"
                class="mt-[6px] h-(--field-h) shrink-0 rounded-pill bg-inverse px-5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                :disabled="!username.changed.value || username.saving.value"
              >
                <BusyLabel
                  :label="t.username.save"
                  :busy-label="t.username.saving"
                  :busy="username.saving.value"
                />
              </button>
            </div>
            <p
              :id="usernameHintId"
              class="field-helper -mt-2"
              :class="{ 'text-danger': username.message.value }"
              :role="username.message.value ? 'alert' : 'status'"
            >
              {{ username.message.value ?? (usernameSaved ? t.username.saved : t.username.hint) }}
            </p>
          </form>
          <div class="flex flex-wrap gap-2">
            <!-- A label around the file input: the browser's own picker,
                 which on phones offers the camera too. -->
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-pill bg-surface px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus"
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

      <section
        v-if="push.offered || digest.offered"
        class="flex flex-col gap-3"
        aria-labelledby="settings-notifications"
      >
        <h3
          id="settings-notifications"
          class="section-heading px-1"
        >
          {{ t.push.heading }}
        </h3>
        <div class="flex flex-col gap-3 rounded-card bg-surface-muted p-4">
          <template v-if="push.offered">
            <SettingsSwitch
              :label="t.push.toggle"
              :hint="t.push.hint"
              :checked="pushOn"
              :busy="push.busy.value || push.state.value === null"
              :disabled="!pushSwitchable"
              @toggle="push.turn(!pushOn)"
            />
            <p
              :role="push.failed.value ? 'alert' : 'status'"
              class="text-small empty:hidden"
              :class="push.failed.value ? 'text-danger' : 'text-text-muted'"
            >{{ pushMessage ?? '' }}</p>
          </template>
          <template v-if="digest.offered">
            <SettingsSwitch
              :label="t.emailDigest.toggle"
              :hint="t.emailDigest.hint"
              :checked="digest.on.value === true"
              :busy="digest.busy.value || digest.on.value === null"
              :disabled="digest.busy.value || digest.on.value === null"
              @toggle="digest.turn(!digest.on.value)"
            />
            <p
              :role="digest.failed.value ? 'alert' : 'status'"
              class="text-small text-danger empty:hidden"
            >{{ digest.failed.value ? t.emailDigest.failed : '' }}</p>
          </template>
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-theme"
      >
        <h3
          id="settings-theme"
          class="section-heading px-1"
        >
          {{ t.theme.label }}
        </h3>
        <ThemePicker />
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-language"
      >
        <h3
          id="settings-language"
          class="section-heading px-1"
        >
          {{ t.userSettings.language }}
        </h3>
        <LanguagePicker />
      </section>

      <!-- Only where there's a keyboard and mouse (scoped style below). -->
      <section
        class="shortcuts flex flex-col gap-3"
        aria-labelledby="settings-shortcuts"
      >
        <h3
          id="settings-shortcuts"
          class="section-heading px-1"
        >
          {{ t.shortcuts.title }}
        </h3>
        <div class="flex flex-col gap-4 rounded-card bg-surface-muted p-4">
          <p class="text-small text-text-muted">
            {{ t.shortcuts.intro }}
          </p>
          <ShortcutList />
        </div>
      </section>

      <section
        class="flex flex-col gap-3"
        aria-labelledby="settings-tour"
      >
        <h3
          id="settings-tour"
          class="section-heading px-1"
        >
          {{ t.tour.label }}
        </h3>
        <div class="flex flex-col items-start gap-3 rounded-card bg-surface-muted p-4">
          <p class="text-small text-text-muted">
            {{ t.tour.startHint }}
          </p>
          <button
            type="button"
            class="rounded-pill bg-surface px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            @click="emit('startTour')"
          >
            {{ t.tour.start }}
          </button>
        </div>
      </section>

      <button
        type="button"
        class="self-start rounded-pill bg-surface-muted px-5 py-3.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        @click="signOut"
      >
        {{ t.userSettings.signOut }}
      </button>

      <section
        v-if="me"
        class="flex flex-col gap-3"
        aria-labelledby="settings-delete-account"
      >
        <h3
          id="settings-delete-account"
          class="section-heading px-1"
        >
          {{ t.deleteAccount.heading }}
        </h3>
        <div class="flex flex-col items-start gap-3 rounded-card bg-surface-muted p-4">
          <p class="text-small text-text-muted">
            {{ t.deleteAccount.hint }}
          </p>
          <DangerButton @click="confirmingDelete = true">
            {{ t.deleteAccount.open }}
          </DangerButton>
        </div>
      </section>

      <NuxtLink
        v-if="me?.isOperator"
        to="/admin"
        class="flex flex-col gap-1 rounded-card bg-surface-muted p-4 transition-[box-shadow,scale] duration-tap ease-tap hover:shadow-card active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span class="font-semibold">{{ t.admin.link }}</span>
        <span class="text-small text-text-muted">{{ t.admin.linkHint }}</span>
      </NuxtLink>

      <NuxtLink
        to="/changelog"
        class="flex flex-col gap-1 rounded-card bg-surface-muted p-4 transition-[box-shadow,scale] duration-tap ease-tap hover:shadow-card active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-focus"
      >
        <span class="flex items-center gap-2.5">
          <span class="font-semibold">{{ t.changelog.title }}</span>
          <span
            v-if="me?.newVersion"
            class="new-version px-2.5 py-1 text-overline uppercase text-neu-ink"
          >{{ t.changelog.isNew }}</span>
        </span>
        <span
          v-if="me?.version"
          class="text-small text-text-muted"
        >{{ t.changelog.current(me.version) }}</span>
      </NuxtLink>
    </div>
  </AppSheet>

  <AppSheet
    v-model:open="confirmingDelete"
    variant="dialog"
    :title="t.deleteAccount.title"
    :close-label="t.deleteAccount.cancel"
  >
    <form
      v-if="me"
      class="mt-3 flex flex-col gap-2"
      novalidate
      @submit.prevent="deleteAccount"
    >
      <ul class="flex list-disc flex-col gap-2 pl-5 text-body text-text-muted">
        <li
          v-for="line in t.deleteAccount.what"
          :key="line"
        >
          {{ line }}
        </li>
      </ul>
      <AppField
        class="mt-3"
        :label="t.deleteAccount.typeToConfirm(me.name)"
        control-id="settings-delete-account-name"
      >
        <input
          id="settings-delete-account-name"
          v-model="typedUsername"
          type="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          @keydown.enter="usernameTyped || shake($event.target as Element)"
        >
      </AppField>
      <p
        role="alert"
        class="text-small text-danger empty:hidden"
      >{{ deleteFailed ?? '' }}</p>
      <DangerButton
        type="submit"
        class="mt-3 disabled:opacity-50"
        :disabled="!usernameTyped || deletingAccount"
      >
        <BusyLabel
          :label="t.deleteAccount.confirm"
          :busy-label="t.deleteAccount.deleting"
          :busy="deletingAccount"
        />
      </DangerButton>
      <button
        type="button"
        class="rounded-pill px-5 py-3 text-button text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
        @click="confirmingDelete = false"
      >
        {{ t.deleteAccount.cancel }}
      </button>
    </form>
  </AppSheet>

  <!-- Beside the sheet, not in it: opened over it, the sheet steps back. -->
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
</template>

<style scoped>
/* The shortcuts need a keyboard: shown only on devices with a fine pointer
   that can hover (the rule the hover styles use), never on a phone, by
   device rather than width (#280). */
@media not ((hover: hover) and (pointer: fine)) {
  .shortcuts {
    display: none;
  }
}
/* "Neu" on "Was ist neu" while the app's Version is new to you: the Dish
   card's "Neu" pebble (DishCard.vue), still, with no ring. */
.new-version {
  border-radius: var(--radius-blob);
  background: var(--gradient-neu);
  box-shadow: var(--shadow-neu);
  rotate: -6deg;
}
</style>
