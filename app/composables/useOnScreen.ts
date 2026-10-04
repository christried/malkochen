// Whether `target` is on screen (any part of it), kept up to date once
// mounted. False on the server and until the first observation, so a clip
// never starts before it is known to be seen.
export function useOnScreen(target: Readonly<Ref<Element | null>>): Readonly<Ref<boolean>> {
  const onScreen = ref(false)
  let observer: IntersectionObserver | undefined
  onMounted(() => {
    observer = new IntersectionObserver(([entry]) => (onScreen.value = entry?.isIntersecting ?? false))
    if (target.value) observer.observe(target.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
  return readonly(onScreen)
}
