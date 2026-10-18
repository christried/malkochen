<script setup lang="ts">
import type { BoardSummary } from '~~/server/utils/boards'
import type { DuplicateDish } from '~~/server/utils/dishes'
import { dishPath } from '~~/shared/address'
import { FOCUS_CENTRE, focusPosition, type ImageFocus } from '~~/shared/image-focus'
import type { BoardResult } from '~/board/board-module'
import { autoPlaceholder, PLACEHOLDERS, type Placeholder } from '~~/shared/placeholders'
import { badgeKind } from '~~/shared/source-badge'
import type { UploadedPhoto } from '~/composables/usePhotoUpload'
import { webLink } from '~/utils/web-link'

// Add Dish. First a link: pasting one looks it up right away (Source Lookup)
// and shows a preview with the image and an editable Suggested Title. Or
// "Ohne Link hinzufügen": a title, a note and a Placeholder Image. The image
// dialog also takes the Member's own photo ("Eigenes Foto"). Either way
// the Member saves to the Board they are on (a Member of several Boards
// may pick another), through the client Board module. If the link is
// already on that Board, a warning names the Dish and its Column: open it,
// or save anyway. Saved, it passes on what the module answered and where
// the image showed, for the Dish to fly onto the Board from there.
const open = defineModel<boolean>('open', { required: true })
// `sharedLink`: a link shared to malkochen (BoardScreen), filled in when the
// sheet opens and looked up at once, as if pasted. `forTour`: the Dish is
// the one added during the Tour, which notifies nobody (ADR 0006).
const props = defineProps<{ boardId: string, sharedLink?: string | null, forTour?: boolean }>()
const emit = defineEmits<{ added: [result: BoardResult, from: DOMRect | null] }>()
const t = useStrings()
const boardModule = useBoardModule()

const form = useTemplateRef<HTMLFormElement>('form')
const withoutLink = ref(false)
const link = ref('')
// Looks the link up as soon as it is one: at once when pasted, after a short
// pause while typing. Only the latest lookup's answer counts.
const lookup = useLinkLookup(link)
const { status: lookupStatus, result, canonicalLink, tooMany: lookupTooMany } = lookup

const title = ref('')
const note = ref('')
// The note field's made-up example, a new one each time the sheet opens.
const noteExample = useExamplePrompt(() => t.dishNote.examples, example => t.dishNote.prompt(example))
// The Placeholder Image goes by the title, else the link (handoff
// illustrations.json autoPick), until the Member picks one.
const pickedPlaceholder = ref<Placeholder | null>(null)
const placeholder = computed<Placeholder>({
  get: () => pickedPlaceholder.value ?? autoPlaceholder(title.value, withoutLink.value ? null : link.value),
  set: picked => pickedPlaceholder.value = picked,
})
const boardId = ref(props.boardId)
const boards = ref<BoardSummary[]>([])
const linkId = useId()
const titleId = useId()
const titleHintId = useId()
const noteId = useId()
const boardSelectId = useId()
const duplicateHintId = useId()
const choosingImage = ref(false)
const saving = ref(false)
const failed = ref(false)

const showForm = computed(() => withoutLink.value || lookupStatus.value === 'found' || lookupStatus.value === 'failed')

// The Member's own photo, once uploaded: it is the image, whatever the
// link brings.
const photo = ref<UploadedPhoto | null>(null)
// The Source image, unless the Member swapped it for a Placeholder or their
// own photo, or it doesn't load in the browser either.
const sourceImageBroken = ref(false)
const preferPlaceholder = ref(false)
const sourceImage = computed(() => sourceImageBroken.value ? null : result.value?.imageUrl ?? null)
const usingSourceImage = computed(() => sourceImage.value !== null && !preferPlaceholder.value && !photo.value)
// The image shown large above the title: the own photo or the Source image.
// Without one, the inline picker shows instead.
const shownImage = computed(() => photo.value?.url ?? (usingSourceImage.value ? sourceImage.value : null))
// Where the Member shifted that image in the image dialog; a new image
// starts in the centre.
const imageFocus = ref<ImageFocus>({ ...FOCUS_CENTRE })
watch(shownImage, () => imageFocus.value = { ...FOCUS_CENTRE })
// Who published the Source (CONTEXT.md: Creator), if the lookup found them:
// shown under the title and saved with the Dish. Editing it is the detail's.
const creator = computed(() => withoutLink.value ? null : result.value?.creator ?? null)
// The Source shows no title (a Pin, a post without a caption): ask for one,
// kindly.
const titleNeeded = computed(() => result.value !== null && result.value.suggestedTitle === '' && title.value.trim() === '')

// The Source link the Dish is saved with: the canonical one if the lookup
// found it, else the link as pasted. None without a link, or before either.
const sourceLink = computed(() => {
  if (withoutLink.value) return null
  if (canonicalLink.value) return canonicalLink.value
  return lookupStatus.value === 'failed' ? webLink(link.value) : null
})

// A Dish with this Source already on the chosen Board (PRD story 24), asked
// again whenever the link or the Board changes. Saving waits for the answer,
// and while the warning shows, only "Trotzdem speichern" saves: "Speichern"
// is switched off, with a hint pointing up to the warning.
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

// "Öffnen": the detail of the Dish already on the Board, instead of adding
// it again.
async function openDuplicate() {
  if (!duplicate.value) return
  const found = duplicate.value
  // Its Board's address is on the list of Boards; until that has come, its
  // old address forwards there.
  const on = boards.value.find(b => b.id === boardId.value)
  open.value = false
  await navigateTo(on ? dishPath(on, found) : `/b/${boardId.value}/d/${found.id}`)
}

// The inline picker (handoff: 4×2) offers the first eight Placeholders; one
// chosen from the full picker ("Bild wählen") takes the last inline slot, so
// the selection is always in view.
const INLINE_COUNT = 8
const inlineOptions = computed<Placeholder[]>(() => {
  const first = PLACEHOLDERS.slice(0, INLINE_COUNT)
  return first.includes(placeholder.value) ? first : [...first.slice(0, -1), placeholder.value]
})
// A new link brings its own image; what the lookup found fills the
// Suggested Title. The field holds all of it at once (saving, the duplicate
// check and the prompt go by that); what it shows types in after the image
// blooms (handoff "Title types in"), unless the Member is in it already.
// Focusing it, a new link, or the image going (it broke, or the Member
// picked a Placeholder) show all of it.
const titleTypeIn = useTypeIn(title)
const { shown: shownTitle, typing: typingTitle } = titleTypeIn
watch(link, () => {
  sourceImageBroken.value = false
  preferPlaceholder.value = false
  titleTypeIn.finish()
})
watch(result, (found) => {
  if (!found) return
  title.value = found.suggestedTitle.slice(0, 200)
  if (document.activeElement?.id === titleId) return
  titleTypeIn.start(usingSourceImage.value ? motionMs('image-bloom') : 0, motionMs('type'))
})
watch(usingSourceImage, (using) => {
  if (!using) titleTypeIn.finish()
})
// No prompt while the title types in: it is coming.
const titlePlaceholder = computed(() => {
  if (typingTitle.value) return ''
  return titleNeeded.value ? t.addDish.titleNeeded : t.addDish.titlePrompt
})

const canPaste = ref(false)
onMounted(() => canPaste.value = typeof navigator.clipboard?.readText === 'function')
async function pasteFromClipboard() {
  const text = await navigator.clipboard.readText().catch(() => '')
  if (!text.trim()) return
  lookup.pasted()
  link.value = text.trim()
}

// Every opening starts from an empty form, on the Board the Member is on.
// Clearing the link drops any lookup still under way.
watch(open, async (isOpen) => {
  if (!isOpen) return
  withoutLink.value = false
  link.value = ''
  title.value = ''
  note.value = ''
  noteExample.pickAnother()
  pickedPlaceholder.value = null
  photo.value = null
  boardId.value = props.boardId
  failed.value = false
  if (props.sharedLink) {
    lookup.pasted()
    link.value = props.sharedLink
  }
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
    const added = await boardModule.addDish(target, {
      title: title.value,
      note: note.value,
      placeholder: placeholder.value,
      source,
      creator: creator.value,
      imageUrl: usingSourceImage.value ? sourceImage.value : null,
      imageTicket: usingSourceImage.value ? result.value?.imageTicket : null,
      photo: photo.value,
      ...shownImage.value && { imageFocus: imageFocus.value },
      ...props.forTour && { tour: true },
    })
    const image = form.value?.querySelector('[data-source-image], [role="radio"][aria-checked="true"]')
    emit('added', added, image?.getBoundingClientRect() ?? null)
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
      ref="form"
      class="mt-5 flex flex-col gap-5"
      novalidate
      @submit.prevent="save"
    >
      <template v-if="!withoutLink">
        <!-- Input "valid" and "loading": dots while the link is looked up,
             then, once found, a sage border and a check. Until there's a
             link to look up, it and "Ohne Link hinzufügen" are where the
             Tour points. -->
        <div
          class="flex flex-col gap-5"
          :data-tour="lookupStatus === 'idle' ? 'add-dish-link' : undefined"
        >
          <AppField
            :label="t.addDish.link"
            :control-id="linkId"
            :valid="!!result"
          >
            <span
              class="field-row"
              data-link-field
            >
              <span
                v-if="result"
                aria-hidden="true"
                class="source-dot found-pop h-2.5 w-2.5 shrink-0 rounded-full"
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
                @paste="lookup.pasted()"
              >
              <LoadingDots
                v-if="lookupStatus === 'looking'"
                class="shrink-0 text-text-muted"
              />
              <span
                v-else-if="result"
                aria-hidden="true"
                class="found-pop grid size-6 shrink-0 place-items-center rounded-full bg-sage text-sage-ink"
                data-link-found
              >
                <AppIcon
                  name="check"
                  :size="14"
                />
              </span>
              <button
                v-if="canPaste"
                type="button"
                class="shrink-0 rounded-pill bg-surface-muted px-3.5 py-2 text-label text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                @click="pasteFromClipboard"
              >
                {{ t.addDish.paste }}
              </button>
            </span>
          </AppField>

          <button
            v-if="lookupStatus === 'idle'"
            type="button"
            class="self-start rounded-pill bg-surface-muted px-4 py-2.5 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
            @click="withoutLink = true"
          >
            {{ t.addDish.withoutLink }}
          </button>
        </div>

        <div
          v-if="lookupStatus === 'looking'"
          role="status"
          class="lookup-panel flex flex-col items-center gap-3 rounded-panel px-4 py-6"
          data-lookup="looking"
        >
          <div class="aspect-[59/50] w-44">
            <SvgLoop
              src="/clips/lookup-stir"
              play
              :themed="false"
              transparent
            />
          </div>
          <span class="text-body">{{ t.addDish.lookingUp }}</span>
        </div>

        <div
          v-else-if="lookupStatus === 'failed'"
          role="status"
          class="flex items-center gap-3 rounded-panel bg-surface-muted p-3"
          data-lookup="failed"
        >
          <div class="aspect-[276/256] w-[72px] shrink-0">
            <SvgLoop
              src="/clips/lookup-failed"
              play
              :themed="false"
              transparent
            />
          </div>
          <span class="text-small">{{ lookupTooMany ? t.addDish.lookupTooMany : t.addDish.lookupFailed }}</span>
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
            <TopfbertIdle
              mood="wow"
              class="w-14 shrink-0"
            />
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
          v-if="shownImage"
          class="relative overflow-hidden rounded-thumb bg-surface-muted"
        >
          <img
            v-if="photo"
            :src="photo.url"
            :alt="t.imageDialog.ownPhoto"
            class="aspect-[4/3] w-full object-cover"
            :style="{ objectPosition: focusPosition(imageFocus) }"
            data-source-image
            data-own-photo
          >
          <img
            v-else
            :src="sourceImage!"
            :alt="t.addDish.sourceImage"
            referrerpolicy="no-referrer"
            class="bloom aspect-[4/3] w-full object-cover"
            :style="{ objectPosition: focusPosition(imageFocus) }"
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

        <div class="flex flex-col">
          <AppField
            :label="t.addDish.title"
            :control-id="titleId"
          >
            <input
              :id="titleId"
              v-model="shownTitle"
              type="text"
              required
              maxlength="200"
              autocomplete="off"
              :placeholder="titlePlaceholder"
              :aria-describedby="titleNeeded ? titleHintId : undefined"
              class="font-display text-title-s"
              :class="{ 'title-prompt': titleNeeded }"
              @focus="titleTypeIn.finish()"
            >
          </AppField>
          <span
            v-if="titleNeeded"
            :id="titleHintId"
            class="field-helper"
          >{{ t.addDish.titleNeededHint }}</span>
          <p
            v-if="creator"
            class="break-words pl-4 pt-2 text-small text-text-muted"
            data-creator
          >
            <span class="sr-only">{{ `${t.dish.creator} ` }}</span>{{ creator }}
          </p>
        </div>

        <div
          v-if="!shownImage"
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
              class="section-heading"
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

        <AppField
          :label="t.addDish.note"
          :control-id="noteId"
        >
          <textarea
            :id="noteId"
            v-model="note"
            maxlength="2000"
            :placeholder="noteExample.prompt.value"
          />
        </AppField>

        <!-- During the Tour, the Dish goes onto the Board the Tour is on. -->
        <AppField
          v-if="boards.length > 1 && !forTour"
          :label="t.addDish.board"
          :control-id="boardSelectId"
        >
          <select
            :id="boardSelectId"
            v-model="boardId"
          >
            <option
              v-for="board in boards"
              :key="board.id"
              :value="board.id"
            >
              {{ board.emoji }} {{ board.name }}
            </option>
          </select>
          <AppIcon name="down" />
        </AppField>

        <p
          v-if="failed"
          role="alert"
          class="text-small text-danger"
        >
          {{ t.addDish.failed }}
        </p>

        <!-- Saving, it shows its dots undimmed; save() ignores a second
             submit meanwhile. While the duplicate warning shows, it stays,
             switched off, and a hint right above it says why and points up
             to the warning, where "Trotzdem speichern" is (#207). -->
        <div class="flex flex-col gap-2.5">
          <p
            v-if="warnDuplicate"
            :id="duplicateHintId"
            class="duplicate-hint flex items-center gap-2.5 rounded-panel px-3 py-2.5 text-small"
            data-duplicate-hint
          >
            <span
              aria-hidden="true"
              class="hint-arrow grid size-7 shrink-0 place-items-center rounded-full bg-butter text-on-accent"
            >
              <AppIcon
                name="up"
                :size="16"
              />
            </span>
            {{ t.addDish.duplicateHint }}
          </p>
          <button
            type="submit"
            class="rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            :disabled="!canSave && !saving"
            :aria-busy="saving"
            :aria-describedby="warnDuplicate ? duplicateHintId : undefined"
          >
            <BusyLabel
              :label="t.addDish.save"
              :busy-label="t.addDish.saving"
              :busy="saving"
            />
          </button>
        </div>
      </template>
    </form>

    <!-- Picking a Placeholder here replaces the Source image and any own
         photo; "Bild vom Link" takes the Source image back. -->
    <ImageDialog
      v-model:open="choosingImage"
      v-model:placeholder="placeholder"
      v-model:focus="imageFocus"
      :title="t.addDish.chooseImage"
      :close-label="t.addDish.close"
      :board-id="boardId"
      :offer-source="sourceImage !== null"
      :source-image="sourceImage"
      :image="shownImage"
      @source="preferPlaceholder = false; photo = null"
      @photo="photo = $event"
      @placeholder="preferPlaceholder = true; photo = null"
    />
  </AppSheet>
</template>

<style scoped>
/* remotion-briefs.json lookup-stir: butter 22% into surface-muted, the
   panel Topfbert stirs on (his drawing has no background of its own). */
.lookup-panel {
  background: color-mix(in oklch, var(--color-butter) 22%, var(--color-surface-muted));
}
/* Same butter wash as the lookup panel, a little stronger: it asks for a
   decision. */
.duplicate-panel {
  background: color-mix(in oklch, var(--color-butter) 38%, var(--color-surface-muted));
}
/* The hint by the switched-off save button wears the lookup panel's lighter
   wash, and its arrow nods up toward the warning. Reduced motion: it rests. */
.duplicate-hint {
  background: color-mix(in oklch, var(--color-butter) 22%, var(--color-surface-muted));
}
.hint-arrow {
  animation: hint-nod var(--dur-idle) var(--ease-idle) infinite;
}
@keyframes hint-nod {
  50% { translate: 0 -3px; }
}
/* What the lookup found comes in (handoff "Image bloom", SourceBadge
   "found"): the image settles from 1.08 as it fades in (1.2s, swoosh), and
   the Source's dot and the link field's check pop from nothing a third of
   the way in. Reduced motion: they are just there. */
.bloom {
  animation: bloom var(--dur-image-bloom) var(--ease-swoosh);
}
@keyframes bloom {
  from {
    scale: 1.08;
    opacity: 0;
  }
}
.found-pop {
  animation: found-pop var(--dur-pop) var(--ease-pop) calc(var(--dur-image-bloom) * .34) backwards;
}
@keyframes found-pop {
  from { scale: 0; }
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
