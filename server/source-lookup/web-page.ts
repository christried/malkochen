import { captionOf } from './caption'
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

// The page's first Recipe, and the nodes of all its JSON-LD blocks by @id,
// since the Recipe's properties may refer to one ({"@id": …}) instead of
// repeating it, also one in another block (a recipe plugin's block naming
// the author an SEO plugin's block describes).
interface JsonLdRecipe {
  recipe: JsonObject
  byId: Map<string, JsonObject>
}

function jsonLdRecipe(html: string): JsonLdRecipe | null {
  const nodes: JsonObject[] = []
  for (const [, body, content] of html.matchAll(new RegExp(String.raw`<script\b${TAG_BODY}([\s\S]*?)</script>`, 'gi'))) {
    if (!/ld\+json/i.test(attributes(body ?? '').type ?? '')) continue
    try {
      nodes.push(...nodesOf(JSON.parse(content ?? '')))
    }
    catch {
      // Malformed JSON-LD is common; the other blocks still count.
    }
  }
  const recipe = nodes.find(isRecipe)
  if (!recipe) return null
  const byId = new Map<string, JsonObject>()
  for (const node of nodes) {
    const id = node['@id']
    if (typeof id === 'string' && !byId.has(id)) byId.set(id, node)
  }
  return { recipe, byId }
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
  const referred = typeof reference === 'string' ? byId.get(reference) : undefined
  return nameOf(author) ?? (referred ? nameOf(referred) : null)
}

function nameOf(node: JsonObject): string | null {
  return typeof node.name === 'string' ? creatorName(decodeEntities(node.name)) : null
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
    // The meta description, whatever kind the page is (best effort).
    const caption = captionOf(meta.get('description'))
    return { kind: suggestedTitle || imageUrl ? 'blog' : 'other', canonicalLink, suggestedTitle, creator, imageUrl, caption }
  },
}
