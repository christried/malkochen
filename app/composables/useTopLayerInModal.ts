import type { ShallowRef } from 'vue'

// Inside a modal (the Dish detail, a celebration), an overlay of the page
// (the Toast, the Gekocht pill) is lifted into the top layer as a manual
// popover. When a sheet opens over the Dish detail, the detail steps back
// (scale .96), and a scaled ancestor would otherwise carry the overlay along
// into the side panel. Popovers stack in the order they're shown, so it's
// lifted a tick after mounting, once the modal it's in has opened: then
// it's above that modal, and sheets opened later stay above it. Outside a
// modal it stays an ordinary fixed element, so the offline screen and the
// splash still cover it. Its element needs `popover="manual"`, and its own
// `display`, so it shows while it isn't lifted.
export function useTopLayerInModal(element: Readonly<ShallowRef<HTMLElement | null>>) {
  onMounted(async () => {
    await nextTick()
    // Gone already if the page it was on was left at once.
    const el = element.value
    if (el?.isConnected && el.closest('dialog')) el.showPopover()
  })
}
