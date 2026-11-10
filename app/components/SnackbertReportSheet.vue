<script setup lang="ts">
import { shrinkPhoto } from '~/composables/usePhotoUpload'
import { RECORDING_LIMIT_SECONDS, WAVE_BARS } from '~/composables/useVoiceRecording'
import type { ReportOutcome } from '~/composables/useSnackbertReports'

// The sheet for a Snackbert Report (#424, decisions in #422: tiles, the
// confirmation in the sheet): at the top Snackbert's face next to "Pasta,
// heute gekocht" and the line saying all of it is optional; then three
// tiles, Foto, Aufnahme and Text, each opening its panel below (one at a
// time) and ticked once there is something in it; then "Senden", or "Ohne
// alles senden" while nothing has been added. The photo is shrunk in the
// browser to a JPEG of at most 1000 px; the recording (at most two minutes)
// is only asked the microphone for when the record button is pressed. Sent,
// the sheet's content becomes Snackbert's smart face popping in, the
// confirmation and "Fertig". When sending doesn't work the sheet stays open
// with everything that was added, and says why. Every opening starts empty.
// What is sent, and what each answer means, is useSnackbertReports'.
const open = defineModel<boolean>('open', { required: true })
// `waiting`: its Cooking is still an Unsent Change, so the server doesn't have it yet
// (#459): the sheet says what it does offline, and sends nothing.
const props = defineProps<{ dish: string, cookingId: string | null, cookedAt: string | null, waiting?: boolean }>()
const t = useStrings()
const reports = useSnackbertReports()
const reachable = useOnline()
const online = computed(() => reachable.value && !props.waiting)
const voice = useVoiceRecording()

type Tile = 'photo' | 'voice' | 'text'
const tile = ref<Tile | null>(null)
const text = ref('')
const photo = ref<Blob | null>(null)
const photoUrl = ref<string | null>(null)
// The browser couldn't open the picked photo (HEIC in Chrome, say).
const photoUnreadable = ref(false)
const sending = ref(false)
const sent = ref(false)
const problem = ref<Exclude<ReportOutcome, 'sent'> | null>(null)
const panelId = useId()
const textId = useId()

// What was added, if anything.
const hasPhoto = computed(() => !!photo.value)
const hasVoice = computed(() => voice.state.value === 'done')
const hasText = computed(() => !!text.value.trim())
const hasAny = computed(() => hasPhoto.value || hasVoice.value || hasText.value)
const tiles: { key: Tile, has: Ref<boolean> }[] = [
  { key: 'photo', has: hasPhoto },
  { key: 'voice', has: hasVoice },
  { key: 'text', has: hasText },
]

// "Pasta, heute gekocht", or the day it was cooked on.
const cookedLine = computed(() => t.snackbertReport.cooked(props.dish, props.cookedAt ? new Date(props.cookedAt) : new Date()))

function setPhoto(next: Blob | null) {
  if (photoUrl.value) URL.revokeObjectURL(photoUrl.value)
  photo.value = next
  photoUrl.value = next ? URL.createObjectURL(next) : null
}

// The recording to play back, from a blob: URL of its own.
const recordingUrl = ref<string | null>(null)
watch(() => voice.recording.value, (recording) => {
  if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value)
  recordingUrl.value = recording ? URL.createObjectURL(recording) : null
  playing.value = false
})
const camera = useTemplateRef<HTMLInputElement>('camera')
const gallery = useTemplateRef<HTMLInputElement>('gallery')
const audio = useTemplateRef<HTMLAudioElement>('audio')
const playing = ref(false)
function togglePlay() {
  const el = audio.value
  if (!el) return
  if (playing.value) {
    el.pause()
    return
  }
  el.currentTime = 0
  void el.play().catch(() => {})
}

// A photo picked (camera or gallery): shrunk at once, so what is previewed is
// what is sent. Only the latest pick counts.
let picks = 0
async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // So picking the same file again still counts.
  input.value = ''
  if (!file) return
  const pick = ++picks
  const shrunk = await shrinkPhoto(file, 1000, 0.85)
  if (pick !== picks) return
  photoUnreadable.value = !shrunk
  if (shrunk) setPhoto(shrunk)
}

function toggleTile(next: Tile) {
  tile.value = tile.value === next ? null : next
}

// Resolves once a recording that was told to stop has its data (or, at
// worst, after a few seconds).
function stopped(): Promise<void> {
  return new Promise((resolve) => {
    const give = setTimeout(done, 3000)
    const unwatch = watch(voice.state, (now) => {
      if (now !== 'recording') done()
    })
    function done() {
      clearTimeout(give)
      unwatch()
      resolve()
    }
  })
}

async function submit() {
  if (sending.value || !online.value || !props.cookingId) return
  sending.value = true
  problem.value = null
  // A recording still running ends here, and goes with the Report.
  if (voice.state.value === 'recording') {
    voice.stop()
    await stopped()
  }
  const outcome = await reports.send(props.cookingId, { text: text.value, photo: photo.value, recording: voice.recording.value })
  sending.value = false
  if (outcome === 'sent') sent.value = true
  else problem.value = outcome
}

// Every opening starts empty. Closing lets go of the microphone, but leaves
// the content in place while the sheet moves out.
watch(open, (isOpen) => {
  if (!isOpen) {
    voice.stop()
    audio.value?.pause()
    return
  }
  picks++
  tile.value = null
  text.value = ''
  setPhoto(null)
  photoUnreadable.value = false
  voice.reset()
  sent.value = false
  sending.value = false
  problem.value = null
})
onBeforeUnmount(() => {
  setPhoto(null)
  if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value)
})

const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
// The waveform: a bar for each of the last samples, the rest at rest height.
const bars = computed(() => Array.from({ length: WAVE_BARS }, (_, i) => {
  const level = voice.levels.value[i]
  return level === undefined ? 3 : 3 + Math.round(level * 21)
}))

const problemLine = computed(() => {
  switch (problem.value) {
    case 'full': return t.snackbertReport.full
    case 'noAccount': return t.snackbertReport.noAccount
    case 'tooLarge': return t.snackbertReport.tooLarge
    case 'failed': return t.snackbertReport.failed
    default: return null
  }
})
const tileLabel: Record<Tile, () => string> = {
  photo: () => t.snackbertReport.tiles.photo,
  voice: () => t.snackbertReport.tiles.voice,
  text: () => t.snackbertReport.tiles.text,
}
const bigButton = 'flex items-center justify-center gap-2 rounded-[16px] bg-surface px-2.5 py-3.5 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
const chip = 'rounded-pill bg-surface px-3 py-1.5 text-label transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus'
</script>

<template>
  <AppSheet
    v-model:open="open"
    :title="t.snackbertReport.title"
    :close-label="t.dish.closeMenu"
  >
    <!-- Sent: Snackbert's smart face pops in. -->
    <div
      v-if="sent"
      class="sent flex flex-col items-center gap-3 pb-2 pt-4 text-center"
      data-snackbert-sent
    >
      <img
        src="/snackbert/face_smart.webp"
        alt=""
        width="150"
        height="150"
        class="face w-[150px]"
      >
      <p class="font-display text-title-m">
        {{ t.snackbertReport.thanks }}
      </p>
      <p class="text-small text-text-muted">
        {{ t.snackbertReport.thanksSub }}
      </p>
      <button
        type="button"
        class="mt-2 w-full rounded-pill bg-butter px-5 py-3 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
        @click="open = false"
      >
        {{ t.snackbertReport.done }}
      </button>
    </div>

    <form
      v-else
      class="flex flex-col gap-3 pt-3"
      @submit.prevent="submit"
    >
      <input
        ref="camera"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        tabindex="-1"
        @change="onPick"
      >
      <input
        ref="gallery"
        type="file"
        accept="image/*"
        class="hidden"
        tabindex="-1"
        @change="onPick"
      >
      <div class="flex items-center gap-3">
        <img
          src="/snackbert/face.webp"
          alt=""
          width="72"
          height="72"
          class="w-[72px] shrink-0"
        >
        <div class="flex min-w-0 flex-col gap-1">
          <p class="break-words font-display text-body-serif">
            {{ cookedLine }}
          </p>
          <p class="text-small text-text-muted">
            {{ t.snackbertReport.optional }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="entry in tiles"
          :key="entry.key"
          type="button"
          class="tile"
          :class="{ 'is-open': tile === entry.key, 'has-content': entry.has.value }"
          :aria-expanded="tile === entry.key"
          :aria-controls="panelId"
          :data-tile="entry.key"
          @click="toggleTile(entry.key)"
        >
          <img
            v-if="entry.key === 'photo'"
            src="/snackbert/cam.webp"
            alt=""
            width="64"
            height="64"
          >
          <img
            v-else-if="entry.key === 'voice'"
            src="/snackbert/mic.webp"
            alt=""
            width="64"
            height="64"
          >
          <span
            v-else
            class="pen"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              width="34"
              height="34"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            ><path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" /><path d="M14.5 6.5l3 3" /></svg>
          </span>
          <span class="text-label">{{ tileLabel[entry.key]() }}</span>
          <span
            class="tick"
            aria-hidden="true"
          >✓</span>
        </button>
      </div>

      <div
        v-show="tile"
        :id="panelId"
        class="panel"
        role="group"
        :aria-label="tile ? tileLabel[tile]() : undefined"
      >
        <!-- Foto. -->
        <template v-if="tile === 'photo'">
          <img
            v-if="photoUrl"
            :src="photoUrl"
            alt=""
            class="aspect-[4/3] w-full rounded-[16px] object-cover"
            data-report-photo
          >
          <p
            v-if="photoUnreadable"
            role="alert"
            class="text-small text-text-muted"
          >
            {{ t.snackbertReport.photoUnreadable }}
          </p>
          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              :class="bigButton"
              @click="camera?.click()"
            >
              <AppIcon name="camera" />
              {{ t.snackbertReport.camera }}
            </button>
            <button
              type="button"
              :class="bigButton"
              @click="gallery?.click()"
            >
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                stroke-width="2.3"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              ><rect
                x="4"
                y="5"
                width="16"
                height="14"
                rx="2"
              /><path d="M4 16l5-5 4 4 2-2 5 5" /><circle
                cx="15.5"
                cy="9.5"
                r="1.5"
              /></svg>
              {{ t.snackbertReport.gallery }}
            </button>
          </div>
          <button
            v-if="photo"
            type="button"
            :class="chip"
            class="self-center"
            @click="setPhoto(null)"
          >
            {{ t.snackbertReport.removePhoto }}
          </button>
        </template>

        <!-- Aufnahme. -->
        <div
          v-else-if="tile === 'voice'"
          class="flex flex-col items-center gap-2.5"
        >
          <p
            class="text-title-m tabular-nums"
            data-report-clock
          >
            {{ clock(voice.seconds.value) }}<span class="text-small text-text-muted"> / {{ clock(RECORDING_LIMIT_SECONDS) }}</span>
          </p>
          <div
            class="wave w-full justify-center"
            :class="{ live: voice.state.value === 'recording' }"
            aria-hidden="true"
          >
            <i
              v-for="(height, i) in bars"
              :key="i"
              :style="{ height: `${height}px` }"
            />
          </div>
          <div class="flex items-center gap-3">
            <button
              v-if="voice.state.value === 'done'"
              type="button"
              :class="chip"
              :aria-pressed="playing"
              @click="togglePlay"
            >
              {{ t.snackbertReport.play }}
            </button>
            <button
              type="button"
              class="rec"
              :class="{ 'is-rec': voice.state.value === 'recording' }"
              :aria-label="voice.state.value === 'recording' ? t.snackbertReport.stop : t.snackbertReport.record"
              data-report-record
              @click="voice.state.value === 'recording' ? voice.stop() : voice.start()"
            >
              <span :class="voice.state.value === 'recording' ? 'square' : 'dot'" />
            </button>
            <button
              v-if="voice.state.value === 'done'"
              type="button"
              :class="chip"
              @click="voice.start()"
            >
              {{ t.snackbertReport.rerecord }}
            </button>
          </div>
          <p
            v-if="voice.problem.value"
            role="alert"
            class="text-center text-small text-text-muted"
          >
            {{ voice.problem.value === 'denied' ? t.snackbertReport.micDenied : t.snackbertReport.micUnavailable }}
          </p>
          <p class="text-caption text-text-muted">
            {{ t.snackbertReport.limit }}
          </p>
        </div>

        <!-- Text. -->
        <textarea
          v-else-if="tile === 'text'"
          :id="textId"
          v-model="text"
          rows="3"
          maxlength="1000"
          class="w-full resize-none rounded-[14px] bg-surface px-3 py-2.5 text-body outline-none placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          :aria-label="t.snackbertReport.textLabel"
          :placeholder="t.snackbertReport.textPrompt"
        />
      </div>
      <!-- Kept outside the panel, so playing goes on while another tile is open. -->
      <audio
        v-if="recordingUrl"
        ref="audio"
        :src="recordingUrl"
        class="hidden"
        @play="playing = true"
        @pause="playing = false"
        @ended="playing = false"
      />

      <p
        v-if="problemLine"
        role="alert"
        class="text-small text-danger"
        data-report-problem
      >
        {{ problemLine }}
      </p>
      <p
        v-if="!online"
        role="status"
        class="text-small text-text-muted"
      >
        {{ t.snackbertReport.offline }}
      </p>
      <button
        type="submit"
        class="rounded-pill bg-butter px-5 py-3 text-button text-on-accent transition-transform duration-tap ease-tap enabled:active:scale-95 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-focus"
        :disabled="sending || !online"
      >
        <BusyLabel
          :label="problem === 'failed' ? t.snackbertReport.retry : hasAny ? t.snackbertReport.send : t.snackbertReport.sendBare"
          :busy-label="t.snackbertReport.sending"
          :busy="sending"
        />
      </button>
    </form>
  </AppSheet>
</template>

<style scoped>
.tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-radius: 20px;
  background: var(--color-surface-muted);
  padding: 10px 6px;
  transition: scale var(--dur-tap) var(--ease-tap), background-color var(--dur-fade);
}
.tile:active {
  scale: .96;
}
.tile:focus-visible {
  outline: 2px solid var(--color-focus);
}
.tile img {
  width: 64px;
  height: 64px;
  object-fit: contain;
}
.tile.is-open {
  background: color-mix(in oklab, var(--color-butter) 35%, var(--color-surface-muted));
}
.pen {
  display: flex;
  width: 64px;
  height: 64px;
  align-items: center;
  justify-content: center;
}
/* The sage tick on a tile with something in it. */
.tick {
  position: absolute;
  right: 8px;
  top: 8px;
  display: none;
  width: 22px;
  height: 22px;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: var(--color-sage);
  color: var(--color-sage-ink);
  font: 700 13px/1 var(--font-ui);
}
.tile.has-content .tick {
  display: flex;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 20px;
  background: var(--color-surface-muted);
  padding: 14px;
  animation: panel-open var(--dur-settle) var(--ease-settle) backwards;
}
@keyframes panel-open {
  from { opacity: 0; translate: 0 -8px; }
}
.rec {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
}
.rec:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
}
.rec.is-rec {
  box-shadow: inset 0 0 0 2px var(--color-danger);
  animation: rec-pulse 1.4s ease-in-out infinite;
}
.dot {
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: var(--color-danger);
}
.square {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  background: var(--color-danger);
}
@keyframes rec-pulse {
  50% { box-shadow: inset 0 0 0 2px var(--color-danger), 0 0 0 6px color-mix(in srgb, var(--color-danger) 20%, transparent); }
}
.wave {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 24px;
}
.wave i {
  display: block;
  width: 3px;
  border-radius: 2px;
  background: var(--color-text-muted);
  transition: height 100ms;
}
.wave.live i {
  background: var(--color-danger);
}
/* The confirmation: his face pops in (scale from .5). Reduced motion: it
   only fades. */
.sent .face {
  animation: face-pop var(--dur-pop) var(--ease-pop) backwards;
}
@keyframes face-pop {
  from { scale: .5; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .sent .face {
    animation: face-fade var(--dur-fade) var(--ease-fade) backwards;
  }
  .panel {
    animation: face-fade var(--dur-fade) var(--ease-fade) backwards;
  }
  .rec.is-rec {
    animation: none;
  }
}
@keyframes face-fade {
  from { opacity: 0; }
}
</style>
