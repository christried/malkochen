import { describe, expect, test } from 'vitest'
import { createSourceLookup } from '../../server/source-lookup'
import { fakeUpstream, fixture, html, json, redirect, status, type Route } from './fake-upstream'

function lookupWith(routes: Route[], options: { timeoutMs?: number } = {}) {
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
      creator: 'Scout, Suki & Stella',
      imageUrl: expect.stringMatching(/^https:\/\/p16-common-sign\.tiktokcdn-eu\.com\/tos-maliva-p-0068\/2367c7d45cf54a1397abd/),
    })
  })

  test.each([
    ['spaces and line breaks are tidied', '  Vegan\n  Kitchen  ', 'Vegan Kitchen'],
    ['a blank author is no Creator', '   ', null],
    ['a missing author is no Creator', undefined, null],
  ])('the Creator: %s', async (_, authorName, expected) => {
    const { lookup } = lookupWith([[TIKTOK_OEMBED, () => json({ ...JSON.parse(fixture('tiktok-oembed.json')), author_name: authorName })]])

    expect((await lookup('https://www.tiktok.com/@scout2015/video/6718335390845095173')).creator).toBe(expected)
  })

  test('an overlong Creator is cut to 100 characters with an ellipsis', async () => {
    const { lookup } = lookupWith([[TIKTOK_OEMBED, () => json({ ...JSON.parse(fixture('tiktok-oembed.json')), author_name: `Die ${'sehr '.repeat(30)}lange Küche` })]])

    const { creator } = await lookup('https://www.tiktok.com/@scout2015/video/6718335390845095173')

    expect(creator).toMatch(/^Die sehr sehr .*sehr…$/)
    expect(creator!.length).toBeLessThanOrEqual(100)
  })

  test('cutting an overlong Creator never splits an emoji', async () => {
    const { lookup } = lookupWith([[TIKTOK_OEMBED, () => json({ ...JSON.parse(fixture('tiktok-oembed.json')), author_name: `${'a'.repeat(98)}🌱🌱🌱` })]])

    expect((await lookup('https://www.tiktok.com/@scout2015/video/6718335390845095173')).creator).toBe(`${'a'.repeat(98)}…`)
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
      creator: null,
      imageUrl: null,
    })
  })
})

const INSTAGRAM_REEL_PAGE = 'https://www.instagram.com/reel/C0WUh-tqkxU/'
const INSTAGRAM_REEL_EMBED = 'https://www.instagram.com/reel/C0WUh-tqkxU/embed/captioned/'
const INSTAGRAM_POST_EMBED = 'https://www.instagram.com/p/C0WUh-tqkxU/embed/captioned/'
// The embed page's image: the cover without a play button, 720 pixels wide.
const EMBED_IMAGE = /^https:\/\/scontent-ham3-1\.cdninstagram\.com\/v\/t51\.71878-15\/498545386_3002789429884475_7188408567440722305_n\.jpg\?stp=dst-jpg_e15_tt6&_nc_cat=100&/
// The post page's og:image: the same cover, half the size, with a play button.
const POST_PAGE_IMAGE = /^https:\/\/scontent-dus1-1\.cdninstagram\.com\/v\/t51\.71878-15\/498545386_3002789429884475_7188408567440722305_n\.jpg\?stp=cmp1_dst-jpg_e35_s640x640_tt6&_nc_cat=100&/

describe('Instagram', () => {
  test('a Reel gives its caption as Suggested Title, its account as Creator and the image from its embed page', async () => {
    const { lookup, upstream } = lookupWith([[INSTAGRAM_REEL_EMBED, () => html(fixture('instagram-embed-captioned.html'))]])

    expect(await lookup('https://www.instagram.com/vegan_govegan/reel/C0WUh-tqkxU/?igsh=MTc4MmM1YmI2Ng==')).toEqual({
      kind: 'instagram-reel',
      canonicalLink: 'https://www.instagram.com/reel/C0WUh-tqkxU/',
      suggestedTitle: 'Easy Overnight Bread Rolls',
      creator: 'vegan_govegan',
      imageUrl: expect.stringMatching(EMBED_IMAGE),
    })
    // Everything came from the embed page: the post page isn't asked.
    expect(upstream.requested).toEqual([INSTAGRAM_REEL_EMBED])
  })

  test('a post is its own kind of Source, read from its own embed page', async () => {
    const { lookup } = lookupWith([[INSTAGRAM_POST_EMBED, () => html(fixture('instagram-embed-captioned.html'))]])

    expect(await lookup('https://instagram.com/p/C0WUh-tqkxU')).toEqual({
      kind: 'instagram-post',
      canonicalLink: 'https://www.instagram.com/p/C0WUh-tqkxU/',
      suggestedTitle: 'Easy Overnight Bread Rolls',
      creator: 'vegan_govegan',
      imageUrl: expect.stringMatching(EMBED_IMAGE),
    })
  })

  test('a share link is resolved to the post before its embed page is read', async () => {
    const { lookup } = lookupWith([
      ['https://www.instagram.com/share/reel/BAbc123/', () => redirect('https://www.instagram.com/reel/C0WUh-tqkxU/?igsh=MTc4MmM1YmI2Ng==')],
      [INSTAGRAM_REEL_EMBED, () => html(fixture('instagram-embed-captioned.html'))],
    ])

    expect(await lookup('https://www.instagram.com/share/reel/BAbc123/')).toMatchObject({
      kind: 'instagram-reel',
      canonicalLink: 'https://www.instagram.com/reel/C0WUh-tqkxU/',
      suggestedTitle: 'Easy Overnight Bread Rolls',
    })
  })

  test('without a caption there is no Suggested Title, but still the Creator and the image', async () => {
    const { lookup } = lookupWith([[INSTAGRAM_POST_EMBED, () => html(fixture('instagram-embed-no-caption.html'))]])

    expect(await lookup('https://www.instagram.com/p/C0WUh-tqkxU/')).toEqual({
      kind: 'instagram-post',
      canonicalLink: 'https://www.instagram.com/p/C0WUh-tqkxU/',
      suggestedTitle: '',
      creator: 'vegan_govegan',
      imageUrl: expect.stringMatching(EMBED_IMAGE),
    })
  })

  test.each<[string, Route[]]>([
    ['shows a broken embed', [[INSTAGRAM_REEL_EMBED, () => html(fixture('instagram-embed-broken.html'))]]],
    ['answers with an error', [[INSTAGRAM_REEL_EMBED, () => status(500)]]],
    ['is unreachable', []],
  ])('when the embed page %s, the image comes from the post page, without a title', async (_, embed) => {
    const { lookup } = lookupWith([...embed, [INSTAGRAM_REEL_PAGE, () => html(fixture('instagram-reel-page.html'))]])

    expect(await lookup('https://www.instagram.com/reel/C0WUh-tqkxU/')).toEqual({
      kind: 'instagram-reel',
      canonicalLink: 'https://www.instagram.com/reel/C0WUh-tqkxU/',
      suggestedTitle: '',
      creator: null,
      imageUrl: expect.stringMatching(POST_PAGE_IMAGE),
    })
  })

  test('an embed page that stalls leaves half the time for the post page\'s image', async () => {
    const { lookup } = lookupWith([
      [INSTAGRAM_REEL_EMBED, () => 'hang'],
      [INSTAGRAM_REEL_PAGE, () => html(fixture('instagram-reel-page.html'))],
    ], { timeoutMs: 200 })

    expect((await lookup(INSTAGRAM_REEL_PAGE)).imageUrl).toMatch(POST_PAGE_IMAGE)
  })

  test('an embed page with a caption but no image keeps the caption and takes the post page\'s image', async () => {
    const withoutImage = fixture('instagram-embed-captioned.html').replace(/<img class="EmbeddedMediaImage"[^>]*>/, '')
    const { lookup } = lookupWith([
      [INSTAGRAM_REEL_EMBED, () => html(withoutImage)],
      [INSTAGRAM_REEL_PAGE, () => html(fixture('instagram-reel-page.html'))],
    ])

    expect(await lookup('https://www.instagram.com/reel/C0WUh-tqkxU/')).toEqual({
      kind: 'instagram-reel',
      canonicalLink: 'https://www.instagram.com/reel/C0WUh-tqkxU/',
      suggestedTitle: 'Easy Overnight Bread Rolls',
      creator: 'vegan_govegan',
      imageUrl: expect.stringMatching(POST_PAGE_IMAGE),
    })
  })

  test.each([
    ['hashtags and emojis are left out of the first line', 'Cremige Pilzpasta 🍄🍝 #vegan #pasta<br />Rezept unten', 'Cremige Pilzpasta'],
    ['a first line of only hashtags and emojis is skipped', '#vegan #foodie 🌱<br /><br />Linsen-Dal mit Spinat', 'Linsen-Dal mit Spinat'],
    ['linked hashtags count as hashtags', '<a href="/explore/tags/vegan/">#vegan</a> <a href="/explore/tags/dal/">#dal</a><br />Linsen-Dal', 'Linsen-Dal'],
    ['a shouted caption is put into normal case', 'CREMIGE PILZPASTA<br />so gut', 'Cremige Pilzpasta'],
    ['entities are read as text', 'Mac &amp; Cheese ohne K&#xe4;se &#x1f9c0;', 'Mac & Cheese ohne Käse'],
    ['a line separator ends the line, like a line break', 'Cremige Pilzpasta\u2028Zutaten: 200 g Nudeln', 'Cremige Pilzpasta'],
    ['Instagram\'s blank padding character is space', '\u2800\u2800<br />Linsen-Dal\u2800\u2800 #vegan', 'Linsen-Dal'],
    ['a verified account\'s name is no title either', 'Linsen-Dal', 'Linsen-Dal', '<a class="CaptionUsername notranslate" href="/vegan_govegan/">vegan_govegan<span class="Verified"></span></a>'],
  ])('the caption: %s', async (_, caption, expected, usernameLink = '$1') => {
    const page = fixture('instagram-embed-captioned.html')
      .replace(/(<a class="CaptionUsername"[^>]*>vegan_govegan<\/a>)[\s\S]*?(<div class="CaptionComments">)/, `${usernameLink}<br /><br />${caption}$2`)
    const { lookup } = lookupWith([[INSTAGRAM_REEL_EMBED, () => html(page)]])

    expect((await lookup(INSTAGRAM_REEL_PAGE)).suggestedTitle).toBe(expected)
  })

  test('a caption of only the account\'s name, in any markup, gives no Suggested Title', async () => {
    const page = fixture('instagram-embed-no-caption.html')
      .replace(/<a class="CaptionUsername"[^>]*>vegan_govegan<\/a>/, '<a class=\'CaptionUsername notranslate\' href="/vegan_govegan/">vegan_govegan<span class="Verified"></span></a>')
    const { lookup } = lookupWith([[INSTAGRAM_REEL_EMBED, () => html(page)]])

    expect((await lookup(INSTAGRAM_REEL_PAGE)).suggestedTitle).toBe('')
  })

  test('a login wall gives no title and no image', async () => {
    const { lookup } = lookupWith([
      [INSTAGRAM_REEL_EMBED, () => redirect('https://www.instagram.com/accounts/login/?next=%2Freel%2FC0WUh-tqkxU%2Fembed%2Fcaptioned%2F')],
      [INSTAGRAM_REEL_PAGE, () => redirect('https://www.instagram.com/accounts/login/?next=%2Freel%2FC0WUh-tqkxU%2F')],
      ['https://www.instagram.com/accounts/login/', () => html(fixture('instagram-login-page.html'))],
    ])

    expect(await lookup('https://www.instagram.com/reels/C0WUh-tqkxU/')).toEqual({
      kind: 'instagram-reel',
      canonicalLink: 'https://www.instagram.com/reel/C0WUh-tqkxU/',
      suggestedTitle: '',
      creator: null,
      imageUrl: null,
    })
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
      creator: 'Mylo the Cat',
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
const PIN_IMAGE_736 = 'https://i.pinimg.com/736x/a7/66/56/a76656e966b1958f568d63c3f1c05aec.jpg'

describe('Pinterest', () => {
  const PIN_PAGE = 'https://www.pinterest.com/pin/99360735500167749/'

  test('a Pin gives its title from the Pin page, its pinner as Creator and a larger image', async () => {
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_IMAGE_736, () => status(200)],
      // Recorded: the Pin page redirects to the reader's language.
      [PIN_PAGE, () => redirect('https://de.pinterest.com/pin/99360735500167749/')],
      ['https://de.pinterest.com/pin/99360735500167749/', () => html(fixture('pinterest-pin-page.html'))],
    ])

    expect(await lookup('https://de.pinterest.com/pin/99360735500167749/?mt=login')).toEqual({
      kind: 'pinterest-pin',
      canonicalLink: 'https://www.pinterest.com/pin/99360735500167749/',
      // og:title up to the first " | "; the board keywords after it are left out.
      suggestedTitle: 'Goodbye Live Tweeting, Hello Live Pinning',
      creator: 'Kent Brewster',
      imageUrl: 'https://i.pinimg.com/736x/a7/66/56/a76656e966b1958f568d63c3f1c05aec.jpg',
    })
  })

  test('a Pin whose og:title has no " | " takes all of it', async () => {
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      ['https://www.pinterest.com/pin/85779567902561995/', () => html(fixture('pinterest-pin-page-plain-title.html'))],
    ])

    expect((await lookup('https://www.pinterest.com/pin/85779567902561995/')).suggestedTitle).toBe('Crispy Baked Tofu with Italian Herbs')
  })

  test('a Pin title is put into shape like any Suggested Title', async () => {
    const page = fixture('pinterest-pin-page.html')
      .replace(/content="Goodbye Live Tweeting, Hello Live Pinning \|([^"]*)" data-app="true" name="og:title"/, 'content="CREMIGE PILZPASTA 🍄 #vegan |$1" data-app="true" name="og:title"')
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_PAGE, () => html(page)],
    ])

    expect((await lookup(PIN_PAGE)).suggestedTitle).toBe('Cremige Pilzpasta')
  })

  test.each<[string, Route[]]>([
    ['has no Pin in it', [[PIN_PAGE, () => html(fixture('pinterest-pin-page-missing.html'))]]],
    ['answers with an error', [[PIN_PAGE, () => status(500)]]],
    ['is unreachable', []],
  ])('when the Pin page %s, there is no Suggested Title, but still the image and the Creator', async (_, pinPage) => {
    const { lookup } = lookupWith([
      ...pinPage,
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_IMAGE_736, () => status(200)],
    ])

    expect(await lookup(PIN_PAGE)).toEqual({
      kind: 'pinterest-pin',
      canonicalLink: PIN_PAGE,
      suggestedTitle: '',
      creator: 'Kent Brewster',
      imageUrl: PIN_IMAGE_736,
    })
  })

  test('a page that isn\'t a Pin gives no Suggested Title, even with an og:title', async () => {
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_PAGE, () => html('<html><head><meta property="og:type" content="website"><meta property="og:title" content="Pinterest"></head></html>')],
    ])

    expect((await lookup(PIN_PAGE)).suggestedTitle).toBe('')
  })

  test('a Pin page that stalls is given up after half the time, and the image still comes', async () => {
    const { lookup } = lookupWith([
      [PIN_PAGE, () => 'hang'],
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_IMAGE_736, () => status(200)],
    ], { timeoutMs: 2000 })

    const started = performance.now()
    expect(await lookup(PIN_PAGE)).toMatchObject({ suggestedTitle: '', imageUrl: PIN_IMAGE_736 })
    // Given up at 1 s, not at the lookup's 2 s deadline.
    expect(performance.now() - started).toBeLessThan(1600)
  })

  test('a Pin without a title of its own gives no Suggested Title, not the "Pin auf <board>" Pinterest makes up', async () => {
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      ['https://www.pinterest.com/pin/99360735527172842/', () => html(fixture('pinterest-pin-page-untitled.html'))],
    ])

    expect((await lookup('https://www.pinterest.com/pin/99360735527172842/')).suggestedTitle).toBe('')
  })

  test('nor the English "Pin on <board>"', async () => {
    const page = fixture('pinterest-pin-page-untitled.html').replace(/content="Pin auf Instagram" data-app="true" name="og:title"/, 'content="Pin on Instagram" data-app="true" name="og:title"')
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_PAGE, () => html(page)],
    ])

    expect((await lookup(PIN_PAGE)).suggestedTitle).toBe('')
  })

  test('the pinner\'s profile tagline after " | " is no part of the Creator', async () => {
    // Recorded: oEmbed's author_name for Pin 85779567902561995.
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json({ ...JSON.parse(fixture('pinterest-oembed.json')), author_name: 'Minimalist Baker | Simple Recipes That Make You Feel Good' })],
    ])

    expect((await lookup(PIN_PAGE)).creator).toBe('Minimalist Baker')
  })

  test('oEmbed\'s title is never used, even when the Pin page gives none', async () => {
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json({ ...JSON.parse(fixture('pinterest-oembed.json')), title: 'Crispy Baked Tofu with Italian Herbs' })],
      [PIN_PAGE, () => html(fixture('pinterest-pin-page-missing.html'))],
    ])

    expect((await lookup(PIN_PAGE)).suggestedTitle).toBe('')
  })

  test('keeps the oEmbed image when no larger size exists', async () => {
    const { lookup } = lookupWith([
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_IMAGE_736, () => status(404)],
    ])

    const result = await lookup('https://www.pinterest.com/pin/99360735500167749/')

    expect(result.imageUrl).toBe('https://i.pinimg.com/236x/a7/66/56/a76656e966b1958f568d63c3f1c05aec.jpg')
  })

  test('a pin.it short link resolves to the canonical Pin link', async () => {
    const { lookup } = lookupWith([
      // Recorded: pin.it → api.pinterest.com/url_shortener/… → the Pin.
      ['https://pin.it/1nzvMpNHh', () => redirect('https://api.pinterest.com/url_shortener/1nzvMpNHh/redirect/', 308)],
      ['https://api.pinterest.com/url_shortener/1nzvMpNHh/redirect/', () => redirect('https://www.pinterest.de/pin/99360735500167749/sent/?invite_code=a1b2&sender=123&sfo=1')],
      ['https://www.pinterest.de/pin/', () => 'hang'],
      [PINTEREST_OEMBED, () => json(fixture('pinterest-oembed.json'))],
      [PIN_IMAGE_736, () => status(200)],
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
      // The Recipe's first author, not the site (og:site_name "Love and Lemons").
      creator: 'Jeanine Donofrio',
      imageUrl: 'https://cdn.loveandlemons.com/wp-content/uploads/2020/01/brownie-recipe-500x500.jpg',
    })
  })

  test('Recipe JSON-LD with a relative image string, HTML entities in its name and an author by name only', async () => {
    expect(await page('https://veggie-kueche.example/knuspriger-tofu/', 'blog-recipe-string.html')).toEqual({
      kind: 'blog',
      canonicalLink: 'https://veggie-kueche.example/knuspriger-tofu/',
      suggestedTitle: 'Knuspriger Tofu mit Erdnusssoße & Reis',
      creator: 'Lena Müller',
      imageUrl: 'https://veggie-kueche.example/wp-content/uploads/2025/03/knuspriger-tofu.jpg',
    })
  })

  test('Recipe JSON-LD with an ImageObject and an author by reference, among other top-level items', async () => {
    expect(await page('https://cozy-kitchen.example/dal', 'blog-recipe-object.html')).toMatchObject({
      kind: 'blog',
      suggestedTitle: 'Red Lentil Dal',
      creator: 'Maya Patel',
      imageUrl: 'https://cozy-kitchen.example/images/dal-1200.jpg',
    })
  })

  test.each([
    ['in another JSON-LD block', '<script type="application/ld+json">{"@type":"Recipe","name":"Dal","author":{"@id":"#maya"}}</script><script type="application/ld+json">{"@graph":[{"@type":"Person","@id":"#maya","name":"Maya Patel"}]}</script>'],
    ['with an empty name beside the reference', '<script type="application/ld+json">[{"@type":"Recipe","name":"Dal","author":{"@id":"#maya","name":""}},{"@type":"Person","@id":"#maya","name":"Maya Patel"}]</script>'],
  ])('a Recipe author referred to by @id is found %s', async (_, scripts) => {
    const link = 'https://cozy-kitchen.example/dal'
    const { lookup } = lookupWith([[link, () => html(`<html><head><meta property="og:site_name" content="Cozy Kitchen">${scripts}</head></html>`)]])

    expect((await lookup(link)).creator).toBe('Maya Patel')
  })

  test('a page with only og: tags uses them, without the site name in the title, and the site as Creator', async () => {
    expect(await page('https://salt-and-pan.example/shakshuka', 'blog-og-only.html')).toEqual({
      kind: 'blog',
      canonicalLink: 'https://salt-and-pan.example/shakshuka',
      suggestedTitle: 'Weekend Shakshuka',
      creator: 'Salt & Pan',
      imageUrl: 'https://cdn.salt-and-pan.example/shakshuka.jpg',
    })
  })

  test('a page with only twitter: tags uses them', async () => {
    expect(await page('https://pics.example/miso', 'blog-twitter-only.html')).toMatchObject({
      kind: 'blog',
      suggestedTitle: 'Miso Aubergine',
      creator: null,
      imageUrl: 'https://pics.example/miso.jpg',
    })
  })

  test('a page with nothing but a <title> gives that title and no image', async () => {
    expect(await page('https://recipes.example/crumble', 'blog-title-only.html')).toMatchObject({
      kind: 'blog',
      suggestedTitle: 'Grandma\'s Apple Crumble',
      creator: null,
      imageUrl: null,
    })
  })

  test('a broken page gives no title and no image', async () => {
    expect(await page('https://broken.example/recipe', 'broken-page.html')).toEqual({
      kind: 'other',
      canonicalLink: 'https://broken.example/recipe',
      suggestedTitle: '',
      creator: null,
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
  const nothing = { suggestedTitle: '', creator: null, imageUrl: null }

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
    'http://localhost./',
    'http://[::127.0.0.1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[64:ff9b::a9fe:a9fe]/',
    'http://[2002:7f00:1::]/',
    'http://198.18.0.1/',
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
    ['emojis go, including skin tones, flags and joined ones', '🔥👩🏽‍🍳 Spicy noodles 🇯🇵✨', 'Spicy noodles'],
    ['only the first line is kept', 'Creamy gochujang pasta\n\nIngredients:\n- 200g pasta', 'Creamy gochujang pasta'],
    ['a first line of only hashtags and emojis is skipped', '#recipe #easy 🍝\r\nOne-pot lemon orzo\nmore text', 'One-pot lemon orzo'],
    ['separators left dangling are trimmed', 'Dumplings from scratch — #dumplings', 'Dumplings from scratch'],
    ['nothing usable gives an empty title', '#fyp #foryou 😍🔥', ''],
    ['it ends before the first emoji', 'Crispy tofu bowl 🔥 so good you will want it every day', 'Crispy tofu bowl'],
    ['it ends before the first emoji, even one right after a word', 'Linsen-Dal😍 so cremig und so schnell gemacht', 'Linsen-Dal'],
    ['a sign like ™ is no emoji to end at', 'Brownies mit Nutella™ und Haselnüssen', 'Brownies mit Nutella und Haselnüssen'],
    ['it ends at the first sentence end', 'Cremige Linsensuppe. Perfekt für kalte Tage.', 'Cremige Linsensuppe'],
    ['an exclamation or question mark stays', 'Die beste Lasagne der Welt! Mit Spinat und Ricotta', 'Die beste Lasagne der Welt!'],
    ['a dot in a number or an abbreviation is no sentence end', 'Lasagne 2.0 für 4 Pers. mit ca. 500 g Spinat, z.B. 1 Msp. Muskat, 30 Min. lang', 'Lasagne 2.0 für 4 Pers. mit ca. 500 g Spinat, z.B. 1 Msp. Muskat, 30 Min. lang'],
    ['a sentence ending in a short word ends there', 'Ich liebe es. Probier es aus', 'Ich liebe es'],
    ['a sentence ending in a bracket or quote ends there', 'Pasta nach Omas Rezept (super einfach). Lecker', 'Pasta nach Omas Rezept (super einfach)'],
    ['a bare number is no title', '5 🔥 Tipps für cremige Pasta', 'Tipps für cremige Pasta'],
    ['an ellipsis is no sentence end', 'Warte kurz... diese Pasta ist es wert', 'Warte kurz... diese Pasta ist es wert'],
    ['a sentence with nothing in it is skipped', '!!! Knusprige Ofenkartoffeln', 'Knusprige Ofenkartoffeln'],
  ])('%s', async (_, caption, expected) => {
    expect(await captioned(caption)).toBe(expected)
  })

  test('an overlong title is cut at a word boundary with an ellipsis', async () => {
    const title = await captioned('This is the absolute best vegan lasagna you will ever make in your life and it only takes thirty minutes to prepare')

    expect(title).toBe('This is the absolute best vegan lasagna you will ever make in your life and it…')
    expect(title.length).toBeLessThanOrEqual(80)
  })

  test.each([
    ['all caps get each word capitalised', 'CREMIGE PILZPASTA', 'Cremige Pilzpasta'],
    ['words not in caps stay', 'CREMIGE PILZPASTA in 15 Minuten', 'Cremige Pilzpasta in 15 Minuten'],
    ['a word not in caps stays in a title in caps', 'VEGANE PASTA x3', 'Vegane Pasta x3'],
    ['short words inside a caps run are lowered', 'LINSEN MIT REIS UND SPINAT', 'Linsen mit Reis und Spinat'],
    ['a short word opening or closing the title stays capitalised', 'DIE BESTE PASTA MIT ÖL', 'Die Beste Pasta mit Öl'],
    ['a number does not end a caps run', 'ZUTATEN FÜR 2 PORTIONEN', 'Zutaten für 2 Portionen'],
    ['a few words in caps, two of them long', 'Pasta mit CREMIGER PILZSAUCE und Tofu', 'Pasta mit Cremiger Pilzsauce und Tofu'],
    ['a lone short acronym outside a caps run stays', 'Pulled JACKFRUIT vom BBQ mit EXTRA Sauce', 'Pulled Jackfruit vom BBQ mit Extra Sauce'],
    ['a short word without vowels inside a caps run is an acronym and stays', 'VEGANE PASTA MIT BBQ SAUCE', 'Vegane Pasta mit BBQ Sauce'],
    ['an acronym opening a hyphenated word stays', 'BBQ-TOFU MIT REIS', 'BBQ-Tofu mit Reis'],
    ['each part of a hyphenated word, short ones too', 'ONE-POT PASTA MIT TOFU', 'One-Pot Pasta mit Tofu'],
    ['caps among hashtags and emojis', '🍄 CREMIGE PILZPASTA 🍄 #vegan #pasta', 'Cremige Pilzpasta'],
    ['umlauts are lowered and raised', 'ÜBERBACKENE ÄPFEL MIT ÖL', 'Überbackene Äpfel mit Öl'],
    ['SS stays SS, it is not guessed to be ß', 'SOSSE FÜR NUDELN', 'Sosse für Nudeln'],
    ['a capital ß becomes a small one', 'SOẞE FÜR NUDELN', 'Soße für Nudeln'],
    ['a small ß among capitals is kept', 'SOßE FÜR NUDELN', 'Soße für Nudeln'],
    ['each part of a hyphenated word', 'PILZ-PASTA MIT TOFU-WÜRFELN', 'Pilz-Pasta mit Tofu-Würfeln'],
    ['words after brackets, quotes and numbers', '(VEGAN) „LASAGNE“ 2.0', '(Vegan) „Lasagne“ 2.0'],
    ['nothing after an apostrophe or a digit', 'MOM’S 5MIN PASTA', 'Mom’s 5min Pasta'],
    ['a name after a one-letter prefix and an apostrophe', "I'M HUNGRY FOR O'BRIEN STEW", "I'm Hungry for O'Brien Stew"],
    ['a word right after letters without case', '寿司SUSHI BOWL', '寿司Sushi Bowl'],
    ['a normal title stays as it is', 'Cremige Pilzpasta mit Tofu', 'Cremige Pilzpasta mit Tofu'],
    ['a short acronym in a normal title stays', 'Pulled Jackfruit vom BBQ', 'Pulled Jackfruit vom BBQ'],
    ['a short title starting with an acronym stays', 'BBQ Dip', 'BBQ Dip'],
    ['short acronyms around one normal word stay', 'XXL BBQ Wrap', 'XXL BBQ Wrap'],
    ['a lone acronym stays', 'BBQ', 'BBQ'],
    ['a few words in caps in a normal title stay', 'Pasta mit BBQ-TOFU', 'Pasta mit BBQ-TOFU'],
    ['one word in caps of two stays', 'VEGANE Lasagne', 'VEGANE Lasagne'],
    ['one long word in caps stays', 'PASTA x3', 'PASTA x3'],
    ['one long word in caps among acronyms stays', 'Die BESTE Pasta vom BBQ', 'Die BESTE Pasta vom BBQ'],
    ['ß in a normal title stays', 'Nudeln mit Soße', 'Nudeln mit Soße'],
    ['a lowercase title stays', 'one-pot lemon orzo', 'one-pot lemon orzo'],
  ])('capitals: %s', async (_, caption, expected) => {
    expect(await captioned(caption)).toBe(expected)
  })

  test('caps are capitalised before an overlong title is cut', async () => {
    const title = await captioned('THIS IS THE ABSOLUTE BEST VEGAN LASAGNA YOU WILL EVER MAKE IN YOUR LIFE AND IT ONLY TAKES THIRTY MINUTES')

    expect(title).toBe('This is the Absolute Best Vegan Lasagna you Will Ever Make in Your Life and it…')
  })

  test('a caption opening with a headline in caps gives just that headline, out of caps', async () => {
    const { lookup } = lookupWith([[TIKTOK_OEMBED, () => json(fixture('tiktok-oembed-eatthis.json'))]])

    // Recorded: "TOFU-REISPAPIER-NUGGETS AUS DEM AIRFRYER 👀 Der virale Reispapier-Trick, aber vegan! …", all on one line.
    expect((await lookup('https://www.tiktok.com/@eatthisorg/video/7688042287548370208')).suggestedTitle).toBe('Tofu-Reispapier-Nuggets aus dem Airfryer')
  })

  test('a YouTube Short\'s title in caps is capitalised too', async () => {
    const { lookup } = lookupWith([
      [YOUTUBE_OEMBED, () => json({ ...JSON.parse(fixture('youtube-oembed.json')), title: 'VEGANE LASAGNE 🍝 #shorts' })],
      [VERTICAL_THUMBNAIL, () => status(200)],
    ])

    expect((await lookup('https://www.youtube.com/shorts/tPEE9ZwTmy0')).suggestedTitle).toBe('Vegane Lasagne')
  })

  test('a blog\'s title in caps is capitalised too', async () => {
    const link = 'https://caps.example/lasagne'
    const { lookup } = lookupWith([[link, () => html('<html><head><title>VEGANE LASAGNE</title></head><body></body></html>')]])

    expect((await lookup(link)).suggestedTitle).toBe('Vegane Lasagne')
  })
})
