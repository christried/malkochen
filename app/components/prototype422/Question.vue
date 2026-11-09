<script setup lang="ts">
// PROTOTYPE #422: throwaway, never merge. The Snackbert Question: his head
// comes in once a Cooking can no longer be undone, with a speech bubble
// asking whether you dare tell him, "Ja" and "Nein". Where (?frage=A edge,
// B from the bottom, C at the toast's place), how (?wie=slide|peek|bounce),
// the bubble (?blase=A|B|C) and the wording (?text=1|2|3, ?sprache=).
// "Nein": he says one line with a finger on his lips and leaves. "Ja": he
// leaves and the report sheet opens. It stays until answered (for the
// screenshots too).
const state = useP422()
const picks = useP422Picks()
const asking = computed(() => state.value.asking)

// in: coming in and waiting; gone: after "Nein", his last word; out: leaving.
const phase = ref<'in' | 'gone' | 'out'>('in')
watch(() => asking.value?.key, () => (phase.value = 'in'))

const ask = computed(() => picks.value.copy.ask[picks.value.text])
const face = computed(() => phase.value === 'gone' ? P422_FACE.shush : phase.value === 'out' ? P422_FACE.happy : P422_FACE.think)

let timer: ReturnType<typeof setTimeout> | undefined
function leave(then?: () => void) {
  phase.value = 'out'
  clearTimeout(timer)
  timer = setTimeout(() => {
    state.value.asking = null
    then?.()
  }, 380)
}
function no() {
  phase.value = 'gone'
  clearTimeout(timer)
  timer = setTimeout(() => leave(), 1800)
}
function yes() {
  const at = asking.value
  if (!at) return
  leave()
  setTimeout(() => (state.value.sheet = { dish: at.dish, cookingId: at.cookingId }), 160)
}
onBeforeUnmount(() => clearTimeout(timer))
// ?zeigen=1: he asks as the Board opens (for the screenshots).
const route = useRoute()
onMounted(() => {
  if (route.query.zeigen === '1' && route.path.startsWith('/b/')) setTimeout(() => p422Ask('Cremige Pilzpasta'), 300)
})
</script>

<template>
  <div
    v-if="asking"
    :key="asking.key"
    class="p422-q"
    :data-frage="picks.frage"
    :data-wie="picks.wie"
    :data-blase="picks.blase"
    :data-phase="phase"
    role="dialog"
    aria-label="Snackbert"
    data-p422-question
  >
    <div class="p422-q-head">
      <img
        :src="face"
        alt=""
        width="320"
        height="300"
      >
    </div>
    <div class="p422-q-bubble">
      <p class="p422-q-line">
        {{ phase === 'gone' ? ask.gone : ask.line(asking.dish) }}
      </p>
      <div
        v-if="phase === 'in'"
        class="flex flex-wrap gap-2"
      >
        <button
          type="button"
          class="p422-yes rounded-pill bg-butter px-5 py-2 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95"
          @click="yes"
        >
          {{ ask.yes }}
        </button>
        <button
          type="button"
          class="p422-no rounded-pill px-5 py-2 text-button transition-transform duration-tap ease-tap active:scale-95"
          @click="no"
        >
          {{ ask.no }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ---- Where: the whole thing's place, and the head's way in (--off). ---- */
.p422-q {
  position: fixed;
  z-index: 60;
  display: flex;
  pointer-events: none;
}
.p422-q > * { pointer-events: auto; }

/* A: from the right edge, leaning in, partly behind it. */
.p422-q[data-frage="A"] {
  right: 0;
  bottom: 132px;
  align-items: center;
  flex-direction: row-reverse;
  gap: 2px;
  max-width: calc(100vw - 12px);
  --off-x: 170px;
  --off-y: 0px;
}
.p422-q[data-frage="A"] .p422-q-head {
  width: 116px;
  margin-right: -30px;
  rotate: -14deg;
}

/* B: from the bottom, looking over the screen's edge. */
.p422-q[data-frage="B"] {
  bottom: 0;
  left: 50%;
  translate: -50% 0;
  width: min(340px, calc(100vw - 24px));
  flex-direction: column-reverse;
  align-items: center;
  --off-x: 0px;
  --off-y: 200px;
}
@media (min-width: 768px) {
  .p422-q[data-frage="B"] { left: auto; right: 120px; translate: none; }
}
.p422-q[data-frage="B"] .p422-q-head {
  width: 132px;
  margin-bottom: -46px;
}

/* C: where the Gekocht toast was, his head sitting on its corner. */
.p422-q[data-frage="C"] {
  bottom: 24px;
  left: 50%;
  translate: -50% 0;
  width: min(448px, calc(100vw - 24px));
  --off-x: 0px;
  --off-y: 120px;
}
@media (min-width: 768px) {
  .p422-q[data-frage="C"] { bottom: 32px; }
}
.p422-q[data-frage="C"] .p422-q-head {
  position: absolute;
  z-index: 1;
  left: -6px;
  top: -44px;
  width: 84px;
  rotate: -8deg;
}
.p422-q[data-frage="C"] .p422-q-bubble {
  width: 100%;
  padding-left: 88px;
  min-height: 92px;
}

.p422-q-head img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 10px 14px rgba(0, 0, 0, .25));
}

/* ---- The bubble. ---- */
.p422-q-bubble {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
}
.p422-q-line {
  font-family: var(--font-display);
  font-size: 18px;
  line-height: 1.3;
}
.p422-q[data-frage="C"] .p422-q-line { font-size: 16px; }

/* A: light, a comic point towards him. */
.p422-q[data-blase="A"] .p422-q-bubble {
  background: var(--color-surface);
  color: var(--color-text);
  border-radius: 22px;
  box-shadow: var(--shadow-card), 0 0 0 1px var(--color-line);
}
.p422-q[data-blase="A"] .p422-no { background: var(--color-surface-muted); color: var(--color-text); }
/* B: dark, like the toast. */
.p422-q[data-blase="B"] .p422-q-bubble {
  background: var(--color-inverse);
  color: var(--color-on-inverse);
  border-radius: 22px;
  box-shadow: var(--shadow-fab);
}
.p422-q[data-blase="B"] .p422-no { background: color-mix(in srgb, var(--color-on-inverse) 12%, transparent); color: var(--color-on-inverse); }
/* C: a card with a butter rim, no point. */
.p422-q[data-blase="C"] .p422-q-bubble {
  background: var(--color-surface);
  color: var(--color-text);
  border: 2.5px solid var(--color-butter);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}
.p422-q[data-blase="C"] .p422-no { background: var(--color-surface-muted); color: var(--color-text); }

/* The point (A and B), towards his head. */
.p422-q[data-blase="A"] .p422-q-bubble::after,
.p422-q[data-blase="B"] .p422-q-bubble::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background: inherit;
  clip-path: polygon(0 0, 100% 50%, 0 100%);
}
.p422-q[data-frage="A"] .p422-q-bubble::after { right: -15px; top: calc(50% - 9px); }
.p422-q[data-frage="B"] .p422-q-bubble::after { left: calc(50% - 9px); bottom: -14px; rotate: 90deg; }
.p422-q[data-frage="B"] .p422-q-bubble { margin-bottom: 10px; }
.p422-q[data-frage="C"] .p422-q-bubble::after { display: none; }

/* ---- How: the head's way in, then the bubble. ---- */
.p422-q[data-wie="slide"] .p422-q-head { animation: p422-slide 560ms var(--ease-settle) backwards; }
.p422-q[data-wie="peek"] .p422-q-head { animation: p422-peek 1500ms var(--ease-swoosh) backwards; }
.p422-q[data-wie="bounce"] .p422-q-head { animation: p422-bounce 820ms linear backwards; }
.p422-q-bubble { animation: p422-bubble 420ms var(--ease-pop) backwards; animation-delay: 380ms; }
.p422-q[data-wie="peek"] .p422-q-bubble { animation-delay: 1250ms; }
.p422-q[data-wie="bounce"] .p422-q-bubble { animation-delay: 560ms; }
/* At the toast's place the box comes first, like the toast, then him. */
.p422-q[data-frage="C"] .p422-q-bubble { animation: p422-toast 380ms var(--ease-sheet) backwards; }
.p422-q[data-frage="C"] .p422-q-head { animation-delay: 260ms; }

/* Waiting, he breathes a little. */
.p422-q[data-phase="in"] .p422-q-head img { animation: p422-bob 2600ms var(--ease-idle) 1600ms infinite; }
/* His last word after "Nein": a small shake. */
.p422-q[data-phase="gone"] .p422-q-head img { animation: p422-shake 420ms ease; }

/* Leaving: back the way he came, the bubble first. */
.p422-q[data-phase="out"] .p422-q-head { animation: p422-out 360ms var(--ease-swoosh) forwards; }
.p422-q[data-phase="out"] .p422-q-bubble { animation: p422-bubble-out 200ms var(--ease-fade) forwards; }

@keyframes p422-slide {
  from { translate: var(--off-x) var(--off-y); }
}
@keyframes p422-peek {
  0% { translate: var(--off-x) var(--off-y); }
  30%, 62% { translate: calc(var(--off-x) * .55) calc(var(--off-y) * .55); }
  45% { rotate: 6deg; }
  100% { translate: 0 0; }
}
@keyframes p422-bounce {
  0% { translate: var(--off-x) var(--off-y); scale: .7; animation-timing-function: cubic-bezier(.3, 0, .5, 1); }
  45% { translate: calc(var(--off-x) * -.12) calc(var(--off-y) * -.12); scale: 1.06 .94; animation-timing-function: cubic-bezier(.5, 0, .5, 1); }
  68% { translate: calc(var(--off-x) * .05) calc(var(--off-y) * .05); scale: .96 1.05; }
  84% { translate: calc(var(--off-x) * -.02) calc(var(--off-y) * -.02); scale: 1.02 .99; }
  100% { translate: 0 0; scale: 1; }
}
@keyframes p422-bubble {
  from { opacity: 0; scale: .6; }
}
@keyframes p422-toast {
  from { opacity: 0; translate: 0 150px; }
}
@keyframes p422-bob {
  50% { translate: 0 -4px; rotate: 2deg; }
}
@keyframes p422-shake {
  25% { rotate: -6deg; }
  75% { rotate: 6deg; }
}
@keyframes p422-out {
  to { translate: var(--off-x) var(--off-y); }
}
@keyframes p422-bubble-out {
  to { opacity: 0; scale: .8; }
}
.p422-q[data-frage="A"] .p422-q-bubble { transform-origin: right center; }
.p422-q[data-frage="B"] .p422-q-bubble { transform-origin: center bottom; }

@media (prefers-reduced-motion: reduce) {
  .p422-q .p422-q-head,
  .p422-q .p422-q-bubble { animation: p422-fade var(--dur-fade) var(--ease-fade) backwards !important; }
  .p422-q .p422-q-head img { animation: none !important; }
  @keyframes p422-fade { from { opacity: 0; } }
}
</style>
