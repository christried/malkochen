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

// Inside a modal, it's lifted into the top layer (useTopLayerInModal).
const region = useTemplateRef<HTMLElement>('region')
useTopLayerInModal(region)

// Two actions (the Gekocht toast) only fit a 360px phone in one row with
// less space around them, and that leaves some room for wider fonts (the
// "✓" comes from whatever font the system has). Narrower than that, or with
// larger text, the actions go below the text instead of being cut off
// (#170).
const crowded = computed(() => (toast.value?.actions?.length ?? 0) > 1)

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
    class="pointer-events-none fixed inset-x-4 bottom-6 top-auto z-toast m-0 flex h-auto w-auto justify-center overflow-visible border-0 bg-transparent p-0 text-inherit tablet:bottom-8"
  >
    <Transition name="toast">
      <div
        v-if="toast"
        class="relative max-w-md"
      >
        <div
          class="pointer-events-auto relative flex items-center overflow-hidden rounded-pill bg-inverse py-3 text-small text-on-inverse shadow-fab"
          :class="[toast.actions?.length ? 'pr-2' : 'pr-5', crowded ? 'flex-wrap gap-x-1 gap-y-0.5 pl-3.5 tablet:gap-x-4 tablet:pl-5' : 'gap-4 pl-5']"
          data-toast
        >
          <!-- Beside two actions (the Gekocht toast) there's only room for a
               short text, kept on one line. -->
          <p
            class="min-w-0"
            :class="{ 'shrink-0 whitespace-nowrap': crowded }"
          >
            {{ toast.text }}
            <span
              v-if="toast.unseen"
              class="sr-only"
            > {{ toast.unseen }}</span>
          </p>
          <!-- The actions stay together, at the end of the row they're in. -->
          <div
            v-if="toast.actions?.length"
            class="ml-auto flex shrink-0"
            :class="{ 'tablet:gap-4': crowded }"
          >
            <button
              v-for="action in toast.actions"
              :key="action.label"
              type="button"
              class="shrink-0 rounded-pill py-1.5 text-button text-on-inverse underline decoration-2 underline-offset-4 transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
              :class="crowded ? 'px-1.5 tablet:px-3' : 'px-3'"
              @click="act(action)"
            >
              {{ action.label }}
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
