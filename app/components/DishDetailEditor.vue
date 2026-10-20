<script setup lang="ts">
import type { SourceInput } from '~~/server/utils/dish-input'
import type { DishView } from '~~/server/utils/dishes'
import { FOCUS_CENTRE, focusPosition, sameFocus, type ImageFocus } from '~~/shared/image-focus'
import type { Placeholder } from '~~/shared/placeholders'
import type { BoardResult } from '~/board/board-module'
import type { UploadedPhoto } from '~/composables/usePhotoUpload'
import { webLink } from '~/utils/web-link'

// The Dish detail's edit mode (PRD stories 43–45): title, Creator,
// image and Source. A new link is looked up (Source Lookup, as in Add Dish)
// so it is saved as what it really is, but that never changes the image or
// the Creator: only "Bild neu laden" (or "Bild vom Link" in the image
// dialog) changes the image, and the image it finds (or the Placeholder, if
// none) is shown here and stored on Speichern, through the client Board
// module. So is a Placeholder or the Member's own photo ("Eigenes Foto")
// picked in the image dialog. Nothing changes until then.
// `boardId`: the Board it is on, where an own photo is uploaded to.
const props = defineProps<{ dish: DishView, boardId: string }>()
const emit = defineEmits<{ saved: [result: BoardResult], cancel: [] }>()
const t = useStrings()
const boardModule = useBoardModule()

const title = ref(props.dish.title)
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')
onMounted(() => titleInput.value?.focus())
const creator = ref(props.dish.creator ?? '')
const link = ref(props.dish.source?.link ?? '')
// Looks a new link up as in Add Dish: at once when pasted, after a short
// pause while typing. Only the latest lookup's answer counts.
const lookup = useLinkLookup(link)
const placeholder = ref<Placeholder>(props.dish.placeholder)
const titleId = useId()
const creatorId = useId()
const linkId = useId()
const linkHintId = useId()

// The image on Speichern: the one the Dish has, its Placeholder, the one
// "Bild neu laden" found (third-party, with the Image Ticket to store it), or
// the Member's own photo (already uploaded, with its photo ticket).
type ImageChoice
  = | { kind: 'keep' }
    | { kind: 'placeholder' }
    | { kind: 'found', url: string, ticket: string | null }
    | { kind: 'photo' } & UploadedPhoto
const image = ref<ImageChoice>({ kind: 'keep' })
// The image to shift in the image dialog, if it is one: not a Placeholder.
const shiftableImage = computed(() => {
  const choice = image.value
  if (choice.kind === 'found' || choice.kind === 'photo') return choice.url
  return choice.kind === 'keep' ? props.dish.imageUrl : null
})
// Where it is shifted to: the Dish's own focus point, and for a new image
// ("Bild neu laden", an own photo) the centre. Back to the image it has (a
// new link drops what a reload found), it is the Dish's own again.
// Saved only if the Member shifted it, or it is new: compared with the focus
// point as editing started, so another Member's shift meanwhile (the Board
// keeps the Dish up to date) isn't undone.
const startFocus = { ...props.dish.imageFocus }
const imageFocus = ref<ImageFocus>({ ...startFocus })
watch(image, choice => imageFocus.value = { ...choice.kind === 'keep' ? startFocus : FOCUS_CENTRE })
const focusChanged = computed(() => image.value.kind !== 'keep' || !sameFocus(imageFocus.value, startFocus))

// "Bild neu laden" was tapped for the link as it is now: the link's lookup is
// then the reload's (looking, failed, or found with or without an image).
const reloadAsked = ref(false)
// The image it found doesn't load in the browser either.
const foundImageBroken = ref(false)
type Reload = 'idle' | 'looking' | 'found' | 'nothing' | 'failed'
const reload = computed<Reload>(() => {
  const status = lookup.status.value
  if (!reloadAsked.value || status === 'idle') return 'idle'
  if (status !== 'found') return status
  return lookup.result.value?.imageUrl && !foundImageBroken.value ? 'found' : 'nothing'
})
// What the status line under the image says in each state.
const reloadMessage = computed(() => ({
  idle: '',
  looking: '',
  found: t.detail.reloadFound,
  nothing: t.detail.reloadNothingFound,
  failed: lookup.tooMany.value ? t.detail.reloadTooMany : t.detail.reloadFailed,
} satisfies Record<Reload, string>)[reload.value])

const sourceLink = computed(() => link.value.trim() === '' ? null : webLink(link.value))
const linkInvalid = computed(() => link.value.trim() !== '' && sourceLink.value === null)
// Whether the link is the Dish's own Source, whose kind is already known.
const linkUnchanged = computed(() => link.value.trim() === props.dish.source?.link)

function reloadImage() {
  reloadAsked.value = true
  foundImageBroken.value = false
  lookup.lookUpNow()
}
// What the reload found becomes the image: the Source's, or the Placeholder
// if there was none.
watch(reload, (state) => {
  const found = lookup.result.value
  if (state === 'found' && found?.imageUrl) image.value = { kind: 'found', url: found.imageUrl, ticket: found.imageTicket }
  else if (state === 'nothing') image.value = { kind: 'placeholder' }
})
// Changing the link drops what an earlier reload found, since that image
// belongs to the other link.
watch(link, () => {
  if (!reloadAsked.value) return
  reloadAsked.value = false
  if (image.value.kind === 'found' || image.value.kind === 'placeholder') image.value = { kind: 'keep' }
})

// The full picker closes itself when a tile is picked. Picked either way,
// with arrow keys too, the Placeholder becomes the image.
const choosingImage = ref(false)
function usePlaceholder() {
  image.value = { kind: 'placeholder' }
  reloadAsked.value = false
}
// Picking the Placeholder already selected counts too (after a photo).
watch(placeholder, usePlaceholder)

function usePhoto(photo: UploadedPhoto) {
  image.value = { kind: 'photo', ...photo }
  reloadAsked.value = false
}

// The Source as saved: the Dish's own, or what Source Lookup says the new
// link is (canonical link and kind). If the lookup fails, the server reads the
// kind from the link itself.
async function sourceToSave(): Promise<SourceInput | null> {
  const target = sourceLink.value
  if (!target) return null
  if (linkUnchanged.value && props.dish.source) return { ...props.dish.source }
  const result = await lookup.lookUpNow()
  return result ? { link: result.canonicalLink, kind: result.kind } : { link: target }
}

const saving = ref(false)
const failed = ref(false)
const canSave = computed(() => title.value.trim() !== '' && !linkInvalid.value && reload.value !== 'looking' && !saving.value)

async function save() {
  if (!canSave.value) return
  saving.value = true
  failed.value = false
  const choice = image.value
  // A failed reload is over: saving looks the link up again, and what that
  // finds mustn't become the image.
  if (reload.value === 'failed') reloadAsked.value = false
  try {
    const source = await sourceToSave()
    const saved = await boardModule.editDish(props.dish.id, {
      title: title.value,
      creator: creator.value,
      source,
      placeholder: placeholder.value,
      ...choice.kind === 'placeholder' && { imageUrl: null },
      ...choice.kind === 'found' && { imageUrl: choice.url, imageTicket: choice.ticket },
      ...choice.kind === 'photo' && { photo: { url: choice.url, ticket: choice.ticket } },
      ...shiftableImage.value && focusChanged.value && { imageFocus: imageFocus.value },
    })
    emit('saved', saved)
  }
  catch {
    failed.value = true
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <form
    class="flex min-h-full flex-col gap-5 px-5 pb-10 pt-4 tablet:px-7 tablet:pt-6"
    novalidate
    @submit.prevent="save"
  >
    <div
      class="flex items-center justify-between gap-4"
      data-morph-field="actions"
    >
      <h1 class="font-display text-title-m">
        {{ t.detail.editing }}
      </h1>
      <button
        type="button"
        class="rounded-pill bg-surface-muted px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        @click="emit('cancel')"
      >
        {{ t.detail.cancel }}
      </button>
    </div>

    <div
      class="flex flex-col gap-3"
      data-morph-field="image"
    >
      <div class="aspect-[4/3] max-h-[45dvh] w-full overflow-hidden rounded-thumb bg-surface-muted">
        <img
          v-if="image.kind === 'found'"
          :src="image.url"
          :alt="t.addDish.sourceImage"
          referrerpolicy="no-referrer"
          class="h-full w-full object-cover"
          :style="{ objectPosition: focusPosition(imageFocus) }"
          data-reloaded-image
          @error="foundImageBroken = true"
        >
        <img
          v-else-if="image.kind === 'photo'"
          :src="image.url"
          :alt="t.imageDialog.ownPhoto"
          class="h-full w-full object-cover"
          :style="{ objectPosition: focusPosition(imageFocus) }"
          data-own-photo
        >
        <DishImage
          v-else
          :image-url="image.kind === 'placeholder' ? null : dish.imageUrl"
          :focus="imageFocus"
          :placeholder="placeholder"
          :motion="choosingImage ? null : 'loop'"
        />
      </div>
      <!-- A row of image actions; "Bild wählen" also offers an own photo. -->
      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-pill bg-surface-muted px-3.5 py-2 text-label text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="choosingImage = true"
        >
          {{ t.detail.chooseImage }}
        </button>
        <button
          type="button"
          class="rounded-pill bg-surface-muted px-3.5 py-2 text-label text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-focus"
          :disabled="!sourceLink || reload === 'looking'"
          :aria-busy="reload === 'looking'"
          @click="reloadImage"
        >
          {{ reload === 'looking' ? t.detail.reloadingImage : t.detail.reloadImage }}
        </button>
      </div>
      <p
        role="status"
        class="text-small text-text-muted empty:hidden"
      >{{ reloadMessage }}</p>
    </div>

    <div
      class="flex flex-col"
      data-morph-field="title"
    >
      <AppField
        :label="t.detail.title"
        :control-id="titleId"
      >
        <input
          :id="titleId"
          ref="titleInput"
          v-model="title"
          type="text"
          required
          maxlength="200"
          autocomplete="off"
          class="font-display text-title-s"
        >
      </AppField>
    </div>

    <div
      class="flex flex-col"
      data-morph-field="creator"
    >
      <AppField
        :label="t.dish.creator"
        :control-id="creatorId"
      >
        <input
          :id="creatorId"
          v-model="creator"
          type="text"
          maxlength="100"
          autocomplete="off"
          :placeholder="t.detail.creatorPrompt"
        >
      </AppField>
    </div>

    <div
      class="flex flex-col"
      data-morph-field="source"
    >
      <AppField
        :label="t.detail.source"
        :control-id="linkId"
      >
        <input
          :id="linkId"
          v-model="link"
          type="url"
          inputmode="url"
          autocomplete="off"
          maxlength="2048"
          :placeholder="t.detail.sourcePrompt"
          :aria-describedby="linkHintId"
          :aria-invalid="linkInvalid || undefined"
          @paste="lookup.pasted()"
        >
      </AppField>
      <span
        :id="linkHintId"
        class="field-helper"
      >{{ t.detail.sourceHint }}</span>
    </div>

    <p
      v-if="failed"
      role="alert"
      class="text-small text-danger"
    >
      {{ t.detail.failed }}
    </p>

    <!-- Saving, it shows its dots undimmed; save() ignores a second submit
         meanwhile. -->
    <button
      type="submit"
      class="mt-auto rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :disabled="!canSave && !saving"
      :aria-busy="saving"
      data-morph-field="buttons"
    >
      <BusyLabel
        :label="t.detail.save"
        :busy-label="t.detail.saving"
        :busy="saving"
      />
    </button>

    <ImageDialog
      v-model:open="choosingImage"
      v-model:placeholder="placeholder"
      v-model:focus="imageFocus"
      :title="t.detail.chooseImage"
      :close-label="t.detail.close"
      :board-id="boardId"
      :offer-source="sourceLink !== null"
      :image="shiftableImage"
      @source="reloadImage"
      @photo="usePhoto"
      @placeholder="usePlaceholder"
    />
  </form>
</template>
