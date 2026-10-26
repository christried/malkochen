import { videoEmbed } from '../../shared/video-embed'
import type { DishSource } from './dishes'

// Whether a Source's video plays in malkochen's player (#394), the one rule
// for a Dish added or edited (server/utils/source-ticket.ts) and for the
// backfill of older Dishes (server/utils/source-facts-fill.ts, #395). Kept
// apart from the Source Ticket module, which needs the image store and so
// the whole server (the backfill's tests import it in-process).
//
// `lookedUp` is what Source Lookup said, if it said anything. TikTok and
// YouTube Shorts: from the link alone. Instagram: what Source Lookup said,
// null when it said nothing. Any other Source: false. No Source: null.
export function playableFor(source: DishSource | null, lookedUp: boolean | null | undefined): boolean | null {
  if (!source) return null
  switch (source.kind) {
    case 'tiktok':
    case 'youtube-short':
      return videoEmbed(source) !== null
    case 'instagram-reel':
    case 'instagram-post':
      return lookedUp ?? null
    default:
      return false
  }
}
