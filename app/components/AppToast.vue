<script setup lang="ts">
// The handoff's Toast: an inverse pill at the bottom of the screen, with
// optional actions (e.g. "Rückgängig") and a progress bar showing how long
// it stays. A new toast replaces the one showing. The Gekocht toast is a
// box of two rows instead, with "Wie war's?" (Toast.howWasIt).
const toast = defineModel<Toast | null>({ required: true })
const t = useStrings()
const bar = useTemplateRef<HTMLElement>('bar')
const paused = useToastPaused()

// The bar's animation is also the timer. A Web Animation, not CSS, so the
// reduced-motion rule (main.css) doesn't shorten the undo window.
let timer: Animation | undefined
watch([toast, bar], ([, el]) => {
  timer?.cancel()
  timer = undefined
  if (!el || !toast.value) return
  const shown = toast.value
  timer = el.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: shown.duration, easing: 'linear', fill: 'forwards' })
  if (paused.value) timer.pause()
  timer.finished.then(() => {
    if (toast.value === shown) toast.value = null
  }, () => {})
}, { flush: 'post' })
// While paused (useToastPaused) the bar stops, and it runs on from there.
watch(paused, (wait) => {
  if (wait) timer?.pause()
  else timer?.play()
})
onBeforeUnmount(() => timer?.cancel())

// Inside a modal, it's lifted into the top layer (useTopLayerInModal).
const region = useTemplateRef<HTMLElement>('region')
useTopLayerInModal(region)

// Whether the toast showing, or the last one while it leaves, is the
// Gekocht toast of two rows: it keeps its place on its way out.
const twoRows = ref(false)
watch(toast, (shown) => {
  if (shown) twoRows.value = !!shown.howWasIt
}, { immediate: true })

function act(action: ToastAction) {
  toast.value = null
  action.run()
}
</script>

<template>
  <!-- Always in the page, so screen readers announce what appears in it.
       The popover's own styles are undone (the margin, size, border,
       padding and colours it brings), and `flex` keeps it showing while it
       isn't lifted into the top layer. -->
  <div
    ref="region"
    popover="manual"
    role="status"
    class="pointer-events-none fixed bottom-6 top-auto z-toast m-0 flex h-auto w-auto justify-center overflow-visible border-0 bg-transparent p-0 text-inherit tablet:bottom-8"
    :class="twoRows ? 'inset-x-3 tablet:inset-x-4' : 'inset-x-4'"
  >
    <Transition name="toast">
      <div
        v-if="toast"
        class="relative max-w-md"
        :class="{ 'w-full': toast.howWasIt }"
      >
        <!-- The Gekocht toast has two rows: its text and "Rückgängig" on
             top, "Wie war's?" and "Kommentieren" below. On a phone it sits
             closer to the screen's edges, so "Kommentieren" fits beside the
             thumbs at 360px with room for wider fonts (Linux sets text
             about 5% wider than Windows); narrower still, it's cut with
             "…" rather than pushing the thumbs out. -->
        <div
          class="pointer-events-auto relative flex overflow-hidden bg-inverse text-small text-on-inverse shadow-fab"
          :class="toast.howWasIt ? 'flex-col gap-2 rounded-dialog px-3.5 pb-3.5 pt-3 tablet:px-4' : ['items-center gap-4 rounded-pill py-3 pl-5', toast.actions?.length ? 'pr-2' : 'pr-5']"
          data-toast
        >
          <div :class="toast.howWasIt ? 'flex min-w-0 items-center justify-between gap-3' : 'contents'">
            <p
              class="min-w-0"
              :class="{ 'font-semibold': toast.howWasIt }"
            >
              {{ toast.text }}
              <span
                v-if="toast.unseen"
                class="sr-only"
              > {{ toast.unseen }}</span>
            </p>
            <div
              v-if="toast.actions?.length"
              class="ml-auto flex flex-wrap justify-end"
              :class="{ '-mr-1': toast.howWasIt }"
            >
              <button
                v-for="action in toast.actions"
                :key="action.label"
                type="button"
                class="shrink-0 rounded-pill py-1.5 text-button text-on-inverse underline decoration-2 underline-offset-4 transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
                :class="toast.howWasIt ? 'px-1.5' : 'px-3'"
                @click="act(action)"
              >
                {{ action.label }}
              </button>
            </div>
          </div>
          <div
            v-if="toast.howWasIt"
            class="flex items-center gap-1.5"
          >
            <template v-if="toast.howWasIt.vote">
              <span class="whitespace-nowrap text-on-inverse/70">{{ t.history.howWasIt }}</span>
              <VoteButtons
                :mine="toast.howWasIt.vote.mine()"
                :size="36"
                inverse
                @vote="toast.howWasIt.vote.set"
              />
            </template>
            <button
              type="button"
              class="ml-auto flex h-10 min-w-0 shrink items-center gap-1 rounded-pill bg-on-inverse/12 px-2.5 text-button tablet:px-3 transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              @click="act(toast.howWasIt.comment)"
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                class="shrink-0"
              ><path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" /></svg>
              <span class="truncate">{{ toast.howWasIt.comment.label }}</span>
            </button>
          </div>
          <span
            ref="bar"
            aria-hidden="true"
            class="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-on-inverse/40"
            :class="{ invisible: !toast.actions?.length }"
          />
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* In: up from below, 380ms with a little overshoot (sheet). Out: down,
   300ms. */
.toast-enter-active {
  transition: translate 380ms var(--ease-sheet), opacity var(--dur-fade) var(--ease-fade);
}
.toast-leave-active {
  transition: translate 300ms var(--ease-swoosh), opacity 300ms var(--ease-fade);
}
.toast-enter-from,
.toast-leave-to {
  translate: 0 150px;
  opacity: 0;
}
/* Reduced motion: it only fades. */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-from,
  .toast-leave-to {
    translate: none;
  }
  .toast-leave-active {
    transition: opacity var(--dur-fade) var(--ease-fade);
  }
}
</style>
