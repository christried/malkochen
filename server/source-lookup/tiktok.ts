import { asString, httpUrl } from './link'
import { shortenTitle } from './title'
import type { Strategy } from './types'

// TikTok: public oEmbed, no key. Short links (vm./vt.tiktok.com, /t/…) are
// resolved first; they land on /@/video/<id> without a username, which the
// oEmbed author fills in.
const HOST = /^(?:www\.|m\.|vm\.|vt\.)?tiktok\.com$/
const POST_PATH = /^\/@([^/]*)\/(video|photo)\/(\d+)/

// Share parameters are all TikTok puts in the query, so it goes entirely.
function canonical(url: URL, username?: string): string {
  const match = url.pathname.match(POST_PATH)
  if (!match) return `${url.origin}${url.pathname}`
  return `https://www.tiktok.com/@${match[1] || username || ''}/${match[2]}/${match[3]}`
}

function isPost(url: URL): boolean {
  return POST_PATH.test(url.pathname)
}

export const tiktok: Strategy = {
  match(url) {
    if (!HOST.test(url.hostname)) return null
    return { kind: 'tiktok', canonicalLink: canonical(url) }
  },

  async lookup(url, { http }) {
    const post = isPost(url) ? url : await http.resolve(url.href, isPost)
    const oembed = await http.json(`https://www.tiktok.com/oembed?url=${encodeURIComponent(canonical(post))}`)
    return {
      kind: 'tiktok',
      canonicalLink: canonical(post, asString(oembed?.author_unique_id)),
      suggestedTitle: shortenTitle(asString(oembed?.title)),
      imageUrl: httpUrl(oembed?.thumbnail_url),
    }
  },
}
