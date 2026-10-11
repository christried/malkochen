import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { put } from '@vercel/blob'
import { createHttp } from '../source-lookup/http'
import { FOUND_IMAGE_KINDS, preparePhoto } from './photo'

// Image Store: copies a Source image into our own storage when a Dish is
// saved, because third-party image links expire (TikTok's within ~48 h). A
// Dish's image is therefore a stored image or a Placeholder, never a
// third-party link. Downloads go through Source Lookup's Http, so private
// hosts are refused on every redirect hop. Before it is stored, the copy is
// prepared like an Own Photo (photo.ts): told apart by its content, never by
// the type the remote server claims, held to a pixel limit before it is
// unpacked, scaled down and re-encoded as a still JPEG without its metadata.

// Given a third-party image URL, return the URL of our stored copy, or null if
// it could not be copied. Never rejects.
export type ImageStore = (imageUrl: string) => Promise<string | null>

// Where copies are kept: Vercel Blob in deployed environments, the disk in
// local dev and tests.
export interface Storage {
  // Saves the bytes under `name` (e.g. dishes/<uuid>.jpg); returns their public URL.
  save: (name: string, bytes: Uint8Array, contentType: string) => Promise<string>
}

export interface ImageStoreOptions {
  storage: Storage
  // Time budget for the download, across all redirects.
  timeoutMs?: number
  maxBytes?: number
  // Larger images aren't unpacked (photo.ts has the default).
  maxPixels?: number
  fetch?: typeof fetch
  // Told why a copy failed; the copy itself still just answers null.
  onFailure?: (imageUrl: string, reason: string) => void
}

// What a download may claim to be: raster formats only. The claim alone
// counts for nothing, the bytes are checked before they are stored. Media
// type → file extension: copies stored before they were re-encoded kept
// their type in their name, and the disk route still serves those.
export const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function mediaType(contentType: string): string {
  return contentType.split(';')[0]!.trim().toLowerCase()
}

export function createImageStore(options: ImageStoreOptions): ImageStore {
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxBytes = options.maxBytes ?? 10_000_000
  const fail = (imageUrl: string, reason: string) => {
    options.onFailure?.(imageUrl, reason)
    return null
  }

  return async (imageUrl) => {
    const http = createHttp(AbortSignal.timeout(timeoutMs), options.fetch)
    const found = await http.bytes(imageUrl, type => mediaType(type) in IMAGE_TYPES, maxBytes).catch(() => null)
    if (!found) return fail(imageUrl, 'download failed (unreachable, not an image, empty or too large)')
    const prepared = await preparePhoto(found.bytes, { maxBytes, maxPixels: options.maxPixels, kinds: FOUND_IMAGE_KINDS })
    if (!prepared.ok) return fail(imageUrl, `not stored: ${prepared.refusal}`)
    try {
      return await options.storage.save(`dishes/${randomUUID()}.jpg`, prepared.bytes, prepared.contentType)
    }
    catch (error) {
      return fail(imageUrl, `storage failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export function blobStorage(token: string): Storage {
  return {
    async save(name, bytes, contentType) {
      const blob = await put(name, Buffer.from(bytes), { access: 'public', contentType, token })
      return blob.url
    },
  }
}

// Files under `dir`, served by server/routes/images/[...name].get.ts.
export function diskStorage(dir: string): Storage {
  return {
    async save(name, bytes) {
      const path = join(dir, name)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
      return `/images/${name}`
    },
  }
}
