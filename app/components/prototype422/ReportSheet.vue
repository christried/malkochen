<script setup lang="ts">
// PROTOTYPE #422: throwaway, never merge. The report sheet: a photo of the
// portion (camera or gallery), a recording (running time, stops at 2:00,
// record again), a few words, the line saying all of it is optional, and
// "Senden". Three layouts (?blatt=A list, B tiles with Snackbert, C a chat
// with him); then the confirmation (?danke=A in the sheet, B he grabs it
// and leaves, C a toast with his head). Nothing leaves the page.
// For screenshots: ?foto=1 puts in a sample photo, ?aufnahme=rec|done a
// recording at 0:37, ?worte=1 a few words, ?offen=1 opens the sheet.
const state = useP422()
const picks = useP422Picks()
const route = useRoute()
const c = computed(() => picks.value.copy)

const open = computed({
  get: () => !!state.value.sheet,
  set: (v) => {
    if (!v) state.value.sheet = null
  },
})
// The sheet's title stays while it moves out.
const dish = ref('Cremige Pilzpasta')
watch(() => state.value.sheet, (s) => {
  if (!s) return
  dish.value = s.dish
  reset()
})

const sent = ref(false)
const photo = ref<string | null>(null)
const words = ref('')
const rec = ref<'idle' | 'rec' | 'done'>('idle')
const seconds = ref(0)
const tile = ref<'photo' | 'voice' | 'text' | null>(null)
const LIMIT = 120

function reset() {
  sent.value = false
  photo.value = route.query.foto === '1' ? '/placeholders/pasta-light.svg' : null
  words.value = route.query.worte === '1' ? (c.value.wordsPrompt.split(': ')[1] ?? '') : ''
  const r = route.query.aufnahme
  rec.value = r === 'rec' || r === 'done' ? r : 'idle'
  seconds.value = rec.value === 'idle' ? 0 : 37
  tile.value = route.query.foto === '1' ? 'photo' : r ? 'voice' : null
  if (rec.value === 'rec') tick()
}

onMounted(() => {
  if (route.query.offen === '1') state.value.sheet = { dish: 'Cremige Pilzpasta', cookingId: null }
})

let clock: ReturnType<typeof setInterval> | undefined
function tick() {
  clearInterval(clock)
  if (route.query.aufnahme === 'rec') return
  clock = setInterval(() => {
    seconds.value++
    if (seconds.value >= LIMIT) stop()
  }, 1000)
}
function record() {
  seconds.value = 0
  rec.value = 'rec'
  tick()
}
function stop() {
  clearInterval(clock)
  rec.value = 'done'
}
onBeforeUnmount(() => clearInterval(clock))
const time = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const camera = useTemplateRef<HTMLInputElement>('camera')
const gallery = useTemplateRef<HTMLInputElement>('gallery')
function picked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) photo.value = URL.createObjectURL(file)
}

const hasAny = computed(() => !!photo.value || rec.value === 'done' || !!words.value.trim())

function send() {
  stop()
  const s = state.value.sheet
  if (s?.cookingId && !state.value.reported.includes(s.cookingId)) state.value.reported.push(s.cookingId)
  if (picks.value.danke === 'A') {
    sent.value = true
    return
  }
  state.value.sheet = null
  setTimeout(() => {
    if (picks.value.danke === 'B') p422Thanks()
    else state.value.toast = true
  }, 260)
}

// The bars of a recording, made up.
const bars = Array.from({ length: 28 }, (_, i) => 6 + Math.round(14 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * .6))))
</script>

<template>
  <AppSheet
    v-model:open="open"
    :title="sent ? '' : c.sheetTitle"
    :close-label="c.close"
  >
    <input
      ref="camera"
      type="file"
      accept="image/*"
      capture="environment"
      class="hidden"
      @change="picked"
    >
    <input
      ref="gallery"
      type="file"
      accept="image/*"
      class="hidden"
      @change="picked"
    >

    <!-- Confirmation A: in the sheet. -->
    <div
      v-if="sent"
      class="p422-sent flex flex-col items-center gap-3 pb-2 pt-2 text-center"
      data-p422-sent
    >
      <img
        :src="P422_FACE.smart"
        alt=""
        class="w-[150px]"
      >
      <p class="font-display text-title-m">
        {{ c.thanks[picks.text] }}
      </p>
      <p class="text-small text-text-muted">
        {{ c.thanksSub }}
      </p>
      <button
        type="button"
        class="mt-2 w-full rounded-pill bg-butter px-5 py-3 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95"
        @click="open = false"
      >
        {{ c.done }}
      </button>
    </div>

    <!-- A: a list, one thing under the other. -->
    <div
      v-else-if="picks.blatt === 'A'"
      class="flex flex-col gap-3 pt-1"
      data-p422-sheet="A"
    >
      <p class="flex items-center gap-2 text-small text-text-muted">
        <img
          :src="P422_FACE.think"
          alt=""
          class="w-7"
        >
        {{ c.sheetSub(dish) }}
      </p>

      <section class="flex flex-col gap-2.5 rounded-[20px] bg-surface-muted p-3.5">
        <h3 class="text-label">
          {{ c.photo }}
        </h3>
        <div
          v-if="photo"
          class="flex items-center gap-3"
        >
          <img
            :src="photo"
            alt=""
            class="h-20 w-20 rounded-[14px] object-cover"
          >
          <div class="flex flex-col items-start gap-1.5">
            <button
              type="button"
              class="p422-chip"
              @click="gallery?.click()"
            >
              {{ c.photoChange }}
            </button>
            <button
              type="button"
              class="p422-chip text-danger"
              @click="photo = null"
            >
              {{ c.photoRemove }}
            </button>
          </div>
        </div>
        <div
          v-else
          class="grid grid-cols-2 gap-2"
        >
          <button
            type="button"
            class="p422-big"
            @click="camera?.click()"
          >
            <Prototype422Icon name="camera" /> {{ c.camera }}
          </button>
          <button
            type="button"
            class="p422-big"
            @click="gallery?.click()"
          >
            <Prototype422Icon name="image" /> {{ c.gallery }}
          </button>
        </div>
      </section>

      <section class="flex flex-col gap-2.5 rounded-[20px] bg-surface-muted p-3.5">
        <h3 class="flex items-baseline justify-between text-label">
          {{ c.recording }} <small class="text-caption text-text-muted">{{ c.limit }}</small>
        </h3>
        <div class="flex items-center gap-3">
          <button
            v-if="rec !== 'rec'"
            type="button"
            class="p422-rec"
            :aria-label="rec === 'done' ? c.rerecord : c.record"
            @click="record"
          >
            <span class="p422-dot" />
          </button>
          <button
            v-else
            type="button"
            class="p422-rec is-rec"
            :aria-label="c.stop"
            @click="stop"
          >
            <span class="p422-square" />
          </button>
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div
              v-if="rec !== 'idle'"
              class="p422-wave"
              :class="{ live: rec === 'rec' }"
            >
              <i
                v-for="(h, i) in bars"
                :key="i"
                :style="{ height: `${rec === 'rec' && i > seconds % 28 + 10 ? 3 : h}px` }"
              />
            </div>
            <p class="text-small tabular-nums">
              <template v-if="rec === 'idle'">
                {{ c.record }}
              </template>
              <template v-else-if="rec === 'rec'">
                <b class="text-danger">●</b> {{ time(seconds) }} / 2:00
              </template>
              <template v-else>
                {{ time(seconds) }}
                <button
                  type="button"
                  class="p422-chip ml-2"
                >
                  ▶ {{ c.play }}
                </button>
                <button
                  type="button"
                  class="p422-chip ml-1"
                  @click="record"
                >
                  {{ c.rerecord }}
                </button>
              </template>
            </p>
          </div>
        </div>
      </section>

      <section class="flex flex-col gap-2 rounded-[20px] bg-surface-muted p-3.5">
        <h3 class="text-label">
          {{ c.words }}
        </h3>
        <textarea
          v-model="words"
          rows="2"
          class="w-full resize-none rounded-[14px] bg-surface px-3 py-2.5 text-body outline-none placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          :placeholder="c.wordsPrompt"
        />
      </section>

      <p class="px-1 text-small text-text-muted">
        {{ c.optional }}
      </p>
      <button
        type="button"
        class="rounded-pill bg-butter px-5 py-3 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95"
        @click="send"
      >
        {{ hasAny ? c.send : c.sendBare }}
      </button>
    </div>

    <!-- B: three tiles with Snackbert holding the thing. -->
    <div
      v-else-if="picks.blatt === 'B'"
      class="flex flex-col gap-4 pt-1"
      data-p422-sheet="B"
    >
      <div class="flex items-center gap-3">
        <img
          :src="P422_FACE.happy"
          alt=""
          class="w-[72px] shrink-0"
        >
        <div class="flex flex-col gap-1">
          <p class="font-display text-body-serif">
            {{ c.sheetSub(dish) }}
          </p>
          <p class="text-small text-text-muted">
            {{ c.optional }}
          </p>
        </div>
      </div>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="k in (['photo', 'voice', 'text'] as const)"
          :key="k"
          type="button"
          class="p422-tile"
          :class="{ on: tile === k, has: (k === 'photo' && photo) || (k === 'voice' && rec === 'done') || (k === 'text' && words.trim()) }"
          @click="tile = tile === k ? null : k"
        >
          <img
            v-if="k !== 'text'"
            :src="k === 'photo' ? P422_FACE.cam : P422_FACE.mic"
            alt=""
          >
          <span
            v-else
            class="p422-pen"
          >✎</span>
          <span class="text-label">{{ c.tiles[k] }}</span>
          <span
            class="p422-check"
            aria-hidden="true"
          >✓</span>
        </button>
      </div>

      <div
        v-if="tile === 'photo'"
        class="p422-panel"
      >
        <img
          v-if="photo"
          :src="photo"
          alt=""
          class="aspect-[4/3] w-full rounded-[16px] object-cover"
        >
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="p422-big"
            @click="camera?.click()"
          >
            <Prototype422Icon name="camera" /> {{ c.camera }}
          </button>
          <button
            type="button"
            class="p422-big"
            @click="gallery?.click()"
          >
            <Prototype422Icon name="image" /> {{ c.gallery }}
          </button>
        </div>
      </div>
      <div
        v-else-if="tile === 'voice'"
        class="p422-panel items-center"
      >
        <p class="text-title-m tabular-nums">
          {{ time(seconds) }}<span class="text-small text-text-muted"> / 2:00</span>
        </p>
        <div
          class="p422-wave w-full justify-center"
          :class="{ live: rec === 'rec' }"
        >
          <i
            v-for="(h, i) in bars"
            :key="i"
            :style="{ height: `${rec === 'idle' ? 3 : h}px` }"
          />
        </div>
        <div class="flex items-center gap-3">
          <button
            v-if="rec === 'done'"
            type="button"
            class="p422-chip"
          >
            ▶ {{ c.play }}
          </button>
          <button
            type="button"
            class="p422-rec big"
            :class="{ 'is-rec': rec === 'rec' }"
            :aria-label="rec === 'rec' ? c.stop : c.record"
            @click="rec === 'rec' ? stop() : record()"
          >
            <span :class="rec === 'rec' ? 'p422-square' : 'p422-dot'" />
          </button>
          <button
            v-if="rec === 'done'"
            type="button"
            class="p422-chip"
            @click="record"
          >
            {{ c.rerecord }}
          </button>
        </div>
        <p class="text-caption text-text-muted">
          {{ c.limit }}
        </p>
      </div>
      <div
        v-else-if="tile === 'text'"
        class="p422-panel"
      >
        <textarea
          v-model="words"
          rows="3"
          class="w-full resize-none rounded-[14px] bg-surface px-3 py-2.5 text-body outline-none placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
          :placeholder="c.wordsPrompt"
        />
      </div>

      <button
        type="button"
        class="rounded-pill bg-butter px-5 py-3 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95"
        @click="send"
      >
        {{ hasAny ? c.send : c.sendBare }}
      </button>
    </div>

    <!-- C: a chat with Snackbert. -->
    <div
      v-else
      class="flex flex-col gap-3 pt-1"
      data-p422-sheet="C"
    >
      <div class="flex items-end gap-2">
        <img
          :src="P422_FACE.think"
          alt=""
          class="w-12 shrink-0"
        >
        <p class="p422-them font-display text-body-serif">
          {{ c.chatHello(dish) }}
        </p>
      </div>
      <img
        v-if="photo"
        :src="photo"
        alt=""
        class="p422-mine aspect-square w-40 object-cover"
      >
      <div
        v-if="rec !== 'idle'"
        class="p422-mine flex items-center gap-2 px-3 py-2.5"
      >
        <span class="text-small">{{ rec === 'rec' ? '●' : '▶' }}</span>
        <div
          class="p422-wave"
          :class="{ live: rec === 'rec' }"
        >
          <i
            v-for="(h, i) in bars.slice(0, 18)"
            :key="i"
            :style="{ height: `${h}px` }"
          />
        </div>
        <span class="text-small tabular-nums">{{ time(seconds) }}</span>
      </div>
      <p
        v-if="words.trim() && rec !== 'rec'"
        class="p422-mine whitespace-pre-line px-3.5 py-2.5 text-body"
      >
        {{ words }}
      </p>
      <p class="px-1 text-caption text-text-muted">
        {{ c.optional }}
      </p>
      <div class="flex items-end gap-1.5 rounded-[24px] bg-surface-muted p-1.5">
        <button
          type="button"
          class="p422-icon"
          :aria-label="c.camera"
          @click="camera?.click()"
        >
          <Prototype422Icon name="camera" />
        </button>
        <button
          type="button"
          class="p422-icon"
          :aria-label="c.gallery"
          @click="gallery?.click()"
        >
          <Prototype422Icon name="image" />
        </button>
        <textarea
          v-if="rec !== 'rec'"
          v-model="words"
          rows="1"
          class="min-h-10 min-w-0 flex-1 resize-none bg-transparent px-1 py-2 text-body outline-none placeholder:text-text-muted"
          :placeholder="c.chatPrompt"
        />
        <p
          v-else
          class="flex min-h-10 flex-1 items-center gap-2 px-1 text-small tabular-nums"
        >
          <b class="text-danger">●</b> {{ time(seconds) }} / 2:00
        </p>
        <button
          type="button"
          class="p422-icon"
          :class="{ 'bg-danger text-white': rec === 'rec' }"
          :aria-label="rec === 'rec' ? c.stop : c.record"
          @click="rec === 'rec' ? stop() : record()"
        >
          <Prototype422Icon
            v-if="rec !== 'rec'"
            name="mic"
          />
          <span
            v-else
            class="p422-square small"
          />
        </button>
      </div>
      <button
        type="button"
        class="rounded-pill bg-butter px-5 py-3 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95"
        @click="send"
      >
        {{ hasAny ? c.send : c.sendBare }}
      </button>
    </div>
  </AppSheet>
</template>

<style scoped>
.p422-chip {
  border-radius: 999px;
  background: var(--color-surface);
  padding: 5px 11px;
  font: 600 13px/1.2 var(--font-ui);
}
.p422-big {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 16px;
  background: var(--color-surface);
  padding: 14px 10px;
  font: 600 15px/1.2 var(--font-ui);
  transition: scale var(--dur-tap) var(--ease-tap);
}
.p422-big:active { scale: .96; }
.p422-rec {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 999px;
  background: var(--color-surface);
  box-shadow: inset 0 0 0 2px var(--color-line-strong);
}
.p422-rec.big { width: 64px; height: 64px; }
.p422-rec.is-rec { box-shadow: inset 0 0 0 2px var(--color-danger); animation: p422-pulse 1.4s ease-in-out infinite; }
.p422-dot { width: 18px; height: 18px; border-radius: 999px; background: var(--color-danger); }
.p422-square { width: 16px; height: 16px; border-radius: 4px; background: var(--color-danger); }
.p422-square.small { width: 12px; height: 12px; background: currentColor; }
@keyframes p422-pulse { 50% { box-shadow: inset 0 0 0 2px var(--color-danger), 0 0 0 6px color-mix(in srgb, var(--color-danger) 20%, transparent); } }
.p422-wave { display: flex; align-items: center; gap: 2px; height: 24px; }
.p422-wave i { display: block; width: 3px; border-radius: 2px; background: var(--color-text-muted); transition: height .2s; }
.p422-wave.live i { background: var(--color-danger); }
.p422-tile {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border-radius: 20px;
  background: var(--color-surface-muted);
  padding: 10px 6px 10px;
  transition: scale var(--dur-tap) var(--ease-tap), background-color var(--dur-fade);
}
.p422-tile:active { scale: .96; }
.p422-tile img { width: 64px; height: 64px; object-fit: contain; }
.p422-tile.on { background: color-mix(in oklab, var(--color-butter) 35%, var(--color-surface-muted)); }
.p422-pen { display: flex; width: 64px; height: 64px; align-items: center; justify-content: center; font-size: 34px; }
.p422-check {
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
.p422-tile.has .p422-check { display: flex; }
.p422-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-radius: 20px;
  background: var(--color-surface-muted);
  padding: 14px;
  animation: p422-open var(--dur-settle) var(--ease-settle) backwards;
}
@keyframes p422-open { from { opacity: 0; translate: 0 -8px; } }
.p422-them {
  border-radius: 18px 18px 18px 4px;
  background: var(--color-surface-muted);
  padding: 10px 14px;
}
.p422-mine {
  align-self: flex-end;
  border-radius: 18px 18px 4px 18px;
  background: color-mix(in oklab, var(--color-butter) 40%, var(--color-surface));
  animation: p422-open var(--dur-settle) var(--ease-settle) backwards;
}
.p422-icon {
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  color: var(--color-text);
}
.p422-sent img { animation: p422-pop var(--dur-pop) var(--ease-pop) backwards; }
@keyframes p422-pop { from { scale: .5; opacity: 0; } }
</style>
