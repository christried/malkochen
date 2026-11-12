import { berlinDay } from '~/strings/intl'

// Today as the app dates everything, a calendar day in Europe/Berlin
// (YYYY-MM-DD). It moves on at midnight while the page is open: checked
// every minute and whenever the page comes back to the screen. The server
// and the browser may differ at the stroke of midnight; the browser's value
// is taken once mounted.
export function useToday(): Readonly<Ref<string>> {
  const today = ref(berlinDay(new Date()))
  let timer: ReturnType<typeof setInterval> | undefined
  const update = () => (today.value = berlinDay(new Date()))
  onMounted(() => {
    update()
    timer = setInterval(update, 60_000)
    document.addEventListener('visibilitychange', update)
  })
  onBeforeUnmount(() => {
    clearInterval(timer)
    document.removeEventListener('visibilitychange', update)
  })
  return readonly(today)
}
