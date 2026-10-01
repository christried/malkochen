// The signed-in user (/api/me): name, email and Google photo. One shared
// fetch for the Board header, the Board switcher and your settings.
export function useMe() {
  return useFetch('/api/me', { key: 'me' })
}
