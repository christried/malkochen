import { gotNoAnswer } from '~/board/write-failed'
import type { Me } from '~~/server/utils/people'

// The fetch that asks for the signed-in user (/api/me): with no answer from
// malkochen, the user the device last knew stands in, so the app knows who
// is using it offline (#461). A refusal (401: the sign-in expired) is not
// "no answer" and stays one.
export function useMeFetch(): typeof $fetch {
  const device = useDevice()
  // On the server the request's own cookies must go along (what useFetch does
  // itself, unless it is given a fetch of its own).
  if (!device) return import.meta.server ? useRequestFetch() : $fetch
  return ((url: string, options: object) => $fetch<Me>(url, options).catch(async (error: unknown) => {
    const known = gotNoAnswer(error) ? await device.keptUser() : null
    if (!known) throw error
    return known
  })) as unknown as typeof $fetch
}

// The signed-in user (/api/me): name, email, the picture shown for them (own
// Profile Picture, else Google photo) and their own Profile Picture. One
// shared fetch for the Board header, the Board switcher and your settings.
export function useMe() {
  return useFetch<Me>('/api/me', { key: 'me', $fetch: useMeFetch() })
}
