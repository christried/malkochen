import { readFileSync } from 'node:fs'

// Seam 2 (Source Lookup) never touches the network: every upstream the module
// calls (oEmbed endpoints, CDNs, blog pages, short-link redirectors) is
// answered here from recorded fixtures. An unrouted request fails like a
// network error would.

type Reply = Response | 'hang'

// A route matches when the requested URL starts with `url` (so query strings
// can be left out unless they matter).
export type Route = [url: string, reply: () => Reply]

export interface FakeUpstream {
  fetch: typeof fetch
  requested: string[]
}

export function fakeUpstream(routes: Route[]): FakeUpstream {
  const requested: string[] = []
  const fakeFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)
    requested.push(url)
    // Like fetch, a request whose signal already aborted fails at once.
    if (init?.signal?.aborted) throw init.signal.reason
    const route = routes.find(([prefix]) => url.startsWith(prefix))
    if (!route) throw new TypeError(`fetch failed (no fixture for ${url})`)
    const reply = route[1]()
    if (reply !== 'hang') return reply
    // Never answers; only the caller's abort signal ends it.
    return new Promise<Response>((_, reject) => {
      const signal = init?.signal
      if (signal?.aborted) return reject(signal.reason)
      signal?.addEventListener('abort', () => reject(signal.reason))
    })
  }) as typeof fetch
  return { fetch: fakeFetch, requested }
}

export function fixture(name: string): string {
  return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')
}

export function json(body: unknown, status = 200): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

export function redirect(location: string, status = 302): Response {
  return new Response(null, { status, headers: { location } })
}

export function status(code: number): Response {
  return new Response(null, { status: code })
}
