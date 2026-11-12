import { describe, expect, test } from 'vitest'
import { createDestinationLookup } from '../../server/source-lookup'
import { fakeUpstream, fixture, html, redirect, status, type Route } from './fake-upstream'

// Where a Source says its recipe is (#502): a Pin's destination, the page the
// Pin leads to. Other kinds of Source have none.

function lookupWith(routes: Route[], options: { timeoutMs?: number } = {}) {
  const upstream = fakeUpstream(routes)
  return { destination: createDestinationLookup({ fetch: upstream.fetch, ...options }), upstream }
}

const PIN = 'https://www.pinterest.com/pin/85779567902561995/'

// The recorded Pin page with its two destination tags replaced.
function pinPageWith(destinations: { seeAlso?: string, source?: string }): string {
  const tag = (name: string, content: string | undefined) => content === undefined ? '' : `<meta content="${content}" data-app="true" name="${name}" property="${name}"/>`
  return fixture('pinterest-pin-page-plain-title.html')
    .replace(/<meta [^>]*name="og:see_also"[^>]*>/, tag('og:see_also', destinations.seeAlso))
    .replace(/<meta [^>]*name="pinterestapp:source"[^>]*>/, tag('pinterestapp:source', destinations.source))
}

describe('the destination of a Pin', () => {
  test('is the link the Pin page names, recorded pages: a blog link, a short link, an Instagram link', async () => {
    for (const [pinId, page, link] of [
      ['99360735500167749', 'pinterest-pin-page.html', 'http://www.flickr.com/photos/kentbrew/6851755809/'],
      ['85779567902561995', 'pinterest-pin-page-plain-title.html', 'https://l8r.it/7RDT'],
      ['99360735527172842', 'pinterest-pin-page-untitled.html', 'https://www.instagram.com/reel/DeFbtvYy9Dx/'],
    ] as const) {
      const pin = `https://www.pinterest.com/pin/${pinId}/`
      const { destination, upstream } = lookupWith([[pin, () => html(fixture(page))]])

      expect(await destination(pin), page).toEqual({ outcome: 'found', link })
      expect(upstream.requested).toEqual([pin])
    }
  })

  test('og:see_also is preferred, pinterestapp:source is the fallback', async () => {
    const both = lookupWith([[PIN, () => html(pinPageWith({ seeAlso: 'https://blog.example/a', source: 'https://blog.example/b' }))]])
    const onlySource = lookupWith([[PIN, () => html(pinPageWith({ source: 'https://blog.example/b' }))]])

    expect(await both.destination(PIN)).toEqual({ outcome: 'found', link: 'https://blog.example/a' })
    expect(await onlySource.destination(PIN)).toEqual({ outcome: 'found', link: 'https://blog.example/b' })
  })

  test('a destination that isn\'t an absolute http(s) link, or is on Pinterest, is passed over for the next', async () => {
    const { destination } = lookupWith([[PIN, () => html(pinPageWith({ seeAlso: 'https://www.pinterest.com/pin/1/', source: 'https://blog.example/b' }))]])
    expect(await destination(PIN)).toEqual({ outcome: 'found', link: 'https://blog.example/b' })

    for (const bad of ['/pin/123/', 'javascript:alert(1)', 'ftp://blog.example/x', 'blog.example/rezept', 'https://de.pinterest.com/x/', 'https://pin.it/abc', 'https://pinterest.co.uk/x/']) {
      const none = lookupWith([[PIN, () => html(pinPageWith({ seeAlso: bad, source: bad }))]])

      expect(await none.destination(PIN), bad).toEqual({ outcome: 'none' })
    }
  })

  test('a Pin without a destination has none', async () => {
    const { destination } = lookupWith([[PIN, () => html(pinPageWith({}))]])

    expect(await destination(PIN)).toEqual({ outcome: 'none' })
  })

  test('a page that is no Pin (a Pin that doesn\'t exist) has none', async () => {
    const { destination } = lookupWith([[PIN, () => html(fixture('pinterest-pin-page-missing.html'))]])

    expect(await destination(PIN)).toEqual({ outcome: 'none' })
  })

  test('a pin.it short link is resolved first', async () => {
    const { destination, upstream } = lookupWith([
      ['https://pin.it/abc', () => redirect('https://www.pinterest.com/pin/85779567902561995/sent/?invite_code=x')],
      [PIN, () => html(fixture('pinterest-pin-page-plain-title.html'))],
    ])

    expect(await destination('https://pin.it/abc')).toEqual({ outcome: 'found', link: 'https://l8r.it/7RDT' })
    expect(upstream.requested).toEqual(['https://pin.it/abc', 'https://www.pinterest.com/pin/85779567902561995/'])
  })

  test('a short link that doesn\'t lead to a Pin is unreadable: another try may', async () => {
    const { destination } = lookupWith([['https://pin.it/abc', () => status(500)]])

    expect(await destination('https://pin.it/abc')).toEqual({ outcome: 'unreadable' })
  })

  test('a Pin page that can\'t be read is unreadable', async () => {
    for (const routes of [[[PIN, () => status(500)]], []] as Route[][]) {
      expect(await lookupWith(routes).destination(PIN)).toEqual({ outcome: 'unreadable' })
    }
    const slow = lookupWith([[PIN, () => 'hang']], { timeoutMs: 50 })
    expect(await slow.destination(PIN)).toEqual({ outcome: 'unreadable' })
  })
})

describe('the other kinds of Source', () => {
  test('have no destination, and none is requested', async () => {
    const { destination, upstream } = lookupWith([])

    for (const link of [
      'https://www.tiktok.com/@mara/video/7300000000000000001',
      'https://www.instagram.com/reel/Cfixture0001/',
      'https://www.youtube.com/shorts/fixture00001',
      'https://kochblog.example/rezepte/linsensuppe',
      'kein link',
    ]) {
      expect(await destination(link), link).toEqual({ outcome: 'none' })
    }
    expect(upstream.requested).toEqual([])
  })
})
