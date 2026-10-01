// Whether a media query matches, kept up to date. False on the server and
// until mounted, so server and client render the same first.
export function useMediaQuery(query: string): Readonly<Ref<boolean>> {
  const matches = ref(false)
  let list: MediaQueryList | undefined
  const update = () => (matches.value = list?.matches ?? false)
  onMounted(() => {
    list = matchMedia(query)
    update()
    list.addEventListener('change', update)
  })
  onBeforeUnmount(() => list?.removeEventListener('change', update))
  return readonly(matches)
}
