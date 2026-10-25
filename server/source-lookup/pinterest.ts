import { captionOf } from './caption'
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

// What Pinterest calls a Pin that has no title of its own: "Pin auf <board>"
// in German, "Pin on <board>" in English (the languages Source Lookup asks for).
const UNTITLED = /^Pin (?:auf|on) /

// The Pin's title and description from the Pin page. The Pin page runs
// alongside oEmbed and gets half the lookup's time, so a stalled one holds the
// image back by that much at most. Only a page that says it is a Pin is
// believed: anything else (a missing Pin, a login wall) would only offer
// "Pinterest". The description comes with the board keywords after " | ",
// as the title does, and loses them the same way.
async function pinPage(http: Http, found: SourceGuess, timeoutMs: number): Promise<{ suggestedTitle: string, caption: string | null }> {
  const meta = metaTags((await http.page(found.canonicalLink, { timeoutMs: timeoutMs / 2 })).html ?? '')
  if (meta.get('og:type') !== 'pinterestapp:pin') return { suggestedTitle: '', caption: null }
  const title = beforeFirstBar(meta.get('og:title'))
  return {
    suggestedTitle: title && !UNTITLED.test(title) ? shortenTitle(title) : '',
    caption: captionOf(beforeFirstBar(meta.get('og:description'))),
  }
}

export const pinterest: Strategy = {
  match(url) {
    if (SHORT_HOST.test(url.hostname)) return { kind: 'pinterest-pin', canonicalLink: withoutTracking(url) }
    return pin(url)
  },

  async lookup(url, { http, timeoutMs }) {
    const found = pin(SHORT_HOST.test(url.hostname) ? await http.resolve(url.href, hop => pin(hop) !== null) : url)
    if (!found) return nothingFound({ kind: 'pinterest-pin', canonicalLink: withoutTracking(url) })
    const [page, oembed] = await Promise.all([pinPage(http, found, timeoutMs), fromOembed(http, found)])
    return { ...found, ...page, ...oembed, playableVideo: false }
  },
}
