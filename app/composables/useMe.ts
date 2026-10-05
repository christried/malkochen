// The signed-in user (/api/me): name, email, the picture shown for them (own
// Profile Picture, else Google photo) and their own Profile Picture. One
// shared fetch for the Board header, the Board switcher and your settings.
export function useMe() {
  return useFetch('/api/me', { key: 'me' })
}
