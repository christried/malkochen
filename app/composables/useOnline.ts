// Whether the device has a connection, as the browser reports it. Always
// online during server rendering and hydration, so the server's HTML matches;
// the real state is read once mounted.
export function useOnline() {
  const online = ref(true)
  const update = () => {
    online.value = navigator.onLine
  }
  onMounted(() => {
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  })
  return online
}
