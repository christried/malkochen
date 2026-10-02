// The Dish detail's "Detail parallax + bar" (handoff motion.json): as the
// detail scrolls, its image moves slower than the content, fading and
// growing slightly, and once it has scrolled away a compact bar settles in
// at the top. The parallax is a scroll-driven CSS animation where the
// browser has them (`scrollDriven`); elsewhere the scroll listener hands the
// styles how far the image has scrolled away, 0–1, as `--parallax` on its
// frame. Reduced motion: no parallax, the bar still appears
// (DishDetailView's styles).
//
// `frame` is the image's frame, `bar` the compact bar; the detail scrolls
// in the dialog around them. `barShown` says whether the bar shows: once the
// image has gone under where the bar sits. Measured on each scroll, by
// layout, so the card → detail morph moving the frame doesn't count. False
// on the server and until mounted.
export function useDetailScroll(frame: Readonly<Ref<HTMLElement | null>>, bar: Readonly<Ref<HTMLElement | null>>) {
  const barShown = ref(false)
  const scrollDriven = ref(false)
  let stop = () => {}
  onMounted(() => {
    const image = frame.value
    const scroller = image?.closest('dialog')
    if (!image || !scroller) return
    scrollDriven.value = CSS.supports('animation-timeline', 'view()')
    const parallax = !scrollDriven.value && !prefersReducedMotion()
    const follow = () => {
      // Before the dialog opens, nothing has a height yet.
      const height = image.offsetHeight
      barShown.value = height > 0 && scroller.scrollTop > height - (bar.value?.offsetHeight ?? 0)
      if (parallax) image.style.setProperty('--parallax', String(height ? Math.min(1, scroller.scrollTop / height) : 0))
    }
    follow()
    scroller.addEventListener('scroll', follow, { passive: true })
    stop = () => scroller.removeEventListener('scroll', follow)
  })
  onBeforeUnmount(() => stop())
  return { barShown: readonly(barShown), scrollDriven: readonly(scrollDriven) }
}
