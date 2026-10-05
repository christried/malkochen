import { creatorName } from './creator'
import { attributes, decodeEntities, metaTags, TAG_BODY } from './html'
import { httpUrl, withoutTracking } from './link'
import { shortenTitle } from './title'
import { nothingFound, type Strategy } from './types'

// Blogs and every other link: read the page itself. Title and image are each
// taken from the first of schema.org Recipe (JSON-LD), og:, twitter:, and
// (title only) <title>; the Creator from the Recipe's author, else
// og:site_name. A page that yields a title or an image is a blog; one that
// can't be read or says nothing is "other".

type Json = unknown
type JsonObject = Record<string, Json>

function isObject(node: Json): node is JsonObject {
  return !!node && typeof node === 'object' && !Array.isArray(node)
}

function isRecipe(node: Json): node is JsonObject {
  if (!isObject(node)) return false
  const type = node['@type']
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
}

// The nodes of a JSON-LD block: at the top level, in an array, or in an
// @graph.
function* nodesOf(node: Json): Generator<JsonObject> {
  if (isObject(node)) yield node
  const children = Array.isArray(node) ? node : isObject(node) ? node['@graph'] : null
  if (!Array.isArray(children)) return
  for (const child of children) yield* nodesOf(child)
}

// A Recipe, and the nodes of its block by @id, since its properties may
// refer to one ({"@id": …}) instead of repeating it.
interface JsonLdRecipe {
  recipe: JsonObject
  byId: Map<string, JsonObject>
}

function jsonLdRecipe(html: string): JsonLdRecipe | null {
  for (const [, body, content] of html.matchAll(new RegExp(String.raw`<script\b${TAG_BODY}([\s\S]*?)</script>`, 'gi'))) {
    if (!/ld\+json/i.test(attributes(body ?? '').type ?? '')) continue
    let parsed: Json
    try {
      parsed = JSON.parse(content ?? '')
    }
    catch {
      // Malformed JSON-LD is common; try the next block.
      continue
    }
    const nodes = [...nodesOf(parsed)]
    const recipe = nodes.find(isRecipe)
    if (!recipe) continue
    const byId = new Map<string, JsonObject>()
    for (const node of nodes) {
      const id = node['@id']
      if (typeof id === 'string' && !byId.has(id)) byId.set(id, node)
    }
    return { recipe, byId }
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
  if (isObject(image)) return httpUrl(image.url, base) ?? httpUrl(image.contentUrl, base)
  return httpUrl(image, base)
}

// schema.org author: a name, a Person or Organization (or a reference to
// one), or an array of them, of which the first with a name counts.
function authorName(author: Json, byId: Map<string, JsonObject>): string | null {
  if (Array.isArray(author)) {
    for (const item of author) {
      const found = authorName(item, byId)
      if (found) return found
    }
    return null
  }
  if (typeof author === 'string') return creatorName(decodeEntities(author))
  if (!isObject(author)) return null
  const reference = author['@id']
  const node = author.name === undefined && typeof reference === 'string' ? byId.get(reference) : author
  return typeof node?.name === 'string' ? creatorName(decodeEntities(node.name)) : null
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
    if (!page.html) return nothingFound({ kind: 'other', canonicalLink })

    const jsonLd = jsonLdRecipe(page.html)
    const recipe = jsonLd?.recipe
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

    const creator = (jsonLd ? authorName(jsonLd.recipe.author, jsonLd.byId) : null) ?? creatorName(siteName)

    const suggestedTitle = shortenTitle(withoutSiteName(title, siteName))
    return { kind: suggestedTitle || imageUrl ? 'blog' : 'other', canonicalLink, suggestedTitle, creator, imageUrl }
  },
}
