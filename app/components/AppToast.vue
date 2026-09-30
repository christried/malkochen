<script setup lang="ts">
// The handoff's Toast: an inverse pill at the bottom of the screen, with
// optional actions (e.g. "Rückgängig") and a progress bar showing how long
// it stays. A new toast replaces the one showing.
const toast = defineModel<Toast | null>({ required: true })
const bar = useTemplateRef<HTMLElement>('bar')

// The bar's animation is also the timer. A Web Animation, not CSS, so the
// reduced-motion rule (main.css) doesn't shorten the undo window.
let timer: Animation | undefined
watch([toast, bar], ([, el]) => {
  timer?.cancel()
  timer = undefined
  if (!el || !toast.value) return
  const shown = toast.value
  timer = el.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(0)' }], { duration: shown.duration, easing: 'linear', fill: 'forwards' })
  timer.finished.then(() => {
    if (toast.value === shown) toast.value = null
  }, () => {})
}, { flush: 'post' })
onBeforeUnmount(() => timer?.cancel())

function act(action: ToastAction) {
  toast.value = null
  action.run()
}
</script>

<template>
  <!-- Always in the page, so screen readers announce what appears in it. -->
  <div
    role="status"
    class="pointer-events-none fixed inset-x-4 bottom-6 z-toast flex justify-center tablet:bottom-8"
  >
    <Transition name="toast">
      <div
        v-if="toast"
        class="pointer-events-auto relative flex max-w-md items-center gap-4 overflow-hidden rounded-pill bg-inverse py-3 pl-5 text-small text-on-inverse shadow-fab"
        :class="toast.actions?.length ? 'pr-2' : 'pr-5'"
        data-toast
      >
        <!-- Beside two actions (the Gekocht toast) there's only room for a
             short text, kept on one line. -->
        <p
          class="min-w-0"
          :class="{ 'shrink-0 whitespace-nowrap': (toast.actions?.length ?? 0) > 1 }"
        >
          {{ toast.text }}
        </p>
        <button
          v-for="action in toast.actions"
          :key="action.label"
          type="button"
          class="shrink-0 rounded-pill px-3 py-1.5 text-button text-on-inverse underline decoration-2 underline-offset-4 transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="act(action)"
        >
          {{ action.label }}
        </button>
        <span
          ref="bar"
          aria-hidden="true"
          class="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-on-inverse/40"
          :class="{ invisible: !toast.actions?.length }"
        />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* In: up from below, 380ms with a little overshoot (sheet). Out: down, 300ms. */
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
