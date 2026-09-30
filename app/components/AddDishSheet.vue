<script setup lang="ts">
import type { SourceLookupResult } from '~~/server/source-lookup'
import type { BoardSummary } from '~~/server/utils/boards'
import type { DuplicateDish, SavedDish } from '~~/server/utils/dishes'
import { PLACEHOLDERS, type Placeholder } from '~~/shared/placeholders'
import { badgeKind } from '~~/shared/source-badge'

// Add Dish. First a link: pasting one looks it up right away (Source Lookup)
// and shows a preview with the image and an editable Suggested Title. Or
// "Ohne Link hinzufügen": a title, a note and a Placeholder Image. Either way
// the Member picks the Board (the one they are on) and saves. If the link is
// already on that Board, a warning names the Dish and its Column: open it, or
// save anyway.
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ boardId: string }>()
const emit = defineEmits<{ added: [dish: SavedDish, boardId: string] }>()
const t = useStrings()

// "bowl" is the handoff's fallback Placeholder (illustrations.json autoPick).
const DEFAULT_PLACEHOLDER: Placeholder = 'bowl'

const withoutLink = ref(false)
const link = ref('')
// GET /api/source-lookup: what Source Lookup found, and the Image Ticket
// saving needs to copy the image.
type LookupAnswer = SourceLookupResult & { imageTicket: string | null }
type Lookup
  = | { status: 'idle' }
    | { status: 'looking' }
    | { status: 'found', result: LookupAnswer }
    | { status: 'failed' }
const lookup = ref<Lookup>({ status: 'idle' })

const title = ref('')
const note = ref('')
const placeholder = ref<Placeholder>(DEFAULT_PLACEHOLDER)
const boardId = ref(props.boardId)
const boards = ref<BoardSummary[]>([])
const linkId = useId()
const titleId = useId()
const titleHintId = useId()
const choosingImage = ref(false)
const saving = ref(false)
const failed = ref(false)

const result = computed(() => lookup.value.status === 'found' ? lookup.value.result : null)
const showForm = computed(() => withoutLink.value || lookup.value.status === 'found' || lookup.value.status === 'failed')

// The Source image, unless the Member swapped it for a Placeholder or it
// doesn't load in the browser either.
const sourceImageBroken = ref(false)
const preferPlaceholder = ref(false)
const sourceImage = computed(() => sourceImageBroken.value ? null : result.value?.imageUrl ?? null)
const usingSourceImage = computed(() => sourceImage.value !== null && !preferPlaceholder.value)
// Found an image but no title (Pinterest, Instagram): ask for one, kindly.
const titleNeeded = computed(() => result.value !== null && result.value.suggestedTitle === '' && title.value.trim() === '')

// The Source link the Dish is saved with: the canonical one if the lookup
// found it, else the link as pasted. None without a link, or before either.
const sourceLink = computed(() => {
  if (withoutLink.value) return null
  if (result.value) return result.value.canonicalLink
  return lookup.value.status === 'failed' ? webLink(link.value) : null
})

// A Dish with this Source already on the chosen Board (PRD story 24), asked
// again whenever the link or the Board changes. Saving waits for the answer,
// and while the warning shows, only "Trotzdem speichern" saves.
const duplicate = ref<DuplicateDish | null>(null)
const checkingDuplicate = ref(false)
const saveAnyway = ref(false)
let duplicateRun = 0
watch([sourceLink, boardId], async ([target, board]) => {
  const run = ++duplicateRun
  duplicate.value = null
  saveAnyway.value = false
  if (!target) {
    checkingDuplicate.value = false
    return
  }
  checkingDuplicate.value = true
  const answer = await $fetch<{ duplicate: DuplicateDish | null }>(`/api/boards/${board}/duplicate`, { query: { link: target } })
    .catch(() => ({ duplicate: null }))
  if (run !== duplicateRun) return
  duplicate.value = answer.duplicate
  checkingDuplicate.value = false
})
const warnDuplicate = computed(() => duplicate.value !== null && !saveAnyway.value)

const canSave = computed(() =>
  showForm.value && title.value.trim() !== '' && !saving.value && !checkingDuplicate.value && !warnDuplicate.value)

function saveDespiteDuplicate() {
  saveAnyway.value = true
  save()
}

// "Öffnen": to the Dish already on the Board, instead of adding it again.
async function openDuplicate() {
  if (!duplicate.value) return
  const dishId = duplicate.value.id
  open.value = false
  await navigateTo({ path: `/b/${boardId.value}`, query: { dish: dishId } })
}

// The inline picker (handoff: 4×2) offers the first eight Placeholders; one
// chosen from the full picker ("Bild wählen") takes the last inline slot, so
// the selection is always in view.
const INLINE_COUNT = 8
const inlineOptions = computed<Placeholder[]>(() => {
  const first = PLACEHOLDERS.slice(0, INLINE_COUNT)
  return first.includes(placeholder.value) ? first : [...first.slice(0, -1), placeholder.value]
})
// In the full picker, arrow keys move the selection; tapping a tile (or
// Enter/Space on it) also closes the picker. Picking one replaces the Source image.
function closeOnTile(event: MouseEvent) {
  if ((event.target as Element).closest('[role="radio"]')) {
    choosingImage.value = false
    preferPlaceholder.value = true
  }
}

function webLink(value: string): string | null {
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null
  }
  catch {
    return null
  }
}

// Looks the link up as soon as it is one: at once when pasted, after a short
// pause while typing. The loading state shows immediately either way. Only
// the latest lookup's answer counts.
let lookupRun = 0
let lookupTimer: ReturnType<typeof setTimeout> | undefined
let pasted = false
watch(link, (value) => {
  clearTimeout(lookupTimer)
  const run = ++lookupRun
  const target = webLink(value)
  sourceImageBroken.value = false
  preferPlaceholder.value = false
  if (!target) {
    lookup.value = { status: 'idle' }
    return
  }
  lookup.value = { status: 'looking' }
  lookupTimer = setTimeout(async () => {
    try {
      const found = await $fetch<LookupAnswer>('/api/source-lookup', { query: { link: target } })
      if (run !== lookupRun) return
      title.value = found.suggestedTitle.slice(0, 200)
      lookup.value = { status: 'found', result: found }
    }
    catch {
      if (run === lookupRun) lookup.value = { status: 'failed' }
    }
  }, pasted ? 0 : 300)
  pasted = false
})

function onPaste() {
  pasted = true
}

const canPaste = ref(false)
onMounted(() => canPaste.value = typeof navigator.clipboard?.readText === 'function')
async function pasteFromClipboard() {
  const text = await navigator.clipboard.readText().catch(() => '')
  if (!text.trim()) return
  pasted = true
  link.value = text.trim()
}

// Every opening starts from an empty form, on the Board the Member is on.
watch(open, async (isOpen) => {
  if (!isOpen) return
  clearTimeout(lookupTimer)
  lookupRun++
  withoutLink.value = false
  link.value = ''
  lookup.value = { status: 'idle' }
  title.value = ''
  note.value = ''
  placeholder.value = DEFAULT_PLACEHOLDER
  boardId.value = props.boardId
  failed.value = false
  boards.value = await $fetch<BoardSummary[]>('/api/boards').catch(() => [])
})

async function save() {
  if (!canSave.value) return
  saving.value = true
  failed.value = false
  const target = boardId.value
  const source = withoutLink.value
    ? null
    : result.value
      ? { link: result.value.canonicalLink, kind: result.value.kind }
      : { link: link.value.trim() }
  try {
    const dish = await $fetch<SavedDish>(`/api/boards/${target}/dishes`, {
      method: 'POST',
      body: {
        title: title.value,
        note: note.value,
        placeholder: placeholder.value,
        source,
        imageUrl: usingSourceImage.value ? sourceImage.value : null,
        imageTicket: usingSourceImage.value ? result.value?.imageTicket : null,
      },
    })
    emit('added', dish, target)
    open.value = false
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
  <AppSheet
    v-model:open="open"
    :title="withoutLink ? t.addDish.withoutLink : t.addDish.heading"
    :close-label="t.addDish.close"
  >
    <form
      class="mt-5 flex flex-col gap-5"
      novalidate
      @submit.prevent="save"
    >
      <template v-if="!withoutLink">
        <div class="flex flex-col gap-2">
          <label
            :for="linkId"
            class="text-label"
          >{{ t.addDish.link }}</label>
          <span class="flex items-center gap-2 rounded-field border border-line-strong bg-surface py-1.5 pl-4 pr-1.5 focus-within:ring-2 focus-within:ring-focus">
            <span
              v-if="result"
              aria-hidden="true"
              class="source-dot h-2.5 w-2.5 shrink-0 rounded-full"
              :data-source="badgeKind(result.kind)"
            />
            <input
              :id="linkId"
              v-model="link"
              type="url"
              inputmode="url"
              autocomplete="off"
              maxlength="2048"
              :placeholder="t.addDish.linkPrompt"
              class="min-w-0 flex-1 bg-transparent py-1.5 text-body text-text placeholder:text-text-muted focus:outline-none"
              @paste="onPaste"
            >
            <button
              v-if="canPaste"
              type="button"
              class="shrink-0 rounded-pill bg-surface-muted px-3.5 py-2 text-label text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              @click="pasteFromClipboard"
            >
              {{ t.addDish.paste }}
            </button>
          </span>
        </div>

        <button
          v-if="lookup.status === 'idle'"
          type="button"
          class="self-start rounded-pill bg-surface-muted px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="withoutLink = true"
        >
          {{ t.addDish.withoutLink }}
        </button>

        <div
          v-if="lookup.status === 'looking'"
          role="status"
          class="lookup-panel flex flex-col items-center gap-3 rounded-panel px-4 py-6"
          data-lookup="looking"
        >
          <img
            src="/illustrations/topfbert-stir.svg"
            alt=""
            class="w-28"
          >
          <span class="text-body">{{ t.addDish.lookingUp }}</span>
        </div>

        <div
          v-else-if="lookup.status === 'failed'"
          role="status"
          class="flex items-center gap-3 rounded-panel bg-surface-muted p-3"
          data-lookup="failed"
        >
          <img
            src="/illustrations/topfbert-oops.svg"
            alt=""
            class="w-16 shrink-0"
          >
          <span class="text-small">{{ t.addDish.lookupFailed }}</span>
        </div>
      </template>

      <template v-if="showForm">
        <div
          v-if="warnDuplicate && duplicate"
          role="alert"
          class="duplicate-panel flex flex-col gap-3 rounded-panel p-3"
          data-duplicate
        >
          <div class="flex items-center gap-3">
            <img
              src="/illustrations/topfbert-wow.svg"
              alt=""
              class="w-14 shrink-0"
            >
            <span class="text-body">{{ t.addDish.duplicate(duplicate.title, duplicate.columnName) }}</span>
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              class="rounded-pill bg-surface px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              @click="openDuplicate"
            >
              {{ t.addDish.openDuplicate }}
            </button>
            <button
              type="button"
              class="rounded-pill bg-inverse px-4 py-2.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              :disabled="saving"
              @click="saveDespiteDuplicate"
            >
              {{ t.addDish.saveAnyway }}
            </button>
          </div>
        </div>

        <div
          v-if="usingSourceImage"
          class="relative overflow-hidden rounded-thumb bg-surface-muted"
        >
          <img
            :src="sourceImage!"
            :alt="t.addDish.sourceImage"
            referrerpolicy="no-referrer"
            class="aspect-[4/3] w-full object-cover"
            data-source-image
            @error="sourceImageBroken = true"
          >
          <button
            type="button"
            class="absolute bottom-2.5 right-2.5 rounded-pill bg-glass px-3.5 py-2 text-label text-text backdrop-blur-sm transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            @click="choosingImage = true"
          >
            {{ t.addDish.changeImage }}
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <label
            :for="titleId"
            class="text-label"
          >{{ t.addDish.title }}</label>
          <input
            :id="titleId"
            v-model="title"
            type="text"
            required
            maxlength="200"
            autocomplete="off"
            :placeholder="titleNeeded ? t.addDish.titleNeeded : t.addDish.titlePrompt"
            :aria-describedby="titleNeeded ? titleHintId : undefined"
            class="rounded-field border border-line-strong bg-surface px-4 py-3 font-display text-title-s text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            :class="{ 'title-prompt': titleNeeded }"
          >
          <span
            v-if="titleNeeded"
            :id="titleHintId"
            class="text-small text-text-muted"
          >{{ t.addDish.titleNeededHint }}</span>
        </div>

        <div
          v-if="!usingSourceImage"
          class="flex flex-col gap-2"
        >
          <p
            v-if="result && !sourceImage"
            class="text-small text-text-muted"
          >
            {{ t.addDish.nothingFound }}
          </p>
          <div class="flex items-center justify-between gap-4">
            <span
              class="text-label"
              aria-hidden="true"
            >{{ t.addDish.image }}</span>
            <div class="flex flex-wrap justify-end gap-2">
              <button
                v-if="sourceImage"
                type="button"
                class="rounded-pill bg-surface-muted px-3.5 py-2 text-label text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                @click="preferPlaceholder = false"
              >
                {{ t.addDish.useSourceImage }}
              </button>
              <button
                type="button"
                class="rounded-pill bg-surface-muted px-3.5 py-2 text-label text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                @click="choosingImage = true"
              >
                {{ t.addDish.chooseImage }}
              </button>
            </div>
          </div>
          <PlaceholderPicker
            v-model="placeholder"
            :label="t.addDish.image"
            :options="inlineOptions"
          />
        </div>

        <label class="flex flex-col gap-2">
          <span class="text-label">{{ t.addDish.note }}</span>
          <textarea
            v-model="note"
            rows="2"
            maxlength="2000"
            :placeholder="t.addDish.notePrompt"
            class="resize-none rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          />
        </label>

        <label
          v-if="boards.length"
          class="flex flex-col gap-2"
        >
          <span class="text-label">{{ t.addDish.board }}</span>
          <select
            v-model="boardId"
            class="rounded-field border border-line-strong bg-surface px-4 py-3 text-body text-text focus:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
            <option
              v-for="board in boards"
              :key="board.id"
              :value="board.id"
            >
              {{ board.emoji }} {{ board.name }}
            </option>
          </select>
        </label>

        <p
          v-if="failed"
          role="alert"
          class="text-small text-danger"
        >
          {{ t.addDish.failed }}
        </p>

        <button
          v-if="!warnDuplicate"
          type="submit"
          class="rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          :disabled="!canSave"
          :aria-busy="saving"
        >
          {{ saving ? t.addDish.saving : t.addDish.save }}
        </button>
      </template>
    </form>

    <AppSheet
      v-model:open="choosingImage"
      :title="t.addDish.chooseImage"
      :close-label="t.addDish.close"
    >
      <PlaceholderPicker
        v-model="placeholder"
        class="mt-5"
        :label="t.addDish.chooseImage"
        @click="closeOnTile"
      />
    </AppSheet>
  </AppSheet>
</template>

<style scoped>
/* remotion-briefs.json lookup-stir: butter 22% into surface-muted. */
.lookup-panel {
  background: color-mix(in oklch, var(--color-butter) 22%, var(--color-surface-muted));
}
/* Same butter wash as the lookup panel, a little stronger: it asks for a
   decision. */
.duplicate-panel {
  background: color-mix(in oklch, var(--color-butter) 38%, var(--color-surface-muted));
}
/* Input "required/prompt": a butter glow that breathes, never red. Reduced
   motion (main.css) stops it after one pass. */
.title-prompt {
  animation: title-prompt var(--dur-idle) var(--ease-idle) infinite;
}
@keyframes title-prompt {
  0%, 100% { box-shadow: 0 0 0 2px var(--color-focus); }
  50% { box-shadow: 0 0 0 11px color-mix(in srgb, var(--color-butter) 0%, transparent); }
}
</style>
