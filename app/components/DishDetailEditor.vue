<script setup lang="ts">
import type { SourceInput } from '~~/server/utils/dish-input'
import type { DishView } from '~~/server/utils/dishes'
import type { Placeholder } from '~~/shared/placeholders'
import type { BoardResult } from '~/board/board-module'
import { webLink } from '~/utils/web-link'

// The Dish detail's edit mode (PRD stories 43–45): title, Creator, note,
// image and Source. A new link is looked up (Source Lookup, as in Add Dish)
// so it is saved as what it really is, but that never changes the image or
// the Creator: only "Bild neu laden" changes the image, and the image it finds (or the Placeholder, if none) is
// shown here and stored on Speichern, through the client Board module.
// Nothing changes until then.
const props = defineProps<{ dish: DishView }>()
const emit = defineEmits<{ saved: [result: BoardResult], cancel: [] }>()
const t = useStrings()
const boardModule = useBoardModule()

const title = ref(props.dish.title)
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')
onMounted(() => titleInput.value?.focus())
const creator = ref(props.dish.creator ?? '')
const note = ref(props.dish.note ?? '')
// The note field's made-up example, a new one each time editing starts.
const noteExample = useExamplePrompt(t.dishNote.examples, t.dishNote.prompt)
onMounted(noteExample.pickAnother)
const link = ref(props.dish.source?.link ?? '')
// Looks a new link up as in Add Dish: at once when pasted, after a short
// pause while typing. Only the latest lookup's answer counts.
const lookup = useLinkLookup(link)
const placeholder = ref<Placeholder>(props.dish.placeholder)
const titleId = useId()
const creatorId = useId()
const noteId = useId()
const linkId = useId()
const linkHintId = useId()

// The image on Speichern: the one the Dish has, its Placeholder, or the one
// "Bild neu laden" found (third-party, with the Image Ticket to store it).
type ImageChoice
  = | { kind: 'keep' }
    | { kind: 'placeholder' }
    | { kind: 'found', url: string, ticket: string | null }
const image = ref<ImageChoice>({ kind: 'keep' })

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
  failed: t.detail.reloadFailed,
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
watch(placeholder, () => {
  image.value = { kind: 'placeholder' }
  reloadAsked.value = false
})

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
      note: note.value,
      source,
      placeholder: placeholder.value,
      ...choice.kind === 'placeholder' && { imageUrl: null },
      ...choice.kind === 'found' && { imageUrl: choice.url, imageTicket: choice.ticket },
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
          data-reloaded-image
          @error="foundImageBroken = true"
        >
        <DishImage
          v-else
          :image-url="image.kind === 'placeholder' ? null : dish.imageUrl"
          :placeholder="placeholder"
          :motion="choosingImage ? null : 'loop'"
        />
      </div>
      <!-- A row of image actions, with room for a future "eigenes Foto". -->
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
      class="flex flex-col gap-2"
      data-morph-field="title"
    >
      <label
        :for="titleId"
        class="text-label"
      >{{ t.detail.title }}</label>
      <input
        :id="titleId"
        ref="titleInput"
        v-model="title"
        type="text"
        required
        maxlength="200"
        autocomplete="off"
        class="rounded-field border border-line-strong bg-surface px-4 py-field-display font-display text-title-s text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
    </div>

    <div
      class="flex flex-col gap-2"
      data-morph-field="creator"
    >
      <label
        :for="creatorId"
        class="text-label"
      >{{ t.detail.creator }}</label>
      <input
        :id="creatorId"
        v-model="creator"
        type="text"
        maxlength="100"
        autocomplete="off"
        :placeholder="t.detail.creatorPrompt"
        class="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
    </div>

    <div
      class="flex flex-col gap-2"
      data-morph-field="note"
    >
      <label
        :for="noteId"
        class="text-label"
      >{{ t.detail.note }}</label>
      <textarea
        :id="noteId"
        v-model="note"
        rows="3"
        maxlength="2000"
        :placeholder="noteExample.prompt.value"
        class="resize-none rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
    </div>

    <div
      class="flex flex-col gap-2"
      data-morph-field="source"
    >
      <label
        :for="linkId"
        class="text-label"
      >{{ t.detail.source }}</label>
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
        class="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        @paste="lookup.pasted()"
      >
      <span
        :id="linkHintId"
        class="text-small text-text-muted"
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

    <AppSheet
      v-model:open="choosingImage"
      :title="t.detail.chooseImage"
      :close-label="t.detail.close"
    >
      <PlaceholderPicker
        v-model="placeholder"
        v-model:open="choosingImage"
        class="mt-5"
        :label="t.detail.chooseImage"
      />
    </AppSheet>
  </form>
</template>
