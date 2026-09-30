import { httpUrl, text } from './link'
import { shortenTitle } from './title'
import type { Strategy } from './types'

// YouTube Shorts: public oEmbed. Its thumbnail is the 4:3 letterboxed one;
// the vertical original-aspect frame (oar2) fits a Short better, so it wins
// whenever it exists.
const HOST = /^(?:www\.|m\.)?youtube\.com$/
const SHORT_PATH = /^\/shorts\/([\w-]{6,})/

function shortId(url: URL): string | undefined {
  return HOST.test(url.hostname) ? url.pathname.match(SHORT_PATH)?.[1] : undefined
}

export const youtube: Strategy = {
  match(url) {
    const id = shortId(url)
    return id ? { kind: 'youtube-short', canonicalLink: `https://www.youtube.com/shorts/${id}` } : null
  },

  async lookup(url, { http }) {
    const id = shortId(url) ?? ''
    const canonicalLink = `https://www.youtube.com/shorts/${id}`
    const vertical = `https://i.ytimg.com/vi/${id}/oar2.jpg`
    const [oembed, hasVertical] = await Promise.all([
      http.json(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalLink)}`),
      http.exists(vertical),
    ])
    return {
      kind: 'youtube-short',
      canonicalLink,
      suggestedTitle: shortenTitle(text(oembed?.title)),
      imageUrl: hasVertical ? vertical : httpUrl(oembed?.thumbnail_url),
    }
  },
}
