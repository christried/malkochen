// The only way the strategies (and the Image Store) talk to the outside
// world. Every helper shares one deadline for the whole lookup, follows redirects itself (so each hop can
// be checked), refuses private hosts, and turns every failure into `null`:
// a strategy just sees "nothing there".

const MAX_REDIRECTS = 5
const MAX_PAGE_BYTES = 2_000_000
// Some blogs and CDNs refuse requests that don't look like a browser.
const USER_AGENT = 'Mozilla/5.0 (compatible; malkochen/1.0; +https://github.com/christried/malkochen)'

export interface Http {
  // Parsed JSON of a 2xx response.
  json: (url: string) => Promise<Record<string, unknown> | null>
  // Whether the URL answers 2xx.
  exists: (url: string) => Promise<boolean>
  // Where a short link leads: the first hop `arrived` accepts (that page is
  // never requested; TikTok's and Pinterest's post pages stall for servers), else
  // the last reachable hop.
  resolve: (url: string, arrived: (url: URL) => boolean) => Promise<URL>
  // An HTML page and the URL it was finally served from. `timeoutMs` gives
  // up on it sooner than the lookup's deadline.
  page: (url: string, options?: { timeoutMs?: number }) => Promise<{ url: string, html: string | null }>
  // The body of a 2xx response whose content type `accept` allows, unless it
  // is empty or larger than `maxBytes`.
  bytes: (url: string, accept: (contentType: string) => boolean, maxBytes: number) => Promise<{ bytes: Uint8Array, contentType: string } | null>
}

// Loopback, private, link-local and similar addresses, by name or literal IP.
// Users only ever paste public links; anything else is not our business to
// fetch from inside the server.
function isPrivateHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) return true
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])]
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224
  }
  if (host.includes(':')) {
    return host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host) || host.startsWith('::ffff:')
  }
  return false
}

export function isFetchable(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !isPrivateHost(parsed.hostname)
  }
  catch {
    return false
  }
}

export function createHttp(fetchImpl: typeof fetch, signal: AbortSignal): Http {
  async function request(url: string, init: RequestInit = {}): Promise<Response | null> {
    if (!isFetchable(url)) return null
    try {
      return await fetchImpl(url, {
        ...init,
        redirect: 'manual',
        signal: init.signal ?? signal,
        headers: { 'user-agent': USER_AGENT, 'accept-language': 'de,en;q=0.8', ...init.headers },
      })
    }
    catch {
      return null
    }
  }

  // Follows redirects hop by hop. Returns the final response (body unread)
  // and its URL, or the last URL reached if a hop failed.
  async function follow(
    url: string,
    init: RequestInit = {},
    arrived: (url: URL) => boolean = () => false,
  ): Promise<{ url: string, response: Response | null }> {
    let current = url
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (hop > 0 && arrived(new URL(current))) return { url: current, response: null }
      const response = await request(current, init)
      if (!response) return { url: current, response: null }
      const location = response.headers.get('location')
      if (response.status < 300 || response.status >= 400 || !location) return { url: current, response }
      await response.body?.cancel().catch(() => {})
      try {
        current = new URL(location, current).href
      }
      catch {
        return { url: current, response: null }
      }
    }
    return { url: current, response: null }
  }

  // Reads up to `limit` bytes; `truncated` says whether there was more.
  async function readBody(response: Response, limit: number): Promise<{ bytes: Buffer, truncated: boolean } | null> {
    if (!response.body) return null
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (size <= limit) {
        const { done, value } = await reader.read()
        if (done) return { bytes: Buffer.concat(chunks), truncated: false }
        chunks.push(value)
        size += value.byteLength
      }
      return { bytes: Buffer.concat(chunks).subarray(0, limit), truncated: true }
    }
    catch {
      return null
    }
    finally {
      reader.cancel().catch(() => {})
    }
  }

  async function readText(response: Response): Promise<string | null> {
    const body = await readBody(response, MAX_PAGE_BYTES)
    return body && new TextDecoder().decode(body.bytes)
  }

  return {
    async json(url) {
      const { response } = await follow(url, { headers: { accept: 'application/json' } })
      if (!response?.ok) return null
      const text = await readText(response)
      try {
        const parsed: unknown = JSON.parse(text ?? '')
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
      }
      catch {
        return null
      }
    },

    async exists(url) {
      const { response } = await follow(url, { method: 'HEAD' })
      return response?.ok ?? false
    },

    async resolve(url, arrived) {
      const { url: finalUrl, response } = await follow(url, {}, arrived)
      await response?.body?.cancel().catch(() => {})
      return new URL(finalUrl)
    },

    async page(url, { timeoutMs } = {}) {
      const { url: finalUrl, response } = await follow(url, {
        headers: { accept: 'text/html,application/xhtml+xml' },
        signal: timeoutMs === undefined ? signal : AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]),
      })
      if (!response?.ok || !/html/i.test(response.headers.get('content-type') ?? '')) {
        await response?.body?.cancel().catch(() => {})
        return { url: finalUrl, html: null }
      }
      return { url: finalUrl, html: await readText(response) }
    },

    async bytes(url, accept, maxBytes) {
      const { response } = await follow(url)
      const contentType = response?.headers.get('content-type') ?? ''
      if (!response?.ok || !accept(contentType)) {
        await response?.body?.cancel().catch(() => {})
        return null
      }
      const body = await readBody(response, maxBytes)
      if (!body || body.truncated || body.bytes.byteLength === 0) return null
      return { bytes: new Uint8Array(body.bytes), contentType }
    },
  }
}
