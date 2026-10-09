import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { Agent, fetch as undiciFetch } from 'undici'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { createSourceLookup } from '../../server/source-lookup'
import { isFetchable } from '../../server/source-lookup/http'
import { createPublicFetch, publicOnlyLookup, type Resolve } from '../../server/source-lookup/public-network'
import { createImageStore } from '../../server/image-store'
import { redirect } from './fake-upstream'

// Source Lookup and the Image Store only ever reach public addresses. The name
// in a link is checked first (a fast refusal), then the address each
// connection actually goes to, so names that resolve to internal addresses and
// DNS rebinding are refused too. Names here resolve through a stub; the one
// "internal" service is a real server on this machine.

describe('the link check', () => {
  test.each([
    'http://localhost./',
    'http://LOCALHOST/',
    'http://app.localhost./',
    'http://127.0.0.1./',
    'http://[::127.0.0.1]/',
    'http://[::7f00:1]/',
    'http://[::]/',
    'http://[::ffff:10.0.0.1]/',
    'http://[64:ff9b::a9fe:a9fe]/',
    'http://[2002:a9fe:a9fe::1]/',
    'http://[fd00::1]/',
    'http://[fe80::1]/',
    'http://[ff02::1]/',
    'http://[2001:db8::1]/',
    'http://0.0.0.0/',
    'http://100.64.0.1/',
    'http://172.16.0.1/',
    'http://172.31.255.255/',
    'http://192.0.0.8/',
    'http://192.0.2.1/',
    'http://198.18.0.1/',
    'http://198.19.255.255/',
    'http://198.51.100.7/',
    'http://203.0.113.9/',
    'http://224.0.0.1/',
    'http://255.255.255.255/',
    // Shorthand IPv4 forms the URL parser turns into 127.0.0.1.
    'http://2130706433/',
    'http://0x7f.1/',
  ])('refuses %s', (link) => {
    expect(isFetchable(link)).toBe(false)
  })

  test.each([
    'https://www.tiktok.com/@scout2015/video/1',
    'https://veggie-kueche.example./rezept',
    'http://8.8.8.8/',
    'http://172.32.0.1/',
    'http://198.20.0.1/',
    'http://[2606:4700:4700::1111]/',
    'http://[2002:808:808::1]/',
  ])('lets %s through', (link) => {
    expect(isFetchable(link)).toBe(true)
  })
})

// Answers what it is told to, one answer per lookup (the last one repeats).
function stubResolver(answers: Record<string, string[][]>): Resolve & { asked: string[] } {
  const asked: string[] = []
  const seen: Record<string, number> = {}
  const resolve = async (hostname: string) => {
    asked.push(hostname)
    const list = answers[hostname]
    if (!list) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' })
    const index = Math.min(seen[hostname] ?? 0, list.length - 1)
    seen[hostname] = index + 1
    return list[index]!.map(address => ({ address, family: address.includes(':') ? 6 : 4 }))
  }
  return Object.assign(resolve, { asked })
}

function lookupOnce(lookup: ReturnType<typeof publicOnlyLookup>, hostname: string, all: boolean) {
  return new Promise<{ error: NodeJS.ErrnoException | null, result: unknown }>((done) => {
    lookup(hostname, { all, family: 0 }, (error: NodeJS.ErrnoException | null, address: unknown, family?: number) => {
      done({ error, result: all ? address : { address, family } })
    })
  })
}

describe('the address check', () => {
  test('a name that resolves to a public address connects to that address', async () => {
    const lookup = publicOnlyLookup(stubResolver({ 'blog.example': [['93.184.215.14']] }))

    expect(await lookupOnce(lookup, 'blog.example', false)).toEqual({ error: null, result: { address: '93.184.215.14', family: 4 } })
    expect(await lookupOnce(lookup, 'blog.example', true)).toEqual({ error: null, result: [{ address: '93.184.215.14', family: 4 }] })
  })

  test.each([
    ['loopback', ['127.0.0.1']],
    ['a private network', ['10.1.2.3']],
    ['link-local', ['169.254.169.254']],
    ['IPv6 loopback', ['::1']],
    ['a NAT64 internal address', ['64:ff9b::a9fe:a9fe']],
    ['one private address among public ones', ['93.184.215.14', '192.168.0.10']],
  ])('a name that resolves to %s is refused', async (_, addresses) => {
    const lookup = publicOnlyLookup(stubResolver({ 'sneaky.example': [addresses] }))

    const { error } = await lookupOnce(lookup, 'sneaky.example', true)

    expect(error?.code).toBe('ENOTPUBLIC')
  })

  test('a name that is public on the first lookup and private on the second (rebinding) is refused', async () => {
    const resolve = stubResolver({ 'rebind.example': [['93.184.215.14'], ['127.0.0.1']] })
    const lookup = publicOnlyLookup(resolve)

    expect((await lookupOnce(lookup, 'rebind.example', false)).error).toBeNull()
    expect((await lookupOnce(lookup, 'rebind.example', false)).error?.code).toBe('ENOTPUBLIC')
    expect(resolve.asked).toEqual(['rebind.example', 'rebind.example'])
  })

  test('a name that does not resolve fails like DNS does', async () => {
    const lookup = publicOnlyLookup(stubResolver({}))

    expect((await lookupOnce(lookup, 'nowhere.example', false)).error?.code).toBe('ENOTFOUND')
  })
})

describe('an internal service behind a public-looking name', () => {
  let server: Server
  let port: number
  const hits: string[] = []

  beforeAll(async () => {
    server = createServer((req, res) => {
      hits.push(req.url ?? '')
      const image = req.url?.endsWith('.jpg')
      res.writeHead(200, { 'content-type': image ? 'image/jpeg' : 'text/html' })
      res.end(image ? Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 1, 2]) : '<title>INTERNAL SECRET PAGE</title>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))

  const resolve = stubResolver({ 'localtest.me': [['127.0.0.1']], 'rebind.example': [['127.0.0.1']] })

  test('without the address check, a lookup would read it', async () => {
    hits.length = 0
    const unguarded = new Agent({
      connect: {
        lookup: (hostname, options, callback) => {
          void resolve(hostname).then(([first]) => {
            if (options.all) callback(null, [first!])
            else callback(null, first!.address, first!.family)
          })
        },
      },
    })
    const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => undiciFetch(String(input), { ...init, dispatcher: unguarded } as never)) as unknown as typeof fetch
    const lookup = createSourceLookup({ fetch: fetchImpl, timeoutMs: 5000 })

    expect(await lookup(`http://localtest.me:${port}/`)).toMatchObject({ suggestedTitle: 'Internal Secret Page' })
    expect(hits).toEqual(['/'])
    await unguarded.close()
  })

  test('a lookup of it reads nothing, and the service is never asked', async () => {
    hits.length = 0
    const lookup = createSourceLookup({ fetch: createPublicFetch(resolve), timeoutMs: 5000 })

    expect(await lookup(`http://localtest.me:${port}/`)).toMatchObject({ suggestedTitle: '', imageUrl: null })
    expect(resolve.asked).toContain('localtest.me')
    expect(hits).toEqual([])
  })

  test('a redirect hop to it is not followed', async () => {
    hits.length = 0
    const guarded = createPublicFetch(resolve)
    // The first hop is a public page (faked); the redirect it sends goes out
    // through the guarded fetch.
    const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => String(input) === 'https://sneaky.example/'
      ? Promise.resolve(redirect(`http://rebind.example:${port}/`))
      : guarded(input, init)) as typeof fetch
    const lookup = createSourceLookup({ fetch: fetchImpl, timeoutMs: 5000 })

    expect(await lookup('https://sneaky.example/')).toMatchObject({ suggestedTitle: '', imageUrl: null })
    expect(resolve.asked).toContain('rebind.example')
    expect(hits).toEqual([])
  })

  test('an image copy from it is refused', async () => {
    hits.length = 0
    const saved: string[] = []
    const copy = createImageStore({
      fetch: createPublicFetch(resolve),
      storage: { save: async (name) => { saved.push(name); return name } },
    })

    expect(await copy(`http://localtest.me:${port}/cover.jpg`)).toBeNull()
    expect(hits).toEqual([])
    expect(saved).toEqual([])
  })

  test('its literal address is refused too, before any connection', async () => {
    hits.length = 0
    const lookup = createSourceLookup({ fetch: createPublicFetch(resolve), timeoutMs: 5000 })

    expect(await lookup(`http://localhost.:${port}/`)).toMatchObject({ suggestedTitle: '' })
    expect(await lookup(`http://[::ffff:127.0.0.1]:${port}/`)).toMatchObject({ suggestedTitle: '' })
    expect(hits).toEqual([])
  })

  test('the fetch itself refuses a literal internal address', async () => {
    hits.length = 0

    await expect(createPublicFetch(resolve)(`http://127.0.0.1:${port}/`)).rejects.toThrow()
    expect(hits).toEqual([])
  })
})
