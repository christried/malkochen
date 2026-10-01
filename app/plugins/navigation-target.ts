// Remembers where each navigation is going (useNavigationTarget).
export default defineNuxtPlugin(() => {
  const target = useNavigationTarget()
  useRouter().beforeEach((to) => {
    target.value = to.fullPath
  })
})
