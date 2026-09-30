import { httpUrl, withoutTracking } from './link'
import { shortenTitle } from './title'
import type { Strategy } from './types'

// Blogs and every other link: read the page itself. Title and image are each
// taken from the first of schema.org Recipe (JSON-LD), og:, twitter:, and
// (title only) <title>. A page describing a Recipe is a blog; anything else
// is "other".

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', shy: '',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', middot: '·', bull: '•',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è',
}

function decodeEntities(value: string): string {
  return value
    .replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
      if (code[0] !== '#') return ENTITIES[code] ?? entity
      const point = code[1] === 'x' || code[1] === 'X' ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1))
      return point > 0 && point <= 0x10FFFF ? String.fromCodePoint(point) : entity
    })
    .replace(/\u00AD/g, '')
}

// A tag's attributes, lower-cased names, values quoted or not (minified
// WordPress pages drop the quotes).
function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const [, name, double, single, bare] of tag.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    if (name) attrs[name.toLowerCase()] = decodeEntities(double ?? single ?? bare ?? '')
  }
  return attrs
}

// The tag body after its name, quoted values allowed to contain ">".
const TAG_BODY = String.raw`((?:[^>"']|"[^"]*"|'[^']*')*)>`

function metaTags(html: string): Map<string, string> {
  const meta = new Map<string, string>()
  for (const [, body] of html.matchAll(new RegExp(String.raw`<meta\b${TAG_BODY}`, 'gi'))) {
    const attrs = attributes(body ?? '')
    const key = (attrs.property ?? attrs.name)?.toLowerCase()
    // The first occurrence wins, like the crawlers these tags are written for.
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content.trim())
  }
  return meta
}

type Json = unknown

function isRecipe(node: Json): node is Record<string, Json> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return false
  const type = (node as Record<string, Json>)['@type']
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
}

// Recipe nodes can sit at the top level, in an array, or in an @graph.
function findRecipe(node: Json): Record<string, Json> | null {
  if (isRecipe(node)) return node
  const children = Array.isArray(node)
    ? node
    : node && typeof node === 'object' ? (node as Record<string, Json>)['@graph'] : null
  if (!Array.isArray(children)) return null
  for (const child of children) {
    const found = findRecipe(child)
    if (found) return found
  }
  return null
}

function jsonLdRecipe(html: string): Record<string, Json> | null {
  for (const [, body, content] of html.matchAll(new RegExp(String.raw`<script\b${TAG_BODY}([\s\S]*?)</script>`, 'gi'))) {
    if (!/ld\+json/i.test(attributes(body ?? '').type ?? '')) continue
    try {
      const found = findRecipe(JSON.parse(content ?? ''))
      if (found) return found
    }
    catch {
      // Malformed JSON-LD is common; try the next block.
    }
  }
  return null
}

// schema.org image: a URL string, an ImageObject, or an array of either.
function recipeImage(image: Json, base: string): string | null {
  if (Array.isArray(image)) {
    for (const item of image) {
      const found = recipeImage(item, base)
      if (found) return found
    }
    return null
  }
  if (image && typeof image === 'object') {
    const object = image as Record<string, Json>
    return httpUrl(object.url, base) ?? httpUrl(object.contentUrl, base)
  }
  return httpUrl(image, base)
}

// "Weekend Shakshuka | Salt & Pan" → "Weekend Shakshuka" when the page names
// its site.
function withoutSiteName(title: string, siteName: string | undefined): string {
  if (!siteName) return title
  const suffix = new RegExp(String.raw`\s+[|·•–—-]\s+${siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\s*$`, 'i')
  return title.replace(suffix, '')
}

export const webPage: Strategy = {
  match(url) {
    return { kind: 'other', canonicalLink: withoutTracking(url) }
  },

  async lookup(url, { http }) {
    const page = await http.page(url.href)
    const canonicalLink = withoutTracking(new URL(page.url))
    if (!page.html) return { kind: 'other', canonicalLink, suggestedTitle: '', imageUrl: null }

    const recipe = jsonLdRecipe(page.html)
    const meta = metaTags(page.html)
    const siteName = meta.get('og:site_name')
    const pageTitle = page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]

    const title = [
      typeof recipe?.name === 'string' ? decodeEntities(recipe.name) : undefined,
      meta.get('og:title'),
      meta.get('twitter:title'),
      pageTitle === undefined ? undefined : decodeEntities(pageTitle),
    ].map(t => t?.trim()).find(Boolean) ?? ''

    const imageUrl = (recipe ? recipeImage(recipe.image, page.url) : null)
      ?? httpUrl(meta.get('og:image'), page.url)
      ?? httpUrl(meta.get('og:image:url'), page.url)
      ?? httpUrl(meta.get('twitter:image'), page.url)
      ?? httpUrl(meta.get('twitter:image:src'), page.url)

    return {
      kind: recipe ? 'blog' : 'other',
      canonicalLink,
      suggestedTitle: shortenTitle(withoutSiteName(title, siteName)),
      imageUrl,
    }
  },
}
