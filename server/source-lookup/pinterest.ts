import { httpUrl, withoutTracking } from './link'
import { nothingFound, type SourceGuess, type Strategy } from './types'

// Pinterest: public oEmbed for the image only. Its title field is unusable
// (usually the literal "oEmbed"), so a Pin never has a Suggested Title and the
// user types one. pin.it short links are resolved first.
const HOST = /^(?:[\w-]+\.)?pinterest\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/
const SHORT_HOST = /^pin\.it$/
const PIN_PATH = /^\/pin\/([\w-]+)/

function pin(url: URL): SourceGuess | null {
  const id = HOST.test(url.hostname) ? url.pathname.match(PIN_PATH)?.[1] : undefined
  return id ? { kind: 'pinterest-pin', canonicalLink: `https://www.pinterest.com/pin/${id}/` } : null
}

// oEmbed hands out the 236px-wide thumbnail; i.pinimg.com usually serves the
// same image at 736px under a different size folder.
function largerSize(image: string | null): string | null {
  const larger = image?.replace(/^(https:\/\/i\.pinimg\.com\/)\d+x\//, '$1736x/')
  return larger && larger !== image ? larger : null
}

export const pinterest: Strategy = {
  match(url) {
    if (SHORT_HOST.test(url.hostname)) return { kind: 'pinterest-pin', canonicalLink: withoutTracking(url) }
    return pin(url)
  },

  async lookup(url, { http }) {
    const found = pin(SHORT_HOST.test(url.hostname) ? await http.resolve(url.href, hop => pin(hop) !== null) : url)
    if (!found) return nothingFound({ kind: 'pinterest-pin', canonicalLink: withoutTracking(url) })
    const oembed = await http.json(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(found.canonicalLink)}`)
    const image = httpUrl(oembed?.thumbnail_url)
    const larger = largerSize(image)
    return { ...found, suggestedTitle: '', imageUrl: larger && await http.exists(larger) ? larger : image }
  },
}
