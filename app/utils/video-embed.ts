import type { DishSource } from '../../server/utils/dishes'

// Click-to-play video (#221): a Dish from TikTok, a YouTube Short or
// Instagram can play its video in the Dish detail, in the platform's own
// embedded player. Nothing of it loads before "Video abspielen" is tapped:
// this only reads the stored Source link, it fetches nothing.
// The player's origins are the only ones the Content Security Policy's
// frame-src allows (server/plugins/headers.ts).

export type VideoPlatform = 'tiktok' | 'youtube' | 'instagram'

export interface VideoEmbed {
  platform: VideoPlatform
  // The player's address, for an iframe.
  src: string
}

// The stored link is the canonical one Source Lookup made
// (server/source-lookup/), so only that shape is read. The ids are matched
// tightly and the player's address built from them alone.
const TIKTOK_VIDEO = /^https:\/\/www\.tiktok\.com\/@[^/]*\/video\/(\d+)$/
const YOUTUBE_SHORT = /^https:\/\/www\.youtube\.com\/shorts\/([\w-]{6,})$/
const INSTAGRAM_POST = /^https:\/\/www\.instagram\.com\/(reel|p)\/([\w-]+)\/$/

export function videoEmbed(source: DishSource | null): VideoEmbed | null {
  if (!source) return null
  switch (source.kind) {
    case 'tiktok': {
      // Photo posts and short links that were never resolved name no video.
      const id = source.link.match(TIKTOK_VIDEO)?.[1]
      return id ? { platform: 'tiktok', src: `https://www.tiktok.com/player/v1/${id}?autoplay=1&rel=0` } : null
    }
    case 'youtube-short': {
      const id = source.link.match(YOUTUBE_SHORT)?.[1]
      return id ? { platform: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0` } : null
    }
    case 'instagram-reel':
    case 'instagram-post': {
      const match = source.link.match(INSTAGRAM_POST)
      return match ? { platform: 'instagram', src: `https://www.instagram.com/${match[1]}/${match[2]}/embed/` } : null
    }
    default:
      return null
  }
}

// How long Instagram's embed gets to show its post once its page has loaded
// (it says so before its load event, checked 2026-10-15), and in all, in
// case it never loads. Past either, the post counts as not embeddable.
export const INSTAGRAM_GRACE_MS = 3000
export const INSTAGRAM_LIMIT_MS = 15_000

// What a message from Instagram's embed says about the post (checked
// 2026-10-15): it posts "LOADING" first, then "MEASURE" (with the height it
// needs) and "MOUNTED" once the post shows. One it can't embed (private,
// removed, blocked) only ever says "LOADING". Null: nothing about the post.
export function instagramEmbedState(data: unknown): { shown: true, height: number | null } | null {
  if (typeof data !== 'string') return null
  let message: unknown
  try {
    message = JSON.parse(data)
  }
  catch {
    return null
  }
  if (!message || typeof message !== 'object') return null
  const { type, details } = message as { type?: unknown, details?: { height?: unknown } }
  if (type !== 'MEASURE' && type !== 'MOUNTED') return null
  const height = details?.height
  return { shown: true, height: typeof height === 'number' && height > 0 ? height : null }
}
