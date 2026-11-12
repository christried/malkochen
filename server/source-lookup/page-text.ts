import { decodeEntities, TAG_BODY } from './html'

// The readable text of a web page, for the Recipe Finder's model to read when
// a followed page carries no recipe data (#502), without an HTML parser.

// How much of a page's text is kept, in characters. A page's text is only a
// recipe and the words around it; this is more than any recipe needs, and
// bounds what one search sends to the model.
export const PAGE_TEXT_CHARACTERS = 20_000

// Dropped with everything in them: code, hidden content, and the parts of a
// page around its content (menus, headers and footers, side bars, forms).
const DROPPED = ['script', 'style', 'noscript', 'template', 'svg', 'head', 'nav', 'header', 'footer', 'aside', 'form']

// Elements that end a line of text, and those that end a paragraph.
const LINE_BREAKS = ['br', 'li', 'tr']
const PARAGRAPH_BREAKS = [
  'p', 'div', 'section', 'article', 'main', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote',
  'pre', 'dl', 'dt', 'dd', 'figure', 'figcaption', 'hr', 'details', 'summary', 'fieldset', 'address',
]
const LINE = '\u0001'
const PARAGRAPH = '\u0002'

// The first `<name>` element: where its opening tag starts, where its content
// starts and ends, and where it ends after its closing tag, counting nested
// elements of the same name. Without a closing tag it holds the rest of the
// page.
function firstElement(html: string, name: string, from = 0): { start: number, inner: number, innerEnd: number, end: number } | null {
  const tags = new RegExp(String.raw`<(/?)${name}\b${TAG_BODY}`, 'gi')
  tags.lastIndex = from
  let opening: RegExpExecArray | null = null
  let depth = 0
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    const closing = tag[1] === '/'
    const selfClosing = tag[2]?.endsWith('/') ?? false
    if (!opening) {
      if (closing) continue
      opening = tag
      if (selfClosing) return { start: tag.index, inner: tags.lastIndex, innerEnd: tags.lastIndex, end: tags.lastIndex }
      depth = 1
      continue
    }
    if (!closing) {
      if (!selfClosing) depth++
      continue
    }
    if (--depth === 0) return { start: opening.index, inner: opening.index + opening[0].length, innerEnd: tag.index, end: tags.lastIndex }
  }
  return opening && { start: opening.index, inner: opening.index + opening[0].length, innerEnd: html.length, end: html.length }
}

function without(html: string, name: string): string {
  let rest = html
  for (let found = firstElement(rest, name); found; found = firstElement(rest, name, found.start)) {
    // An element that never closes would swallow the page: only its tag goes.
    const unclosed = found.innerEnd === found.end
    rest = rest.slice(0, found.start) + (unclosed ? rest.slice(found.inner) : rest.slice(found.end))
  }
  return rest
}

// The page's text: the content of the first `<article>`, else `<main>`, else
// `<body>`, else the whole page, without what is dropped (above) and every
// comment; its lines in the page's order, one blank line between paragraphs,
// entities decoded, cut to PAGE_TEXT_CHARACTERS. Empty when the page has
// nothing to read.
export function pageText(html: string): string {
  let page = html.replace(/<!--[\s\S]*?(?:-->|$)/g, '')
  for (const name of DROPPED) page = without(page, name)

  for (const name of ['article', 'main', 'body']) {
    const element = firstElement(page, name)
    if (element) {
      page = page.slice(element.inner, element.innerEnd)
      break
    }
  }

  const breaks = (names: string[], mark: string) => (text: string) =>
    text.replace(new RegExp(String.raw`</?(?:${names.join('|')})\b${TAG_BODY}`, 'gi'), mark)
  const text = decodeEntities(
    breaks(PARAGRAPH_BREAKS, PARAGRAPH)(breaks(LINE_BREAKS, LINE)(page))
      .replace(/<[^>]*>/g, '')
      // The page's own line breaks and indentation are only markup's layout.
      .replace(/\s+/g, ' '),
  )
  return text
    .replace(/[ \t ]+/g, ' ')
    // Each run of breaks (and the spaces between) is one line break, or one
    // blank line when a paragraph ends in it.
    .replace(/[ \u0001\u0002]*[\u0001\u0002][ \u0001\u0002]*/g, run => run.includes(PARAGRAPH) ? '\n\n' : '\n')
    .trim()
    .slice(0, PAGE_TEXT_CHARACTERS)
    .trimEnd()
}
