import { creatorName } from './creator'
import { metaTags } from './html'
import type { Http } from './http'
import { asString, httpUrl, withoutTracking } from './link'
import { shortenTitle } from './title'
import { nothingFound, type SourceGuess, type Strategy } from './types'

// Pinterest (ADR 0005): public oEmbed for the image and the pinner (the
// Creator). Its title field is unusable (usually the literal "oEmbed"), so the
// Suggested Title comes from the Pin page's og:title, "<Pin title> | <board
// keywords>", up to the first " | ". When the Pin page fails, there is no
// Suggested Title and the user types one. pin.it short links are resolved
// first.
const HOST = /^(?:[\w-]+\.)?pinterest\.(?:com|[a-z]{2}|co\.[a-z]{2}|com\.[a-z]{2})$/
const SHORT_HOST = /^pin\.it$/
const PIN_PATH = /^\/pin\/([\w-]+)/

function pin(url: URL): SourceGuess | null {
  const id = HOST.test(url.hostname) ? url.pathname.match(PIN_PATH)?.[1] : undefined
  return id ? { kind: 'pinterest-pin', canonicalLink: `https://www.pinterest.com/pin/${id}/` } : null
}

// "Pin title | board keywords" and "Name | profile tagline" alike: what comes
// before the first " | ".
function beforeFirstBar(text: string | null | undefined): string | undefined {
  return text?.split(' | ', 1)[0]
}

// oEmbed hands out the 236px-wide thumbnail; i.pinimg.com usually serves the
// same image at 736px under a different size folder.
function largerSize(image: string | null): string | null {
  const larger = image?.replace(/^(https:\/\/i\.pinimg\.com\/)\d+x\//, '$1736x/')
  return larger && larger !== image ? larger : null
}

async function fromOembed(http: Http, found: SourceGuess): Promise<{ creator: string | null, imageUrl: string | null }> {
  const oembed = await http.json(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(found.canonicalLink)}`)
  const image = httpUrl(oembed?.thumbnail_url)
  const larger = largerSize(image)
  return {
    creator: creatorName(beforeFirstBar(asString(oembed?.author_name))),
    imageUrl: larger && await http.exists(larger) ? larger : image,
  }
}

// The Pin page gets half the lookup's time, so a stalled one still leaves the
// image. Only a page that says it is a Pin is believed: anything else
// (a missing Pin, a login wall) would only offer "Pinterest".
async function pinPageTitle(http: Http, found: SourceGuess, timeoutMs: number): Promise<string> {
  const meta = metaTags((await http.page(found.canonicalLink, { timeoutMs: timeoutMs / 2 })).html ?? '')
  if (meta.get('og:type') !== 'pinterestapp:pin') return ''
  return shortenTitle(beforeFirstBar(meta.get('og:title')))
}

export const pinterest: Strategy = {
  match(url) {
    if (SHORT_HOST.test(url.hostname)) return { kind: 'pinterest-pin', canonicalLink: withoutTracking(url) }
    return pin(url)
  },

  async lookup(url, { http, timeoutMs }) {
    const found = pin(SHORT_HOST.test(url.hostname) ? await http.resolve(url.href, hop => pin(hop) !== null) : url)
    if (!found) return nothingFound({ kind: 'pinterest-pin', canonicalLink: withoutTracking(url) })
    const [suggestedTitle, oembed] = await Promise.all([pinPageTitle(http, found, timeoutMs), fromOembed(http, found)])
    return { ...found, suggestedTitle, ...oembed }
  },
}
