import { describe, expect, test } from 'vitest'
import { createSourceLookup } from '../../server/source-lookup'
import { fakeUpstream, fixture, html, json, redirect, status, type Route } from './fake-upstream'

function lookupWith(routes: Route[], options: { instagramAccessToken?: string, timeoutMs?: number } = {}) {
  const upstream = fakeUpstream(routes)
  return { lookup: createSourceLookup({ fetch: upstream.fetch, ...options }), upstream }
}

const TIKTOK_OEMBED = 'https://www.tiktok.com/oembed?'

describe('TikTok', () => {
  test('a video link gives its caption as Suggested Title and its cover as image', async () => {
    const { lookup } = lookupWith([[TIKTOK_OEMBED, () => json(fixture('tiktok-oembed.json'))]])

    const result = await lookup('https://www.tiktok.com/@scout2015/video/6718335390845095173?is_from_webapp=1&sender_device=pc')

    expect(result).toEqual({
      kind: 'tiktok',
      canonicalLink: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
      suggestedTitle: 'Scramble up ur name & I’ll try to guess it',
      imageUrl: expect.stringMatching(/^https:\/\/p16-common-sign\.tiktokcdn-eu\.com\/tos-maliva-p-0068\/2367c7d45cf54a1397abd/),
    })
  })

  test('a short link resolves to the canonical video link', async () => {
    const { lookup } = lookupWith([
      // Recorded: vm.tiktok.com lands on /@/video/<id>, without the username.
      ['https://vm.tiktok.com/ZMhvqjqjq/', () => redirect('https://www.tiktok.com/@/video/6718335390845095173?_r=1&_d=secCgYIASAHKAESPgo8&u_code=e070aa667646gl&share_item_id=6718335390845095173&utm_campaign=client_share&utm_source=short_fallback')],
      [TIKTOK_OEMBED, () => json(fixture('tiktok-oembed.json'))],
      // Recorded: the video page itself never answers a server (bot wall).
      ['https://www.tiktok.com/@/video/', () => 'hang'],
    ])

    const result = await lookup('https://vm.tiktok.com/ZMhvqjqjq/')

    expect(result.kind).toBe('tiktok')
    expect(result.canonicalLink).toBe('https://www.tiktok.com/@scout2015/video/6718335390845095173')
    expect(result.suggestedTitle).toBe('Scramble up ur name & I’ll try to guess it')
  })

  test('a short link whose oEmbed is unreachable still gives a clean video link', async () => {
    const { lookup } = lookupWith([
      ['https://vm.tiktok.com/ZMhvqjqjq/', () => redirect('https://www.tiktok.com/@/video/6718335390845095173?_r=1&_d=secCgYIASAHKAESPgo8&share_item_id=6718335390845095173')],
      [TIKTOK_OEMBED, () => status(503)],
    ])

    expect(await lookup('https://vm.tiktok.com/ZMhvqjqjq/')).toMatchObject({
      kind: 'tiktok',
      canonicalLink: 'https://www.tiktok.com/@/video/6718335390845095173',
    })
  })

  test('an unreachable oEmbed still gives the Source kind and the resolved link', async () => {
    const { lookup } = lookupWith([
      ['https://vm.tiktok.com/ZMhvqjqjq/', () => redirect('https://www.tiktok.com/@scout2015/video/6718335390845095173?_r=1')],
      [TIKTOK_OEMBED, () => status(503)],
    ])

    expect(await lookup('https://vm.tiktok.com/ZMhvqjqjq/')).toEqual({
      kind: 'tiktok',
      canonicalLink: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
      suggestedTitle: '',
      imageUrl: null,
    })
  })
})

const INSTAGRAM_OEMBED = 'https://graph.facebook.com/'

describe('Instagram', () => {
  test('a Reel gives caption and thumbnail when Meta returns them', async () => {
    const { lookup } = lookupWith(
      [[INSTAGRAM_OEMBED, () => json(fixture('instagram-oembed.json'))]],
      { instagramAccessToken: '123|secret' },
    )

    expect(await lookup('https://www.instagram.com/reel/C7xYzAbCdEf/?igsh=MTc4MmM1YmI2Ng==')).toEqual({
      kind: 'instagram-reel',
      canonicalLink: 'https://www.instagram.com/reel/C7xYzAbCdEf/',
      suggestedTitle: 'Creamy Gochujang Pasta',
      imageUrl: expect.stringMatching(/^https:\/\/scontent-fra5-1\.cdninstagram\.com\/v\/t51\.2885-15\/448577823_n\.jpg\?/),
    })
  })

  test('a post whose oEmbed lacks title and thumbnail degrades to no title, no image', async () => {
    const { lookup } = lookupWith(
      [[INSTAGRAM_OEMBED, () => json(fixture('instagram-oembed-no-fields.json'))]],
      { instagramAccessToken: '123|secret' },
    )

    expect(await lookup('https://instagram.com/p/C8aBcDeFgHi')).toEqual({
      kind: 'instagram-post',
      canonicalLink: 'https://www.instagram.com/p/C8aBcDeFgHi/',
      suggestedTitle: '',
      imageUrl: null,
    })
  })

  test('without an access token it asks nobody and degrades to no title, no image', async () => {
    const { lookup, upstream } = lookupWith([[INSTAGRAM_OEMBED, () => json(fixture('instagram-oembed.json'))]])

    expect(await lookup('https://www.instagram.com/veganbowls/reel/C7xYzAbCdEf/')).toEqual({
      kind: 'instagram-reel',
      canonicalLink: 'https://www.instagram.com/reel/C7xYzAbCdEf/',
      suggestedTitle: '',
      imageUrl: null,
    })
    expect(upstream.requested).toEqual([])
  })

  test('a Meta error response degrades to no title, no image', async () => {
    const { lookup } = lookupWith(
      [[INSTAGRAM_OEMBED, () => json({ error: { message: 'Invalid OAuth access token.', code: 190 } }, 400)]],
      { instagramAccessToken: '123|wrong' },
    )

    const result = await lookup('https://www.instagram.com/reels/C7xYzAbCdEf/')

    expect(result).toMatchObject({ kind: 'instagram-reel', suggestedTitle: '', imageUrl: null })
  })
})

const YOUTUBE_OEMBED = 'https://www.youtube.com/oembed?'
const VERTICAL_THUMBNAIL = 'https://i.ytimg.com/vi/tPEE9ZwTmy0/oar2.jpg'

describe('YouTube Shorts', () => {
  test('prefers the vertical original-aspect thumbnail when it exists', async () => {
    const { lookup } = lookupWith([
      [YOUTUBE_OEMBED, () => json(fixture('youtube-oembed.json'))],
      [VERTICAL_THUMBNAIL, () => status(200)],
    ])

    expect(await lookup('https://youtube.com/shorts/tPEE9ZwTmy0?si=Lx3kP0aQ9')).toEqual({
      kind: 'youtube-short',
      canonicalLink: 'https://www.youtube.com/shorts/tPEE9ZwTmy0',
      suggestedTitle: 'Shortest Video on Youtube',
      imageUrl: VERTICAL_THUMBNAIL,
    })
  })

  test('falls back to the standard thumbnail without a vertical one', async () => {
    const { lookup } = lookupWith([
      [YOUTUBE_OEMBED, () => json(fixture('youtube-oembed.json'))],
      [VERTICAL_THUMBNAIL, () => status(404)],
    ])

    const result = await lookup('https://m.youtube.com/shorts/tPEE9ZwTmy0')

    expect(result.canonicalLink).toBe('https://www.youtube.com/shorts/tPEE9ZwTmy0')
    expect(result.imageUrl).toBe('https://i.ytimg.com/vi/tPEE9ZwTmy0/hqdefault.jpg')
  })
})

const PINTEREST_OEMBED = 'https://www.pinterest.com/oembed.json?'

describe('Pinterest', () => {
  test('a Pin gives a larger image and never its unusable "oEmbed" title', async () => {
    const { lookup } = lookupWith([[PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))]])

    expect(await lookup('https://de.pinterest.com/pin/99360735500167749/?mt=login')).toEqual({
      kind: 'pinterest-pin',
      canonicalLink: 'https://www.pinterest.com/pin/99360735500167749/',
      suggestedTitle: '',
      imageUrl: 'https://i.pinimg.com/736x/a7/66/56/a76656e966b1958f568d63c3f1c05aec.jpg',
    })
  })

  test('a pin.it short link resolves to the canonical Pin link', async () => {
    const { lookup } = lookupWith([
      // Recorded: pin.it → api.pinterest.com/url_shortener/… → the Pin.
      ['https://pin.it/1nzvMpNHh', () => redirect('https://api.pinterest.com/url_shortener/1nzvMpNHh/redirect/', 308)],
      ['https://api.pinterest.com/url_shortener/1nzvMpNHh/redirect/', () => redirect('https://www.pinterest.de/pin/99360735500167749/sent/?invite_code=a1b2&sender=123&sfo=1')],
      ['https://www.pinterest.de/pin/', () => 'hang'],
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
    ])

    const result = await lookup('https://pin.it/1nzvMpNHh')

    expect(result.kind).toBe('pinterest-pin')
    expect(result.canonicalLink).toBe('https://www.pinterest.com/pin/99360735500167749/')
    expect(result.imageUrl).toBe('https://i.pinimg.com/736x/a7/66/56/a76656e966b1958f568d63c3f1c05aec.jpg')
  })
})

describe('blogs and other links', () => {
  function page(link: string, name: string) {
    return lookupWith([[link, () => html(fixture(name))]]).lookup(link)
  }

  test('Recipe JSON-LD with an image array (recorded, inside a Yoast @graph)', async () => {
    const { lookup } = lookupWith([['https://www.loveandlemons.com/brownies-recipe/', () => html(fixture('blog-recipe-array.html'))]])

    expect(await lookup('https://www.loveandlemons.com/brownies-recipe/?utm_source=pinterest&utm_medium=social#wprm-recipe-container')).toEqual({
      kind: 'blog',
      canonicalLink: 'https://www.loveandlemons.com/brownies-recipe/',
      suggestedTitle: 'Best Homemade Brownies',
      imageUrl: 'https://cdn.loveandlemons.com/wp-content/uploads/2020/01/brownie-recipe-500x500.jpg',
    })
  })

  test('Recipe JSON-LD with a relative image string and HTML entities in its name', async () => {
    expect(await page('https://veggie-kueche.example/knuspriger-tofu/', 'blog-recipe-string.html')).toEqual({
      kind: 'blog',
      canonicalLink: 'https://veggie-kueche.example/knuspriger-tofu/',
      suggestedTitle: 'Knuspriger Tofu mit Erdnusssoße & Reis',
      imageUrl: 'https://veggie-kueche.example/wp-content/uploads/2025/03/knuspriger-tofu.jpg',
    })
  })

  test('Recipe JSON-LD with an ImageObject, among other top-level items', async () => {
    expect(await page('https://cozy-kitchen.example/dal', 'blog-recipe-object.html')).toMatchObject({
      kind: 'blog',
      suggestedTitle: 'Red Lentil Dal',
      imageUrl: 'https://cozy-kitchen.example/images/dal-1200.jpg',
    })
  })

  test('a page with only og: tags uses them, without the site name', async () => {
    expect(await page('https://salt-and-pan.example/shakshuka', 'blog-og-only.html')).toEqual({
      kind: 'other',
      canonicalLink: 'https://salt-and-pan.example/shakshuka',
      suggestedTitle: 'Weekend Shakshuka',
      imageUrl: 'https://cdn.salt-and-pan.example/shakshuka.jpg',
    })
  })

  test('a page with only twitter: tags uses them', async () => {
    expect(await page('https://pics.example/miso', 'blog-twitter-only.html')).toMatchObject({
      suggestedTitle: 'Miso Aubergine',
      imageUrl: 'https://pics.example/miso.jpg',
    })
  })

  test('a page with nothing but a <title> gives that title and no image', async () => {
    expect(await page('https://recipes.example/crumble', 'blog-title-only.html')).toMatchObject({
      suggestedTitle: 'Grandma\'s Apple Crumble',
      imageUrl: null,
    })
  })

  test('a broken page gives no title and no image', async () => {
    expect(await page('https://broken.example/recipe', 'broken-page.html')).toEqual({
      kind: 'other',
      canonicalLink: 'https://broken.example/recipe',
      suggestedTitle: '',
      imageUrl: null,
    })
  })

  test('a redirected link is canonicalised to where it ends up', async () => {
    const { lookup } = lookupWith([
      ['http://veggie-kueche.example/?p=812', () => redirect('https://veggie-kueche.example/knuspriger-tofu/?utm_campaign=feed', 301)],
      ['https://veggie-kueche.example/knuspriger-tofu/', () => html(fixture('blog-recipe-string.html'))],
    ])

    const result = await lookup('http://veggie-kueche.example/?p=812')

    expect(result.canonicalLink).toBe('https://veggie-kueche.example/knuspriger-tofu/')
    expect(result.suggestedTitle).toBe('Knuspriger Tofu mit Erdnusssoße & Reis')
  })
})

describe('never fails', () => {
  const nothing = { suggestedTitle: '', imageUrl: null }

  test('an upstream that errors gives an empty result', async () => {
    const { lookup } = lookupWith([['https://down.example/', () => status(500)]])

    expect(await lookup('https://down.example/recipe')).toEqual({ kind: 'other', canonicalLink: 'https://down.example/recipe', ...nothing })
  })

  test('an unreachable host gives an empty result', async () => {
    const { lookup } = lookupWith([])

    expect(await lookup('https://www.tiktok.com/@scout2015/video/6718335390845095173')).toEqual({
      kind: 'tiktok',
      canonicalLink: 'https://www.tiktok.com/@scout2015/video/6718335390845095173',
      ...nothing,
    })
  })

  test('an upstream that never answers gives an empty result within the time budget', async () => {
    const { lookup } = lookupWith([
      [YOUTUBE_OEMBED, () => 'hang'],
      [VERTICAL_THUMBNAIL, () => 'hang'],
    ], { timeoutMs: 50 })

    expect(await lookup('https://www.youtube.com/shorts/tPEE9ZwTmy0')).toEqual({
      kind: 'youtube-short',
      canonicalLink: 'https://www.youtube.com/shorts/tPEE9ZwTmy0',
      ...nothing,
    })
  })

  test('a redirect loop gives an empty result', async () => {
    const { lookup } = lookupWith([['https://loop.example/', () => redirect('https://loop.example/again')]])

    expect(await lookup('https://loop.example/')).toMatchObject({ kind: 'other', ...nothing })
  })

  test.each([
    'http://localhost:3000/api/me',
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.7/',
    'http://[::1]/',
  ])('a private address (%s) is never fetched', async (link) => {
    const { lookup, upstream } = lookupWith([['http', () => html(fixture('blog-og-only.html'))]])

    expect(await lookup(link)).toMatchObject({ kind: 'other', ...nothing })
    expect(upstream.requested).toEqual([])
  })

  test('a redirect to a private address is not followed', async () => {
    const { lookup, upstream } = lookupWith([
      ['https://sneaky.example/', () => redirect('http://127.0.0.1:3000/')],
      ['http://127.0.0.1', () => html(fixture('blog-og-only.html'))],
    ])

    expect(await lookup('https://sneaky.example/')).toMatchObject(nothing)
    expect(upstream.requested).toEqual(['https://sneaky.example/'])
  })

  test('something that is not a link gives an empty result', async () => {
    const { lookup } = lookupWith([])

    expect(await lookup('  not a link  ')).toEqual({ kind: 'other', canonicalLink: 'not a link', ...nothing })
  })
})

describe('Suggested Title shortening', () => {
  function captioned(title: string) {
    return lookupWith([[TIKTOK_OEMBED, () => json({ ...JSON.parse(fixture('tiktok-oembed.json')), title })]])
      .lookup('https://www.tiktok.com/@scout2015/video/6718335390845095173')
      .then(result => result.suggestedTitle)
  }

  test.each([
    ['hashtags go', 'Crispy tofu bowl #vegan #tofu #fyp', 'Crispy tofu bowl'],
    ['hashtags with umlauts go', 'Schnelle Linsensuppe #veganrezepte #gesundessen #küche', 'Schnelle Linsensuppe'],
    ['emojis go, including skin tones, flags and joined ones', '🔥Spicy 👩🏽‍🍳 noodles 🇯🇵✨', 'Spicy noodles'],
    ['only the first line is kept', 'Creamy gochujang pasta\n\nIngredients:\n- 200g pasta', 'Creamy gochujang pasta'],
    ['a first line of only hashtags and emojis is skipped', '#recipe #easy 🍝\r\nOne-pot lemon orzo\nmore text', 'One-pot lemon orzo'],
    ['separators left dangling are trimmed', 'Dumplings from scratch — #dumplings', 'Dumplings from scratch'],
    ['nothing usable gives an empty title', '#fyp #foryou 😍🔥', ''],
  ])('%s', async (_, caption, expected) => {
    expect(await captioned(caption)).toBe(expected)
  })

  test('an overlong title is cut at a word boundary with an ellipsis', async () => {
    const title = await captioned('This is the absolute best vegan lasagna you will ever make in your life and it only takes thirty minutes to prepare')

    expect(title).toBe('This is the absolute best vegan lasagna you will ever make in your life and it…')
    expect(title.length).toBeLessThanOrEqual(80)
  })
})
