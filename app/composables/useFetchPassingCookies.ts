import type { NitroFetchOptions } from 'nitropack'

// A fetch for API calls that set or clear cookies (the remembered invite)
// from a page that may be rendering on the server. There, calls to the API
// run in-process and their Set-Cookie headers would stay on the server; this
// sends the visitor's cookies along and passes the ones set back to the
// browser. In the browser it is plain $fetch. Call it at the top of setup:
// the request it belongs to is only known there.
export function useFetchPassingCookies() {
  const event = useRequestEvent()
  const headers = useRequestHeaders(['cookie'])
  return async <T>(url: string, options?: NitroFetchOptions<string>): Promise<T> => {
    const res = await $fetch.raw<T>(url, { ...options, headers: { ...headers } })
    for (const cookie of res.headers.getSetCookie()) event?.node.res.appendHeader('set-cookie', cookie)
    return res._data as T
  }
}
