import { videoEmbed } from '../../shared/video-embed'
import { captionOf } from './caption'
import { metaTags } from './html'
import type { Http } from './http'
import { asString, httpUrl } from './link'
import { creatorName } from './creator'
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

function shortLink(id: string): string {
  return `https://www.youtube.com/shorts/${id}`
}

// The Short's description, from its page's meta tags (oEmbed has none). Best
// effort: a page that doesn't answer in half the lookup's time, or at all,
// gives none, and the title and image still come.
async function description(http: Http, link: string, timeoutMs: number): Promise<string | null> {
  try {
    const meta = metaTags((await http.page(link, { timeoutMs: timeoutMs / 2 })).html ?? '')
    return captionOf(meta.get('description') ?? meta.get('og:description'))
  }
  catch {
    return null
  }
}

export const youtube: Strategy = {
  match(url) {
    const id = shortId(url)
    return id ? { kind: 'youtube-short', canonicalLink: shortLink(id) } : null
  },

  async lookup(url, { http, timeoutMs }) {
    const id = shortId(url) ?? ''
    const canonicalLink = shortLink(id)
    const vertical = `https://i.ytimg.com/vi/${id}/oar2.jpg`
    const [oembed, hasVertical, caption] = await Promise.all([
      http.json(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalLink)}`),
      http.exists(vertical),
      description(http, canonicalLink, timeoutMs),
    ])
    return {
      kind: 'youtube-short',
      canonicalLink,
      suggestedTitle: shortenTitle(asString(oembed?.title)),
      creator: creatorName(oembed?.author_name),
      imageUrl: hasVertical ? vertical : httpUrl(oembed?.thumbnail_url),
      caption,
      playableVideo: videoEmbed({ kind: 'youtube-short', link: canonicalLink }) !== null,
    }
  },
}
