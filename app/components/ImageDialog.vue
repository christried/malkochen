<script setup lang="ts">
import type { Placeholder } from '~~/shared/placeholders'
import { PHOTO_ACCEPT } from '~~/shared/photo'
import type { PhotoProblem, UploadedPhoto } from '~/composables/usePhotoUpload'

// The image dialog ("Bild wählen") of Add Dish and the Dish detail: a Dish's
// image is the Source's ("Bild vom Link", only for a link Dish), the
// Member's own photo ("Eigenes Foto") or a Placeholder Image. Picking one
// closes it. An own photo is uploaded to the Board first; while that runs it
// says so, and if the photo is refused it says why and stays open.
const open = defineModel<boolean>('open', { required: true })
const placeholder = defineModel<Placeholder>('placeholder', { required: true })
const props = defineProps<{
  title: string
  closeLabel: string
  // Where an own photo is uploaded to.
  boardId: string
  // Whether "Bild vom Link" is offered, and its preview if there is one.
  offerSource: boolean
  sourceImage?: string | null
}>()
const emit = defineEmits<{
  source: []
  photo: [photo: UploadedPhoto]
  placeholder: []
}>()
const t = useStrings()

const photoUpload = usePhotoUpload()
const { uploading, problem } = photoUpload
const problemMessage = computed(() => problem.value && ({
  'too-large': t.imageDialog.tooLarge,
  'not-an-image': t.imageDialog.notAnImage,
  'failed': t.imageDialog.failed,
} satisfies Record<PhotoProblem, string>)[problem.value])

// Each opening starts afresh; closing drops an upload still under way.
watch(open, photoUpload.reset)

async function pickPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Picking the same file again must still count.
  input.value = ''
  if (!file) return
  const stored = await photoUpload.upload(props.boardId, file)
  if (!stored) return
  emit('photo', stored)
  open.value = false
}

function pickSource() {
  photoUpload.reset()
  emit('source')
  open.value = false
}

function pickPlaceholder() {
  photoUpload.reset()
  emit('placeholder')
}

const choice = 'flex min-h-24 flex-col items-center justify-center gap-2 overflow-hidden rounded-thumb bg-surface-muted p-3 text-label text-text transition-transform duration-tap ease-tap active:scale-95'
</script>

<template>
  <AppSheet
    v-model:open="open"
    :title="title"
    :close-label="closeLabel"
  >
    <div
      class="mt-5 grid gap-2.5"
      :class="offerSource ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <button
        v-if="offerSource"
        type="button"
        :class="[choice, 'relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus']"
        data-image-choice="source"
        @click="pickSource"
      >
        <img
          v-if="sourceImage"
          :src="sourceImage"
          alt=""
          referrerpolicy="no-referrer"
          class="absolute inset-0 h-full w-full object-cover"
        >
        <span
          v-else
          class="grid size-10 place-items-center rounded-full bg-surface"
        >
          <AppIcon name="link" />
        </span>
        <span :class="{ 'relative mt-auto self-end rounded-pill bg-glass px-3 py-1.5 backdrop-blur-sm': sourceImage }">
          {{ t.imageDialog.fromLink }}
        </span>
      </button>
      <!-- A label around the file input: the browser's own picker, which on
           phones offers the camera too. -->
      <label
        :class="[choice, 'cursor-pointer has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus', { 'pointer-events-none opacity-60': uploading }]"
        data-image-choice="photo"
      >
        <input
          type="file"
          :accept="PHOTO_ACCEPT"
          class="sr-only"
          :disabled="uploading"
          @change="pickPhoto"
        >
        <span class="grid size-10 place-items-center rounded-full bg-surface">
          <LoadingDots v-if="uploading" />
          <AppIcon
            v-else
            name="camera"
          />
        </span>
        {{ t.imageDialog.ownPhoto }}
      </label>
    </div>

    <p
      v-if="problemMessage"
      role="alert"
      class="mt-3 text-small text-danger"
    >
      {{ problemMessage }}
    </p>
    <p
      v-else
      role="status"
      class="mt-3 text-small text-text-muted empty:hidden"
    >{{ uploading ? t.imageDialog.uploading : '' }}</p>

    <h3 class="mb-3 mt-5 text-label">
      {{ t.imageDialog.placeholders }}
    </h3>
    <PlaceholderPicker
      v-model="placeholder"
      v-model:open="open"
      :label="t.imageDialog.placeholders"
      @pick="pickPlaceholder"
    />
  </AppSheet>
</template>
