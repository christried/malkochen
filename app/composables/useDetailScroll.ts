// The Dish detail's "Detail parallax + bar" (handoff motion.json): as the
// detail scrolls, its image moves slower than the content, fading and
// growing slightly, and once it has scrolled away a compact bar settles in
// at the top. The parallax is a scroll-driven CSS animation where the
// browser has them (`scrollDriven`); elsewhere a passive scroll listener
// hands the styles how far the image has scrolled away, 0–1, as
// `--parallax` on the image's frame. Reduced motion: no parallax, the bar
// still appears (DishDetailView's styles).
//
// `image` is the image's frame, `bar` the compact bar; the detail scrolls in
// the dialog around them. `barShown` says whether the bar shows: once the
// image has gone under where the bar sits. False on the server and until
// mounted.
export function useDetailScroll(image: Readonly<Ref<HTMLElement | null>>, bar: Readonly<Ref<HTMLElement | null>>) {
  const barShown = ref(false)
  const scrollDriven = ref(false)
  let stop = () => {}
  onMounted(() => {
    const frame = image.value
    const scroller = frame?.closest('dialog')
    if (!frame || !scroller) return
    const observer = new IntersectionObserver(([entry]) => (barShown.value = !(entry?.isIntersecting ?? true)), {
      root: scroller,
      rootMargin: `-${bar.value?.offsetHeight ?? 0}px 0px 0px 0px`,
    })
    observer.observe(frame)
    scrollDriven.value = CSS.supports('animation-timeline', 'view()')
    if (scrollDriven.value) {
      stop = () => observer.disconnect()
      return
    }
    const follow = () => frame.style.setProperty('--parallax', String(Math.min(1, scroller.scrollTop / frame.offsetHeight)))
    follow()
    scroller.addEventListener('scroll', follow, { passive: true })
    stop = () => {
      observer.disconnect()
      scroller.removeEventListener('scroll', follow)
    }
  })
  onBeforeUnmount(() => stop())
  return { barShown: readonly(barShown), scrollDriven: readonly(scrollDriven) }
}
