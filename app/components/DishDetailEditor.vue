<script setup lang="ts">
import type { SourceKind, SourceLookupResult } from '~~/server/source-lookup'
import type { DishView, SavedDish } from '~~/server/utils/dishes'
import type { Placeholder } from '~~/shared/placeholders'
import { webLink } from '~/utils/web-link'

// The Dish detail's edit mode (PRD stories 43–45): title, note, image and
// Source. A new link is looked up (Source Lookup, as in Add Dish) so it is
// saved as what it really is, but that never changes the image: only "Bild
// neu laden" does, and the image it finds (or the Placeholder, if none) is
// shown here and stored on Speichern. Nothing changes until then.
const props = defineProps<{ dish: DishView }>()
const emit = defineEmits<{ saved: [dish: SavedDish], cancel: [] }>()
const t = useStrings()

const title = ref(props.dish.title)
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')
onMounted(() => titleInput.value?.focus())
const note = ref(props.dish.note ?? '')
const link = ref(props.dish.source?.link ?? '')
const placeholder = ref<Placeholder>(props.dish.placeholder)
const titleId = useId()
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

// GET /api/source-lookup, once per link: when the link changes (at once when
// pasted, after a short pause while typing), on "Bild neu laden", and before
// saving a new link. A failed lookup is forgotten, so the next one retries.
type LookupAnswer = SourceLookupResult & { imageTicket: string | null }
const lookups = new Map<string, Promise<LookupAnswer | null>>()
function lookUp(target: string): Promise<LookupAnswer | null> {
  let answer = lookups.get(target)
  if (!answer) {
    answer = $fetch<LookupAnswer>('/api/source-lookup', { query: { link: target } }).catch(() => {
      lookups.delete(target)
      return null
    })
    lookups.set(target, answer)
  }
  return answer
}

type Reload = 'idle' | 'looking' | 'found' | 'nothing' | 'failed'
const reload = ref<Reload>('idle')

const sourceLink = computed(() => link.value.trim() === '' ? null : webLink(link.value))
const linkInvalid = computed(() => link.value.trim() !== '' && sourceLink.value === null)
// Whether the link is the Dish's own Source, whose kind is already known.
const linkUnchanged = computed(() => link.value.trim() === props.dish.source?.link)

// Only the latest "Bild neu laden" counts; changing the link drops what an
// earlier one found, since that image belongs to the other link.
let reloadRun = 0
async function reloadImage() {
  const target = sourceLink.value
  if (!target) return
  const run = ++reloadRun
  reload.value = 'looking'
  const result = await lookUp(target)
  if (run !== reloadRun) return
  if (!result) {
    reload.value = 'failed'
  }
  else if (result.imageUrl) {
    image.value = { kind: 'found', url: result.imageUrl, ticket: result.imageTicket }
    reload.value = 'found'
  }
  else {
    image.value = { kind: 'placeholder' }
    reload.value = 'nothing'
  }
}

let lookupTimer: ReturnType<typeof setTimeout> | undefined
let pasted = false
watch(link, () => {
  clearTimeout(lookupTimer)
  const target = sourceLink.value
  if (target && !linkUnchanged.value) lookupTimer = setTimeout(() => lookUp(target), pasted ? 0 : 300)
  pasted = false

  if (reload.value === 'idle') return
  reloadRun++
  reload.value = 'idle'
  if (image.value.kind === 'found' || image.value.kind === 'placeholder') image.value = { kind: 'keep' }
})
onBeforeUnmount(() => clearTimeout(lookupTimer))
function onPaste() {
  pasted = true
}

const choosingImage = ref(false)
// Tapping a tile (or Enter/Space on it) closes the picker; arrow keys only
// move the selection. Either way the chosen Placeholder becomes the image.
function closeOnTile(event: MouseEvent) {
  if ((event.target as Element).closest('[role="radio"]')) choosingImage.value = false
}
watch(placeholder, () => {
  image.value = { kind: 'placeholder' }
  reload.value = 'idle'
})

// The Source as saved: the Dish's own, or what Source Lookup says the new
// link is (canonical link and kind). If the lookup fails, the server reads the
// kind from the link itself.
async function sourceToSave(): Promise<{ link: string, kind?: SourceKind } | null> {
  const target = sourceLink.value
  if (!target) return null
  if (linkUnchanged.value && props.dish.source) return { ...props.dish.source }
  const result = await lookUp(target)
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
  try {
    const source = await sourceToSave()
    const saved = await $fetch<SavedDish>(`/api/dishes/${props.dish.id}`, {
      method: 'PATCH',
      body: {
        title: title.value,
        note: note.value,
        source,
        placeholder: placeholder.value,
        ...choice.kind === 'placeholder' && { imageUrl: null },
        ...choice.kind === 'found' && { imageUrl: choice.url, imageTicket: choice.ticket },
      },
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
    <div class="flex items-center justify-between gap-4">
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

    <div class="flex flex-col gap-3">
      <div class="aspect-[4/3] max-h-[45dvh] w-full overflow-hidden rounded-thumb bg-surface-muted">
        <img
          v-if="image.kind === 'found'"
          :src="image.url"
          :alt="t.addDish.sourceImage"
          referrerpolicy="no-referrer"
          class="h-full w-full object-cover"
          data-reloaded-image
          @error="image = { kind: 'placeholder' }; reload = 'nothing'"
        >
        <PlaceholderStill
          v-else-if="image.kind === 'placeholder'"
          :placeholder="placeholder"
        />
        <DishImage
          v-else
          :image-url="dish.imageUrl"
          :placeholder="placeholder"
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
      >{{ reload === 'found' ? t.detail.reloadFound : reload === 'nothing' ? t.detail.reloadNothingFound : reload === 'failed' ? t.detail.reloadFailed : '' }}</p>
    </div>

    <div class="flex flex-col gap-2">
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
        class="rounded-field border border-line-strong bg-surface px-4 py-3 font-display text-title-s text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
    </div>

    <div class="flex flex-col gap-2">
      <label
        :for="noteId"
        class="text-label"
      >{{ t.detail.note }}</label>
      <textarea
        :id="noteId"
        v-model="note"
        rows="3"
        maxlength="2000"
        :placeholder="t.detail.notePrompt"
        class="resize-none rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      />
    </div>

    <div class="flex flex-col gap-2">
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
        @paste="onPaste"
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

    <button
      type="submit"
      class="mt-auto rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      :disabled="!canSave"
      :aria-busy="saving"
    >
      {{ saving ? t.detail.saving : t.detail.save }}
    </button>

    <AppSheet
      v-model:open="choosingImage"
      :title="t.detail.chooseImage"
      :close-label="t.detail.close"
    >
      <PlaceholderPicker
        v-model="placeholder"
        class="mt-5"
        :label="t.detail.chooseImage"
        @click="closeOnTile"
      />
    </AppSheet>
  </form>
</template>
