import { deflateSync } from 'node:zlib'
import { guessSource } from '.'
import { nothingFound, type PageRecipe, type RecipeLookup, type SourceLookup, type SourceLookupResult } from './types'

// Tests only (SOURCE_LOOKUP_FIXTURES, server/env.ts): the links the test
// servers know the answer of, in place of asking the Source. A Dish added
// offline has its Source looked up by the server once it arrives, where no
// browser test or API test can stand in for the lookup, so the server itself
// answers a link it has a fixture for. Any other link is looked up as ever.

// What the test servers know about one link: its Source Lookup answer, and
// the recipe its page carries (createRecipeLookup).
export interface LookupFixture extends Partial<SourceLookupResult> {
  // The recipe the page carries; left out, the page carries none.
  // 'unreadable': the page can't be read.
  recipe?: PageRecipe | 'unreadable'
  // How long reading the page for its recipe takes, for tests of what
  // happens meanwhile.
  recipeDelayMs?: number
}

export type LookupFixtures = Record<string, LookupFixture>

// The fixture for `link` (as sent or as its canonical form), laid over what
// the link says about itself.
export function withFixtures(lookup: SourceLookup, fixtures: LookupFixtures): SourceLookup {
  return async (link) => {
    const guess = guessSource(link)
    const fixture = fixtures[link] ?? fixtures[guess.canonicalLink]
    if (!fixture) return lookup(link)
    const { recipe: _recipe, recipeDelayMs: _recipeDelayMs, ...found } = fixture
    return { ...nothingFound(guess), ...found }
  }
}

// The recipe of a link the fixtures know (as sent or as its canonical form),
// in place of reading its page. Any other link is read as ever.
export function withRecipeFixtures(lookup: RecipeLookup, fixtures: LookupFixtures): RecipeLookup {
  return async (link) => {
    const fixture = fixtures[link] ?? fixtures[guessSource(link).canonicalLink]
    if (!fixture) return lookup(link)
    if (fixture.recipeDelayMs) await new Promise(resolve => setTimeout(resolve, fixture.recipeDelayMs))
    if (fixture.recipe === 'unreadable') return { outcome: 'unreadable' }
    return fixture.recipe ? { outcome: 'found', recipe: fixture.recipe } : { outcome: 'none' }
  }
}

// The image of a fixture, standing in for the download: a solid PNG, so the
// Image Store copies it as it would a Source image.
export function fixtureImages(fixtures: LookupFixtures, fetchImage: typeof fetch): typeof fetch {
  const urls = new Set(Object.values(fixtures).flatMap(f => f.imageUrl ? [f.imageUrl] : []))
  return async (input, init) => {
    const url = input instanceof URL ? input.href : typeof input === 'string' ? input : input.url
    if (!urls.has(url)) return fetchImage(input, init)
    return new Response(new Uint8Array(solidPng(32, 24)), { headers: { 'content-type': 'image/png' } })
  }
}

function crc32(bytes: Buffer): number {
  let crc = ~0
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xEDB88320 : crc >>> 1
  }
  return ~crc >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function solidPng(width: number, height: number): Buffer {
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [214, 140, 69]).flat())])
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
