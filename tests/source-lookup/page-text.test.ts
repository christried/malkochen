import { describe, expect, test } from 'vitest'
import { PAGE_TEXT_CHARACTERS, pageText } from '../../server/source-lookup/page-text'
import { fixture } from './fake-upstream'

// The readable text of a page (#502): what the Recipe Finder's model reads
// when a followed page carries no recipe data.

describe('the readable text of a page', () => {
  test('tags go and block elements, <br> and <li> become line breaks', () => {
    const html = '<body><h1>Linsen</h1><p>Erst <b>kochen</b>,<br>dann essen.</p><ul><li>eins</li><li>zwei</li></ul></body>'

    expect(pageText(html)).toBe('Linsen\n\nErst kochen,\ndann essen.\n\neins\nzwei')
  })

  test('entities are decoded and runs of spaces collapse', () => {
    expect(pageText('<body><p>400&nbsp;g   Tofu &amp; K&uuml;rbis &#8211; fein</p></body>')).toBe('400 g Tofu & Kürbis – fein')
  })

  test('blank lines collapse to one', () => {
    expect(pageText('<body><p>a</p>\n\n\n\n<div></div><div></div><p>b</p></body>')).toBe('a\n\nb')
  })

  test('scripts, styles, comments and the like are dropped with their content', () => {
    const html = '<body><script>var secret = "geheim"</script><style>p { color: red }</style><!-- Kommentar -->'
      + '<noscript>ohne JS</noscript><template><p>Vorlage</p></template><svg><title>Bild</title></svg><p>Sichtbar</p></body>'

    expect(pageText(html)).toBe('Sichtbar')
  })

  test('the head, navigation, header, footer, aside and forms are dropped with their content, nested ones too', () => {
    const html = '<html><head><title>Titel</title></head><body>'
      + '<header>Kopf<nav>Menü<nav>Untermenü</nav>noch Menü</nav></header>'
      + '<p>Inhalt</p><aside>Seitenleiste</aside><form><input value="x"><button>Senden</button></form><footer>Fuß</footer></body></html>'

    expect(pageText(html)).toBe('Inhalt')
  })

  test('the first <article> is the text when there is one, else <main>, else <body>', () => {
    expect(pageText('<body><p>Rand</p><main><p>Haupt</p><article><p>Artikel</p></article></main><article><p>Zweiter</p></article></body>')).toBe('Artikel')
    expect(pageText('<body><p>Rand</p><main><p>Haupt</p></main></body>')).toBe('Haupt')
    expect(pageText('<body class="x"><p>Rand</p></body>')).toBe('Rand')
    expect(pageText('<p>Ohne Rahmen</p>')).toBe('Ohne Rahmen')
  })

  test('an unclosed article still gives the rest of the page', () => {
    expect(pageText('<body><article><p>Offen</p></body>')).toBe('Offen')
  })

  test('a page with nothing to read gives an empty text', () => {
    expect(pageText('<html><head><title>Leer</title></head><body><script>1</script></body></html>')).toBe('')
    expect(pageText('')).toBe('')
  })

  test('the text is cut to PAGE_TEXT_CHARACTERS', () => {
    const text = pageText(`<body><p>${'a'.repeat(PAGE_TEXT_CHARACTERS + 500)}</p></body>`)

    expect(PAGE_TEXT_CHARACTERS).toBe(20_000)
    expect(text).toBe('a'.repeat(PAGE_TEXT_CHARACTERS))
  })

  test('a blog page without recipe data gives its article and nothing around it', () => {
    expect(pageText(fixture('blog-page-text-only.html'))).toBe([
      'Knuspriger Ofentofu',
      '',
      'Dieser Tofu wird auch ohne Frittieren richtig knusprig.',
      'Perfekt zu Reis.',
      '',
      'Zutaten',
      '',
      '400 g Tofu',
      '2 EL Speisestärke',
      '1 EL Sojasauce & etwas Salz',
      '',
      'Zubereitung',
      '',
      'Den Tofu pressen und in Würfel schneiden.',
      'Mit Speisestärke und Sojasauce mischen.',
      'Bei 200 °C 25 Minuten backen.',
    ].join('\n'))
  })
})
