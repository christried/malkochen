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

// Inside a modal (the Dish detail, a celebration), the toast is lifted into
// the top layer as a manual popover. When a sheet opens over the Dish detail,
// the detail steps back (scale .96), and a scaled ancestor would otherwise
// carry the toast along into the side panel. Popovers stack in the order
// they're shown, so it's lifted a tick after mounting, once the modal it's
// in has opened: then it's above that modal, and sheets opened later stay
// above it. Outside a modal it stays an ordinary fixed element, so the
// offline screen and the splash still cover it.
const region = useTemplateRef<HTMLElement>('region')
onMounted(async () => {
  await nextTick()
  // Gone already if the page it was on was left at once.
  const el = region.value
  if (el?.isConnected && el.closest('dialog')) el.showPopover()
})

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
        :class="{ celebrating: toast.celebrate }"
      >
        <!-- Topfbert peeks out from behind the toast, over its left half. -->
        <TopfbertCheer
          v-if="toast.celebrate"
          :cheer="toast.celebrate.cheer"
          class="absolute bottom-[calc(100%-22px)] left-6 w-[84px]"
        />
        <div
          class="pointer-events-auto relative flex items-center gap-4 overflow-hidden rounded-pill bg-inverse py-3 pl-5 text-small text-on-inverse shadow-fab"
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
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* In: up from below, 380ms with a little overshoot (sheet); the Gekocht
   toast a moment after its confetti. Out: down, 300ms. */
.toast-enter-active {
  transition: translate 380ms var(--ease-sheet), opacity var(--dur-fade) var(--ease-fade);
}
.toast-enter-active.celebrating {
  transition-delay: var(--dur-toast-delay);
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
