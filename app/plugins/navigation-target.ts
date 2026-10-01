// Where the app is going: the error screen's "Nochmal versuchen" reloads
// this page. When a client-side navigation fails, the address bar still
// shows the page it came from, so the current route won't do.
export default defineNuxtPlugin(() => {
  const target = useState<string | null>('navigation-target', () => null)
  useRouter().beforeEach((to) => {
    target.value = to.fullPath
  })
})
