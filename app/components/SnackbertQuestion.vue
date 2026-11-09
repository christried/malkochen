<script setup lang="ts">
// The Snackbert Question (#425, decided on #422): his head comes up from
// the screen's bottom edge and stays partly below it, as if looking over the
// edge; centred on a phone, at the bottom right from 768px, clear of the add
// button. Above him the bubble: a surface card with a butter rim, "Ja,
// gern" the butter pill, "Heute nicht" a muted one. He peeks: about
// halfway in, a beat with a small tilt, then all the way; the bubble pops
// in after him, and while he waits he breathes a little. He leaves the way
// he came, the bubble first. After "Heute nicht" he winks one last word,
// then goes. Reduced motion: it only fades. Not a modal: the Board stays
// usable behind it. When he asks is the Board's (useSnackbertQuestion).
const provided = useSnackbertQuestion()
const t = useStrings()
const asking = computed(() => provided?.question.asking.value ?? null)
const lineId = useId()

// Inside the Dish detail, lifted into the top layer, as the Toast is.
const region = useTemplateRef<HTMLElement>('region')
useTopLayerInModal(region)

function yes() {
  const asked = provided?.question.accept()
  if (asked) provided?.report(asked)
}
function no() {
  provided?.question.decline()
}
</script>

<template>
  <div
    ref="region"
    popover="manual"
    class="pointer-events-none fixed inset-0 top-auto z-[8] m-0 flex h-auto w-auto justify-center overflow-visible border-0 bg-transparent p-0 text-inherit tablet:justify-end tablet:pr-[120px]"
    aria-live="polite"
  >
    <Transition name="question">
      <section
        v-if="asking"
        :key="asking.cookingId"
        class="question pointer-events-none flex w-[min(340px,calc(100vw-24px))] flex-col-reverse items-center"
        :class="{ bye: asking.said === 'bye' }"
        :aria-label="t.snackbertQuestion.label"
        :aria-describedby="lineId"
        data-snackbert-question
      >
        <div class="head">
          <img
            :src="asking.said === 'bye' ? '/snackbert/face.webp' : '/snackbert/face_think.webp'"
            alt=""
            width="132"
            height="124"
          >
        </div>
        <div class="bubble pointer-events-auto flex flex-col gap-2.5 rounded-card bg-surface px-4 py-3.5 text-text shadow-card">
          <p
            :id="lineId"
            class="font-display text-body-serif"
          >
            {{ asking.said === 'bye' ? t.snackbertQuestion.bye : t.snackbertQuestion.ask(asking.dish) }}
          </p>
          <div
            v-if="asking.said === 'ask'"
            class="flex flex-wrap gap-2"
          >
            <button
              type="button"
              class="rounded-pill bg-butter px-5 py-2 text-button text-on-accent transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              @click="yes"
            >
              {{ t.snackbertQuestion.yes }}
            </button>
            <button
              type="button"
              class="rounded-pill bg-surface-muted px-5 py-2 text-button text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              @click="no"
            >
              {{ t.snackbertQuestion.no }}
            </button>
          </div>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.question {
  /* How far below the edge he starts, and goes back to. */
  --off: 200px;
}
.head {
  width: 132px;
  margin-bottom: -46px;
}
.head img {
  display: block;
  width: 100%;
  height: auto;
  filter: drop-shadow(0 10px 14px rgba(0, 0, 0, .25));
}
.bubble {
  margin-bottom: 10px;
  border: 2.5px solid var(--color-butter);
  transform-origin: center bottom;
}

/* Coming in: a peek, then all the way (1.5s); the bubble pops in after. */
.question-enter-active .head {
  animation: peek 1500ms var(--ease-swoosh) backwards;
}
.question-enter-active .bubble {
  animation: bubble-in var(--dur-pop) var(--ease-pop) 1250ms backwards;
}
.question-enter-active {
  transition: opacity 1710ms;
}
/* Waiting, he breathes a little. */
.question:not(.question-enter-active, .question-leave-active) .head img {
  animation: bob 2600ms var(--ease-idle) infinite;
}
/* His last word after "Heute nicht": a small shake. */
.question.bye .head img {
  animation: shake 420ms ease;
}
/* Leaving, the way he came, the bubble first. */
.question-leave-active .head {
  animation: out 360ms var(--ease-swoosh) 120ms forwards;
}
.question-leave-active .bubble {
  animation: bubble-out 200ms var(--ease-fade) forwards;
}
.question-leave-active {
  transition: opacity 480ms;
}

@keyframes peek {
  0% { translate: 0 var(--off); }
  30%, 62% { translate: 0 calc(var(--off) * .55); }
  45% { translate: 0 calc(var(--off) * .55); rotate: 6deg; }
  100% { translate: 0 0; }
}
@keyframes bubble-in {
  from { opacity: 0; scale: .6; }
}
@keyframes bob {
  50% { translate: 0 -4px; rotate: 2deg; }
}
@keyframes shake {
  25% { rotate: -6deg; }
  75% { rotate: 6deg; }
}
@keyframes out {
  to { translate: 0 var(--off); }
}
@keyframes bubble-out {
  to { opacity: 0; scale: .8; }
}

@media (prefers-reduced-motion: reduce) {
  .question-enter-active .head,
  .question-enter-active .bubble,
  .question-leave-active .head,
  .question-leave-active .bubble {
    animation: none;
  }
  .question .head img,
  .question.bye .head img {
    animation: none;
  }
  .question-enter-active,
  .question-leave-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
  .question-enter-from,
  .question-leave-to {
    opacity: 0;
  }
}
</style>
