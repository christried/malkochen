// heic-decode ships no types: its declaration has to come along wherever
// this file goes (the server and the tests alike).
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./heic-decode.d.ts" />
import { randomUUID } from 'node:crypto'
import type { Sharp } from 'sharp'
import { PHOTO_MAX_BYTES } from '../../shared/photo'
import type { Storage } from '.'

// "Eigenes Foto": a Member's own photo as a Dish's image, and the same for a
// Profile Picture (cut square instead). Before it goes into
// the Image Store, it is told apart by its content (never its name or the
// type the browser claims): JPEG, PNG, WebP or HEIC, nothing else. It is then
// turned upright, scaled down to fit PHOTO_MAX_SIDE and stored as a JPEG
// without any of its metadata, above all not where it was taken.
//
// A found image (the Source image Source Lookup found) goes through the same
// preparation before it is stored (index.ts), only taking the formats the
// web serves instead of the ones phones save. It ends up a still JPEG too.

// Large enough for the Dish detail on a wide screen at 2× density.
export const PHOTO_MAX_SIDE = 1600

// A Profile Picture shows round and small (a badge, the settings): a square
// this wide is plenty, even at 3× density.
export const PICTURE_SIDE = 512

// Larger images are refused before they are unpacked: a few kilobytes can
// unpack to gigabytes. 50 MP unpacks to 200 MB. The client sends photos
// over 4 MB shrunk anyway (app/composables/usePhotoUpload.ts).
const MAX_PIXELS = 50_000_000

type PhotoRefusal = 'not-an-image' | 'too-large'

export type PreparedPhoto
  = | { ok: true, bytes: Uint8Array, contentType: 'image/jpeg' }
    | { ok: false, refusal: PhotoRefusal }

export interface PhotoLimits {
  maxBytes?: number
  maxPixels?: number
  // The formats taken, told apart by their first bytes. By default the ones
  // a phone saves a photo in.
  kinds?: readonly PhotoKind[]
}

export interface PhotoShape {
  // Cut to a square around the middle, at most this wide (a Profile
  // Picture), instead of scaled to fit PHOTO_MAX_SIDE whole (a Dish's photo).
  square?: number
}

export type PhotoKind = 'jpeg' | 'png' | 'webp' | 'heic' | 'gif' | 'avif'

// What a phone saves a photo as (a GIF isn't a photo).
const OWN_PHOTO_KINDS: readonly PhotoKind[] = ['jpeg', 'png', 'webp', 'heic']

// What a found image may be: what the web serves images as.
export const FOUND_IMAGE_KINDS: readonly PhotoKind[] = ['jpeg', 'png', 'webp', 'gif', 'avif']

// The name sharp gives each format it reads itself (AVIF is HEIF coded in AV1).
const SHARP_FORMATS: Record<Exclude<PhotoKind, 'heic'>, string> = { jpeg: 'jpeg', png: 'png', webp: 'webp', gif: 'gif', avif: 'heif' }

// The brands a HEIC file names at its start (HEVC-coded HEIF, as phones save).
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'])
// The brands an AVIF file names at its start (a still, or an image sequence).
const AVIF_BRANDS = new Set(['avif', 'avis'])

// What the file's first bytes say it is.
function kindOf(bytes: Uint8Array): PhotoKind | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return 'jpeg'
  if (ascii(0, 8) === '\x89PNG\r\n\x1A\n') return 'png'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (HEIC_BRANDS.has(brand)) return 'heic'
    if (AVIF_BRANDS.has(brand)) return 'avif'
  }
  if (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a') return 'gif'
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
  // 'error', not 'warning': phones write JPEGs with harmless quirks. Only an
  // animation's first frame is read, so what comes out is a still.
  const image = sharp(bytes, { failOn: 'error', limitInputPixels: maxPixels })
  // The content must really be what its first bytes say.
  if ((await image.metadata()).format !== SHARP_FORMATS[kind]) throw new Error('not what it starts like')
  return image
}

// The square's side: never larger than the photo's shorter side, so a small
// photo is cut but not enlarged. (A quarter turn swaps width and height, so
// the shorter side is the same upright or not.)
async function squareSide(image: Sharp, side: number): Promise<number> {
  const { width = 0, height = 0 } = await image.metadata()
  return Math.min(side, width, height)
}

export async function preparePhoto(bytes: Uint8Array, options: PhotoLimits & PhotoShape = {}): Promise<PreparedPhoto> {
  if (bytes.length > (options.maxBytes ?? PHOTO_MAX_BYTES)) return { ok: false, refusal: 'too-large' }
  const kind = kindOf(bytes)
  if (!kind || !(options.kinds ?? OWN_PHOTO_KINDS).includes(kind)) return { ok: false, refusal: 'not-an-image' }
  try {
    const image = await input(kind, bytes, options.maxPixels ?? MAX_PIXELS)
    const side = options.square ? await squareSide(image, options.square) : 0
    // A picture of no size can't be cut square (nor be a picture at all).
    if (options.square && side < 1) throw new Error('no size to cut square')
    const jpeg = await image
      // Upright as taken (EXIF orientation), then the orientation is dropped
      // with all other metadata: sharp keeps none unless asked to.
      .rotate()
      .resize(side
        ? { width: side, height: side, fit: 'cover', position: 'centre' }
        : { width: PHOTO_MAX_SIDE, height: PHOTO_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
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

export interface PhotoStoreOptions extends PhotoLimits, PhotoShape {
  storage: Storage
  // Where in the storage it goes: 'dishes' (the default) or 'pictures'.
  folder?: 'dishes' | 'pictures'
  // Told why a prepared photo couldn't be stored.
  onFailure?: (reason: string) => void
}

export function createPhotoStore({ storage, onFailure, folder = 'dishes', ...options }: PhotoStoreOptions): PhotoStore {
  return async (bytes) => {
    const prepared = await preparePhoto(bytes, options)
    if (!prepared.ok) return prepared
    try {
      return { ok: true, url: await storage.save(`${folder}/${randomUUID()}.jpg`, prepared.bytes, prepared.contentType) }
    }
    catch (error) {
      onFailure?.(`storage failed: ${error instanceof Error ? error.message : String(error)}`)
      return { ok: false, refusal: 'not-stored' }
    }
  }
}
