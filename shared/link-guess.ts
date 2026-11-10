import type { SourceKind } from '../server/source-lookup'

// What a link says about itself on the device, without any request: the
// Source kind its address points to and the site it is on. For a Dish added
// offline (#462), which shows these until the server has looked the link up.
// The server decides what is stored (server/source-lookup), so this only has
// to be good enough to show a badge and a site; it never reaches the server.

// The link's site as a card shows it ("kochblog.example"): its host without a
// leading "www." or "m.". Empty if the link isn't one.
export function siteOf(link: string): string {
  try {
    return new URL(link).hostname.replace(/^(www|m)\./, '')
  }
  catch {
    return ''
  }
}

export function guessKind(link: string): SourceKind {
  let url: URL
  try {
    url = new URL(link)
  }
  catch {
    return 'other'
  }
  const site = siteOf(link)
  const path = url.pathname
  if (site === 'tiktok.com' || site.endsWith('.tiktok.com')) return 'tiktok'
  if (site === 'instagram.com' || site.endsWith('.instagram.com')) return /^\/(reels?|tv)\//.test(path) ? 'instagram-reel' : 'instagram-post'
  if (site === 'youtu.be' || ((site === 'youtube.com' || site.endsWith('.youtube.com')) && path.startsWith('/shorts/'))) return 'youtube-short'
  if (site === 'pinterest.com' || site.endsWith('.pinterest.com') || site === 'pin.it') return 'pinterest-pin'
  return 'other'
}
