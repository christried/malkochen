// Reading the bits of HTML Source Lookup cares about, without an HTML parser.

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', shy: '',
  ndash: '–', mdash: '—', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', middot: '·', bull: '•',
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', eacute: 'é', egrave: 'è',
}

export function decodeEntities(value: string): string {
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
export function attributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  for (const [, name, double, single, bare] of tag.matchAll(/([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    if (name) attrs[name.toLowerCase()] = decodeEntities(double ?? single ?? bare ?? '')
  }
  return attrs
}

// The tag body after its name, quoted values allowed to contain ">".
export const TAG_BODY = String.raw`((?:[^>"']|"[^"]*"|'[^']*')*)>`

// A page's og:/twitter:/description meta tags by lower-cased property or name.
export function metaTags(html: string): Map<string, string> {
  const meta = new Map<string, string>()
  for (const [, body] of html.matchAll(new RegExp(String.raw`<meta\b${TAG_BODY}`, 'gi'))) {
    const attrs = attributes(body ?? '')
    const key = (attrs.property ?? attrs.name)?.toLowerCase()
    // The first occurrence wins, like the crawlers these tags are written for.
    if (key && attrs.content && !meta.has(key)) meta.set(key, attrs.content.trim())
  }
  return meta
}
