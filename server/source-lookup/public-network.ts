import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { isIP, isIPv4, isIPv6 } from 'node:net'
import { Agent, buildConnector, fetch as undiciFetch } from 'undici'

// The public internet, and only that: Source Lookup and the Image Store fetch
// links users paste, so nothing they fetch may reach the server's own machine
// or network. The name in a link is checked before each request (`Http`), but
// a name can resolve anywhere, and resolve differently the next time (DNS
// rebinding). So every connection checks the address it actually connects to.

// Given a host name, the addresses it resolves to (like `dns.lookup` with
// `all: true`). `hints` are the getaddrinfo flags `net.connect` asks for
// (e.g. ADDRCONFIG: no IPv6 answers on a machine without IPv6).
export type Resolve = (hostname: string, options?: { hints?: number }) => Promise<LookupAddress[]>

const systemResolve: Resolve = (hostname, { hints } = {}) => new Promise((resolve, reject) => {
  dnsLookup(hostname, { all: true, order: 'verbatim', hints }, (error, addresses) => error ? reject(error) : resolve(addresses))
})

// [network, prefix length] in the IPv4 space that is not publicly routable.
const NON_PUBLIC_V4: [string, number][] = [
  ['0.0.0.0', 8], // "this" network
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // documentation
  ['192.88.99.0', 24], // 6to4 relay anycast
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // documentation
  ['203.0.113.0', 24], // documentation
  ['224.0.0.0', 4], // multicast; 240/4 and broadcast follow below
  ['240.0.0.0', 4],
]

function v4Number(ip: string): number {
  return ip.split('.').reduce((n, part) => n * 256 + Number(part), 0)
}

// The same ranges as [first, last] address numbers.
const NON_PUBLIC_V4_NUMBERS = NON_PUBLIC_V4.map(([network, prefix]) => {
  const first = v4Number(network)
  return [first, first + 2 ** (32 - prefix) - 1] as const
})

function isPublicV4(ip: string): boolean {
  const n = v4Number(ip)
  return !NON_PUBLIC_V4_NUMBERS.some(([first, last]) => n >= first && n <= last)
}

// The 16 bytes of a valid IPv6 address (zone already removed).
function v6Bytes(ip: string): number[] {
  let text = ip
  const tail: number[] = []
  // An embedded IPv4 tail (::ffff:1.2.3.4) is two groups.
  const dotted = text.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/)
  if (dotted) {
    text = `${dotted[1]}0:0`
    tail.push(...dotted[2]!.split('.').map(Number))
  }
  const [head, rest] = text.includes('::') ? text.split('::') as [string, string] : [text, null]
  const groups = (part: string) => part === '' ? [] : part.split(':').map(group => Number.parseInt(group, 16))
  const front = groups(head)
  const back = rest === null ? [] : groups(rest)
  const all = [...front, ...Array.from({ length: 8 - front.length - back.length }, () => 0), ...back]
  const bytes = all.flatMap(group => [group >> 8, group & 0xFF])
  if (tail.length) bytes.splice(12, 4, ...tail)
  return bytes
}

function isPublicV6(ip: string): boolean {
  const bytes = v6Bytes(ip)
  const [b0, b1, b2] = [bytes[0]!, bytes[1]!, bytes[2]!]
  // 2002::/16, 6to4: as public as the IPv4 address it carries.
  if (b0 === 0x20 && b1 === 0x02) return isPublicV4(bytes.slice(2, 6).join('.'))
  // Only global unicast (2000::/3) is public. That leaves out ::, ::1,
  // IPv4-compatible (::/96) and IPv4-mapped (::ffff:0:0/96) forms, NAT64
  // (64:ff9b::/96), unique local (fc00::/7), link-local (fe80::/10) and
  // multicast (ff00::/8).
  if ((b0 & 0xE0) !== 0x20) return false
  // Inside it: IETF protocol assignments incl. Teredo (2001::/23),
  // documentation (2001:db8::/32, 3fff::/20).
  if (b0 === 0x20 && b1 === 0x01 && b2 <= 0x01) return false
  if (b0 === 0x20 && b1 === 0x01 && b2 === 0x0D && bytes[3] === 0xB8) return false
  if (b0 === 0x3F && b1 === 0xFF && b2 < 0x10) return false
  return true
}

// Whether `ip` (an IPv4 or IPv6 address, brackets and zone allowed) is a
// publicly routable address. Anything that isn't an IP address is not.
export function isPublicAddress(ip: string): boolean {
  const address = ip.replace(/^\[|\]$/g, '').replace(/%.*$/, '').toLowerCase()
  if (isIPv4(address)) return isPublicV4(address)
  if (isIPv6(address)) return isPublicV6(address)
  return false
}

function notPublic(message: string): NodeJS.ErrnoException {
  return Object.assign(new Error(`${message}, which is not a public address`), { code: 'ENOTPUBLIC' })
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void

// A `lookup` for `net.connect`: resolves the name, refuses it if any address
// it resolves to is not public, and otherwise hands over exactly the addresses
// it checked, so the connection goes where the check looked.
export function publicOnlyLookup(resolve: Resolve = systemResolve) {
  return (hostname: string, options: { all?: boolean, family?: number | string, hints?: number }, callback: LookupCallback): void => {
    resolve(hostname, { hints: options.hints }).then((addresses) => {
      const refused = addresses.find(({ address }) => !isPublicAddress(address))
      if (refused) return callback(notPublic(`${hostname} resolves to ${refused.address}`), options.all ? [] : '')
      const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : Number(options.family) || 0
      const usable = family ? addresses.filter(address => address.family === family) : addresses
      if (!usable.length) {
        return callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }), options.all ? [] : '')
      }
      if (options.all) return callback(null, usable)
      callback(null, usable[0]!.address, usable[0]!.family)
    }, (error: NodeJS.ErrnoException) => callback(error, options.all ? [] : ''))
  }
}

// A `fetch` that only connects to public addresses. Names are checked by
// `publicOnlyLookup`; a literal IP address skips DNS, so it is checked here.
export function createPublicFetch(resolve: Resolve = systemResolve): typeof fetch {
  const connect = buildConnector({ lookup: publicOnlyLookup(resolve) } as buildConnector.BuildOptions)
  const agent = new Agent({
    connect: (options, callback) => {
      const host = options.hostname.replace(/^\[|\]$/g, '')
      if (isIP(host) && !isPublicAddress(host)) return callback(notPublic(`connecting to ${host}`), null)
      return connect(options, callback)
    },
  })
  // Takes a URL, not a Request: Http never builds one, and what a Request
  // carries (method, headers, signal) would have to be copied over by hand.
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (input instanceof Request) throw new TypeError('publicFetch takes a URL, not a Request')
    return undiciFetch(String(input), { ...init, dispatcher: agent } as never)
  }) as unknown as typeof fetch
}

// What Source Lookup and the Image Store use unless a test hands them a fake.
export const publicFetch = createPublicFetch()
