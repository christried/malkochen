// heic-decode ships no types: its declaration has to come along wherever
// this file goes (the server and the tests alike).
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./heic-decode.d.ts" />
import { randomUUID } from 'node:crypto'
import type { Sharp } from 'sharp'
import { PHOTO_MAX_BYTES } from '../../shared/photo'
import type { Storage } from '.'

// "Eigenes Foto": a Member's own photo as a Dish's image. Before it goes into
// the Image Store, it is told apart by its content (never its name or the
// type the browser claims): JPEG, PNG, WebP or HEIC, nothing else. It is then
// turned upright, scaled down to fit PHOTO_MAX_SIDE and stored as a JPEG
// without any of its metadata, above all not where it was taken.

// Large enough for the Dish detail on a wide screen at 2× density.
export const PHOTO_MAX_SIDE = 1600

// Larger images are refused before they are unpacked: a few kilobytes can
// unpack to gigabytes. Phone cameras stay well below.
const MAX_PIXELS = 100_000_000

export type PhotoRefusal = 'not-an-image' | 'too-large'

export type PreparedPhoto
  = | { ok: true, bytes: Uint8Array, contentType: 'image/jpeg' }
    | { ok: false, refusal: PhotoRefusal }

export interface PhotoLimits {
  maxBytes?: number
  maxPixels?: number
}

type PhotoKind = 'jpeg' | 'png' | 'webp' | 'heic'

// The brands a HEIC file names at its start (HEVC-coded HEIF, as phones save).
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])

// What the file's first bytes say it is.
function kindOf(bytes: Uint8Array): PhotoKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg'
  if (ascii(0, 8) === '\x89PNG\r\n\x1A\n') return 'png'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(4, 8) === 'ftyp' && HEIC_BRANDS.has(ascii(8, 12))) return 'heic'
  return null
}

// sharp (native) and libheif (WebAssembly) are loaded on the first photo,
// not with the server: every other request would wait for them on a cold
// start.
const loadSharp = async () => (await import('sharp')).default

// sharp can't decode HEVC, so a HEIC photo is unpacked by libheif first.
async function heicInput(bytes: Uint8Array, maxPixels: number): Promise<Sharp> {
  const [{ default: decodeHeic }, sharp] = await Promise.all([import('heic-decode'), loadSharp()])
  const images = await decodeHeic.all({ buffer: bytes })
  try {
    const [primary] = images
    if (!primary || primary.width * primary.height > maxPixels) throw new Error('no image, or too many pixels')
    const { width, height, data } = await primary.decode()
    return sharp(data, { raw: { width, height, channels: 4 } })
  }
  finally {
    images.dispose()
  }
}

async function input(kind: PhotoKind, bytes: Uint8Array, maxPixels: number): Promise<Sharp> {
  if (kind === 'heic') return heicInput(bytes, maxPixels)
  const sharp = await loadSharp()
  // 'error', not 'warning': phones write JPEGs with harmless quirks.
  const image = sharp(bytes, { failOn: 'error', limitInputPixels: maxPixels })
  // The content must really be what its first bytes say.
  if ((await image.metadata()).format !== kind) throw new Error('not what it starts like')
  return image
}

export async function preparePhoto(bytes: Uint8Array, limits: PhotoLimits = {}): Promise<PreparedPhoto> {
  if (bytes.length > (limits.maxBytes ?? PHOTO_MAX_BYTES)) return { ok: false, refusal: 'too-large' }
  const kind = kindOf(bytes)
  if (!kind) return { ok: false, refusal: 'not-an-image' }
  try {
    const image = await input(kind, bytes, limits.maxPixels ?? MAX_PIXELS)
    const jpeg = await image
      // Upright as taken (EXIF orientation), then the orientation is dropped
      // with all other metadata: sharp keeps none unless asked to.
      .rotate()
      .resize({ width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
    return { ok: true, bytes: jpeg, contentType: 'image/jpeg' }
  }
  catch {
    return { ok: false, refusal: 'not-an-image' }
  }
}

// Given the uploaded bytes, the stored photo's URL, or why it wasn't stored.
export type PhotoStore = (bytes: Uint8Array) => Promise<
  | { ok: true, url: string }
  | { ok: false, refusal: PhotoRefusal | 'not-stored' }
>

export interface PhotoStoreOptions extends PhotoLimits {
  storage: Storage
  // Told why a prepared photo couldn't be stored.
  onFailure?: (reason: string) => void
}

export function createPhotoStore({ storage, onFailure, ...limits }: PhotoStoreOptions): PhotoStore {
  return async (bytes) => {
    const prepared = await preparePhoto(bytes, limits)
    if (!prepared.ok) return prepared
    try {
      return { ok: true, url: await storage.save(`dishes/${randomUUID()}.jpg`, prepared.bytes, prepared.contentType) }
    }
    catch (error) {
      onFailure?.(`storage failed: ${error instanceof Error ? error.message : String(error)}`)
      return { ok: false, refusal: 'not-stored' }
    }
  }
}
