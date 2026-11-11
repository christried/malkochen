import { attributes, TAG_BODY } from './html'

// The schema.org data a page carries in its JSON-LD blocks.

export type Json = unknown
export type JsonObject = Record<string, Json>

export function isObject(node: Json): node is JsonObject {
  return !!node && typeof node === 'object' && !Array.isArray(node)
}

export function isRecipe(node: Json): node is JsonObject {
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

// The nodes of all the page's JSON-LD blocks, in the page's order.
export function jsonLdNodes(html: string): JsonObject[] {
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
  return nodes
}
