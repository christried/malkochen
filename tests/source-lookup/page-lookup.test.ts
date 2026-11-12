import { describe, expect, test } from 'vitest'
import { createPageLookup } from '../../server/source-lookup'
import { PAGE_TEXT_CHARACTERS } from '../../server/source-lookup/page-text'
import { fakeUpstream, fixture, html, redirect, status, type Route } from './fake-upstream'

// Reading a followed page (#502): its recipe data, else its readable text,
// under Source Lookup's fetching rules, with one request to the page.

function lookupWith(routes: Route[], options: { timeoutMs?: number } = {}) {
  const upstream = fakeUpstream(routes)
  return { page: createPageLookup({ fetch: upstream.fetch, ...options }), upstream }
}

describe('a page read for its recipe', () => {
  test('recipe data wins over the text: the page\'s Ingredients and Steps, with the link it was served from', async () => {
    const link = 'https://veggie-kueche.example/knuspriger-tofu/'
    const { page, upstream } = lookupWith([[link, () => html(fixture('blog-recipe-string.html'))]])

    expect(await page(link)).toEqual({ outcome: 'recipe', link, recipe: { ingredients: ['400 g Tofu', '2 EL Speisestärke'], steps: [] } })
    expect(upstream.requested).toEqual([link])
  })

  test('a page without recipe data gives its readable text', async () => {
    const link = 'https://veggie-kueche.example/ofentofu'
    const { page } = lookupWith([[link, () => html(fixture('blog-page-text-only.html'))]])

    const read = await page(link)

    expect(read).toMatchObject({ outcome: 'text', link })
    if (read.outcome !== 'text') return
    expect(read.text).toMatch(/^Knuspriger Ofentofu\n\nDieser Tofu/)
    expect(read.text).toContain('2 EL Speisestärke')
    expect(read.text).not.toMatch(/dataLayer|tracking-id|Newsletter|Rezepte|<|Mega lecker/)
  })

  test('a page with nothing to read gives an empty text', async () => {
    const link = 'https://leer.example/seite'
    const { page } = lookupWith([[link, () => html('<html><head><title>Leer</title></head><body></body></html>')]])

    expect(await page(link)).toEqual({ outcome: 'text', link, text: '' })
  })

  test('a long text is cut to the limit', async () => {
    const link = 'https://lang.example/seite'
    const { page } = lookupWith([[link, () => html(`<body><p>${'a'.repeat(PAGE_TEXT_CHARACTERS * 2)}</p></body>`)]])

    expect(await page(link)).toEqual({ outcome: 'text', link, text: 'a'.repeat(PAGE_TEXT_CHARACTERS) })
  })

  test('the link is where the page was finally served from, without tracking parameters', async () => {
    const { page } = lookupWith([
      ['https://kurz.example/abc', () => redirect('https://blog.example/rezept/linsen?utm_source=pin&seite=2#zutaten')],
      ['https://blog.example/rezept/linsen', () => html(fixture('blog-recipe-string.html'))],
    ])

    expect(await page('https://kurz.example/abc')).toMatchObject({ outcome: 'recipe', link: 'https://blog.example/rezept/linsen?seite=2' })
  })

  test('any host is read as a web page, a TikTok link included', async () => {
    const link = 'https://www.tiktok.com/@mara/video/1'
    const { page, upstream } = lookupWith([[link, () => html('<body><p>Hallo</p></body>')]])

    expect(await page(link)).toEqual({ outcome: 'text', link, text: 'Hallo' })
    expect(upstream.requested).toEqual([link])
  })

  test('a page that can\'t be read is unreadable: an error status, no HTML, a dropped connection, a bad link', async () => {
    for (const reply of [() => status(503), () => new Response('{}', { headers: { 'content-type': 'application/json' } })]) {
      const { page } = lookupWith([['https://down.example/seite', reply]])

      expect(await page('https://down.example/seite')).toEqual({ outcome: 'unreadable' })
    }
    expect(await lookupWith([]).page('https://unrouted.example/seite')).toEqual({ outcome: 'unreadable' })
    expect(await lookupWith([]).page('kein link')).toEqual({ outcome: 'unreadable' })
  })

  test('a page that doesn\'t answer in time is unreadable', async () => {
    const { page } = lookupWith([['https://langsam.example/seite', () => 'hang']], { timeoutMs: 50 })

    expect(await page('https://langsam.example/seite')).toEqual({ outcome: 'unreadable' })
  })

  test('a private address is unreadable, without a request: neither the link nor a redirect to it', async () => {
    const { page, upstream } = lookupWith([
      ['http://127.0.0.1:8080/', () => html('<body>intern</body>')],
      ['https://harmlos.example/', () => redirect('http://169.254.169.254/latest/meta-data/')],
      ['http://169.254.169.254/', () => html('<body>geheim</body>')],
    ])

    expect(await page('http://127.0.0.1:8080/rezept')).toEqual({ outcome: 'unreadable' })
    expect(await page('http://localhost/rezept')).toEqual({ outcome: 'unreadable' })
    expect(await page('https://harmlos.example/')).toEqual({ outcome: 'unreadable' })
    expect(upstream.requested).toEqual(['https://harmlos.example/'])
  })
})
