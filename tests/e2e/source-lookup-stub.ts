import type { Page, Route } from '@playwright/test'
import { deflateSync } from 'node:zlib'

// The browser tests never reach real upstreams: GET /api/source-lookup is
// answered in the browser from these fixtures (Source Lookup itself is covered
// at Seam 2), and the third-party images they point at are served as generated
// PNGs. Hosts under .invalid never resolve, so the server's copy of such an
// image fails and the Dish falls back to its Placeholder, like a failed copy
// would in production.

export interface LookupFixture {
  kind: string
  canonicalLink: string
  suggestedTitle: string
  // Left out: none, like `null`.
  creator?: string | null
  // Left out: none, like `null`.
  caption?: string | null
  imageUrl: string | null
  imageTicket: string | null
  // Left out: a ticket the server only checks for a Caption, which these
  // stubs don't have.
  sourceTicket?: string
}

// A lookup that answers with `fixture`, or fails like a broken server.
// `hold` delays the answer until it resolves, to see the loading state.
export async function stubSourceLookup(page: Page, fixture: LookupFixture | 'fail', hold?: Promise<void>) {
  await page.route('**/api/source-lookup?*', async (route: Route) => {
    await hold
    if (fixture === 'fail') await route.fulfill({ status: 502, body: 'Bad Gateway' })
    else await route.fulfill({ json: { creator: null, caption: null, sourceTicket: 'stub-source-ticket', ...fixture } })
  })
}

// Serves a solid PNG of the given size at `url`, as a third-party CDN would.
export async function stubImage(page: Page, url: string, width: number, height: number) {
  await page.route(url, route => route.fulfill({ contentType: 'image/png', body: png(width, height) }))
}

// A minimal solid-colour PNG (8-bit RGB, one IDAT).
export function png(width: number, height: number, rgb: [number, number, number] = [214, 140, 69]): Buffer {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => rgb).flat())])
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function crc32(bytes: Buffer): number {
  let crc = 0xFFFFFFFF
  for (const byte of bytes) {
    crc ^= byte
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}
