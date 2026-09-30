import { metaTags } from './html'
import { httpUrl, withoutTracking } from './link'
import { nothingFound, type SourceGuess, type SourceKind, type Strategy } from './types'

// Instagram: the image comes from the post page's og:image, which Instagram
// serves to servers without a login. The caption never is ("caption":null),
// and Meta's instagram_oembed has returned neither since November 2025, so an
// Instagram link never has a Suggested Title. A login wall gives no image.
const HOST = /^(?:www\.|m\.)?(?:instagram\.com|instagr\.am)$/
// /reel/<code>, /reels/<code>, /p/<code>, /tv/<code>, optionally after a
// /<username>/ prefix.
const POST_PATH = /^\/(?!share\/)(?:[\w.]+\/)?(reels?|p|tv)\/([\w-]+)/
// Share links carry their own code and redirect to the post.
const SHARE_PATH = /^\/share\/(reels?|p)\//

function kindOf(segment: string): SourceKind {
  return segment === 'p' ? 'instagram-post' : 'instagram-reel'
}

// A post link (not a share link), normalised.
function postLink(url: URL): SourceGuess | null {
  const match = url.pathname.match(POST_PATH)
  if (!match || match[1] === undefined || match[2] === undefined) return null
  return {
    kind: kindOf(match[1]),
    canonicalLink: `https://www.instagram.com/${match[1] === 'p' ? 'p' : 'reel'}/${match[2]}/`,
  }
}

// What any Instagram link says about itself before any request.
function guess(url: URL): SourceGuess {
  const share = url.pathname.match(SHARE_PATH)?.[1]
  if (share) return { kind: kindOf(share), canonicalLink: withoutTracking(url) }
  return postLink(url) ?? { kind: 'other', canonicalLink: withoutTracking(url) }
}

export const instagram: Strategy = {
  match(url) {
    if (!HOST.test(url.hostname)) return null
    return guess(url)
  },

  async lookup(url, { http }) {
    const post = SHARE_PATH.test(url.pathname)
      ? postLink(await http.resolve(url.href, hop => postLink(hop) !== null))
      : postLink(url)
    if (!post) return nothingFound(guess(url))

    const page = await http.page(post.canonicalLink)
    const meta = metaTags(page.html ?? '')
    return {
      ...post,
      suggestedTitle: '',
      imageUrl: httpUrl(meta.get('og:image')) ?? httpUrl(meta.get('twitter:image')),
    }
  },
}
