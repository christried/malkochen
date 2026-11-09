<script setup lang="ts">
// The offline bar (#458): a strip along the bottom of the screen while
// malkochen can't be reached (useConnection), saying why: the device is
// offline, or malkochen doesn't answer. It covers nothing: the app stays
// usable under it, what needs a connection greyed out. It's gone once a
// request gets an answer again. Always in the page, so screen readers
// announce what appears in it, politely. Its height is `--offline-bar` on
// the root (0 while it's away), which what sits at the bottom (the Toast,
// the add button, the selection bar, sheets and the Dish detail) keeps
// clear of. Over a modal (the Dish detail, a sheet) it's lifted into the top
// layer as a manual popover, shown again after each opens so it stays on top.
const t = useStrings()
const { state } = useConnection()
const text = computed(() => state.value === 'offline' ? t.offline.bar : state.value === 'unreachable' ? t.offline.unreachable : '')

const region = useTemplateRef<HTMLElement>('region')
const strip = useTemplateRef<HTMLElement>('strip')

let resized: ResizeObserver | undefined
function setHeight(px: number) {
  document.documentElement.style.setProperty('--offline-bar', `${px}px`)
}
watch(strip, (el) => {
  resized?.disconnect()
  if (!el) return setHeight(0)
  resized = new ResizeObserver(() => setHeight(el.offsetHeight))
  resized.observe(el)
}, { flush: 'post' })
onBeforeUnmount(() => {
  resized?.disconnect()
  setHeight(0)
})

const openModals = useOpenModalCount()
watch([openModals, () => !!text.value], async ([modals, shown]) => {
  await nextTick()
  const el = region.value
  if (!el) return
  if (el.matches(':popover-open')) el.hidePopover()
  if (modals > 0 && shown) el.showPopover()
}, { flush: 'post' })
</script>

<template>
  <!-- The popover's own styles are undone, as AppToast's are. A live region
       without the status role, so the Toast stays the page's one status. -->
  <div
    ref="region"
    popover="manual"
    aria-live="polite"
    data-offline-bar
    class="pointer-events-none fixed inset-x-0 bottom-0 top-auto z-toast m-0 flex h-auto w-auto overflow-visible border-0 bg-transparent p-0 text-inherit"
  >
    <Transition name="offline-bar">
      <p
        v-if="text"
        ref="strip"
        class="pointer-events-auto flex w-full items-center justify-center gap-2 bg-inverse px-4 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 text-center text-small text-on-inverse"
      >
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :class="state === 'offline' ? 'bg-on-inverse opacity-60' : 'bg-carrot'"
          aria-hidden="true"
        />
        {{ text }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.offline-bar-enter-active,
.offline-bar-leave-active {
  transition: translate var(--dur-settle) var(--ease-settle), opacity var(--dur-fade) var(--ease-fade);
}
.offline-bar-enter-from,
.offline-bar-leave-to {
  translate: 0 100%;
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .offline-bar-enter-from,
  .offline-bar-leave-to {
    translate: none;
  }
}
</style>
