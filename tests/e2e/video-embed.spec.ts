import { test as withoutPolicyCheck, type Page, type Request } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'
import { INSTAGRAM_GRACE_MS } from '../../shared/video-embed'

// Click-to-play video (#221): a TikTok, YouTube Short or Instagram Dish
// shows its image and "Video abspielen" in the Dish detail, and nothing
// from the platform loads until that is tapped; then the platform's player
// plays in place. The players are stubbed here: the browser tests never
// reach real upstreams. Barbara McClintock's Board is used by this file
// only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const SHORT = 'https://www.youtube.com/shorts/tPEE9ZwTmy0'
const REEL = 'https://www.instagram.com/reel/C0WUh-tqkxU/'
const PRIVATE_POST = 'https://www.instagram.com/p/AAAAAAAAAAA/'
// A Reel Instagram's embed only shows with "Auf Instagram ansehen" (#279).
const OUTSIDE_REEL = 'https://www.instagram.com/reel/DFvsVH_OD9h/'

const DISHES = [
  { title: 'Tofu im Video', sourceLink: TIKTOK, sourceKind: 'tiktok' },
  { title: 'Ramen als Short', sourceLink: SHORT, sourceKind: 'youtube-short' },
  { title: 'Brötchen als Reel', sourceLink: REEL, sourceKind: 'instagram-reel' },
  { title: 'Privater Post', sourceLink: PRIVATE_POST, sourceKind: 'instagram-post' },
  { title: 'Pasta vom Pin', sourceLink: 'https://www.pinterest.com/pin/99360735500167749/', sourceKind: 'pinterest-pin' },
  { title: 'Brownies vom Blog', sourceLink: 'https://www.loveandlemons.com/brownies-recipe/', sourceKind: 'blog' },
  { title: 'Bowl nur auf Instagram', sourceLink: OUTSIDE_REEL, sourceKind: 'instagram-reel' },
]

const PLATFORM_HOST = /(^|\.)(tiktok|tiktokcdn|youtube|youtube-nocookie|ytimg|googlevideo|instagram|cdninstagram|fbcdn)\.(com|net)$/

// Every request the page makes to a video platform, from now on.
function platformRequests(page: Page): string[] {
  const seen: string[] = []
  page.on('request', (request: Request) => {
    if (PLATFORM_HOST.test(new URL(request.url()).hostname)) seen.push(request.url())
  })
  return seen
}

// What the server would find on Instagram's embed pages (#279; covered at
// Seam 2): the Reel plays in place, the broken post is unknown, and the
// other Reel Instagram only shows with "Auf Instagram ansehen".
const PLAYS_IN_PLACE: Record<string, boolean | null> = { [REEL]: true, [PRIVATE_POST]: null, [OUTSIDE_REEL]: false }

// Stand-ins for the platforms' players. Instagram's tells the page around it
// how it is doing as the real one does: "LOADING", then "MEASURE" and
// "MOUNTED" once the post shows; a post it can't embed never gets past
// "LOADING".
async function stubPlayers(page: Page) {
  const player = (name: string, script = '') => `<!doctype html><title>${name}</title><body style="margin:0;background:#000;color:#fff">${name} spielt<script>${script}</script></body>`
  const say = (type: string, details: object = {}) => `parent.postMessage(JSON.stringify({ details: ${JSON.stringify(details)}, type: '${type}' }), '*');`
  await page.route('**/api/instagram-plays?*', route => route.fulfill({
    json: { playsInPlace: PLAYS_IN_PLACE[new URL(route.request().url()).searchParams.get('link') ?? ''] ?? null },
  }))
  await page.route('https://www.tiktok.com/player/**', route => route.fulfill({ contentType: 'text/html', body: player('TikTok-Player') }))
  await page.route('https://www.youtube-nocookie.com/embed/**', route => route.fulfill({ contentType: 'text/html', body: player('YouTube-Player') }))
  await page.route('https://www.instagram.com/reel/C0WUh-tqkxU/embed/', route => route.fulfill({
    contentType: 'text/html',
    body: player('Instagram-Embed', say('LOADING') + say('MEASURE', { height: 640 }) + say('MOUNTED', { styles: [] })),
  }))
  await page.route('https://www.instagram.com/p/AAAAAAAAAAA/embed/', route => route.fulfill({
    contentType: 'text/html',
    body: player('Kaputtes Embed', say('LOADING')),
  }))
}

async function openDetail(page: Page, title: string) {
  await page.getByRole('link', { name: title }).click()
  const detail = page.getByRole('dialog', { name: title })
  await expect(detail).toBeVisible()
  return detail
}

async function closeDetail(page: Page, title: string) {
  const detail = page.getByRole('dialog', { name: title })
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()
}

test('video Dishes show their image and "Video abspielen", and load nothing from the platform', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[50])
  // CI's retry runs the whole file again, on the same database.
  await resetBoard(page)
  for (const dish of [...DISHES].reverse()) await seedDish(page, dish)
  await stubPlayers(page)
  const requests = platformRequests(page)

  for (const width of [390, 1024]) {
    await page.setViewportSize({ width, height: 844 })
    await gotoHydrated(page, '/')
    for (const { title } of DISHES.slice(0, 4)) {
      const detail = await openDetail(page, title)
      await expect(detail.getByRole('button', { name: 'Video abspielen' })).toBeVisible()
      await expect(detail.locator('[data-detail-image] img').first()).toBeVisible()
      await expect(detail.locator('iframe')).toHaveCount(0)
      await closeDetail(page, title)
    }
  }
  expect(requests).toEqual([])
})

test('Pinterest and blog Dishes get no "Video abspielen", and their detail is as before', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[50])
  await gotoHydrated(page, '/')

  for (const { title, sourceLink } of DISHES.filter(({ sourceKind }) => sourceKind === 'pinterest-pin' || sourceKind === 'blog')) {
    const detail = await openDetail(page, title)
    await expect(detail.getByRole('link', { name: 'Original öffnen' })).toHaveAttribute('href', sourceLink)
    await expect(detail.getByRole('button', { name: 'Video abspielen' })).toHaveCount(0)
    await expect(detail.locator('iframe')).toHaveCount(0)
    await closeDetail(page, title)
  }
})

for (const [title, player, src] of [
  ['Tofu im Video', 'TikTok-Player', 'https://www.tiktok.com/player/v1/6718335390845095173?autoplay=1&rel=0'],
  ['Ramen als Short', 'YouTube-Player', 'https://www.youtube-nocookie.com/embed/tPEE9ZwTmy0?autoplay=1&playsinline=1&rel=0'],
] as const) {
  test(`"Video abspielen" plays "${title}" in place; closed and reopened, the image is back`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await signIn(page, ALLOWLISTED[50])
    await stubPlayers(page)
    await gotoHydrated(page, '/')
    const requests = platformRequests(page)

    let detail = await openDetail(page, title)
    await detail.getByRole('button', { name: 'Video abspielen' }).click()

    const frame = detail.locator('iframe')
    await expect(frame).toHaveAttribute('src', src)
    await expect(frame).toBeVisible()
    await expect(page.frameLocator(`iframe[src="${src}"]`).getByText(`${player} spielt`)).toBeVisible()
    // In the image's place: the image is gone, the frame is still at the top.
    await expect(detail.locator('[data-detail-image] img')).toHaveCount(0)
    await expect(detail.locator('[data-detail-image] iframe')).toHaveCount(1)
    await expect(detail.getByRole('button', { name: 'Video abspielen' })).toHaveCount(0)
    // Still in the app.
    await expect(page).toHaveURL(/^http:\/\/localhost/)
    expect(requests.length).toBeGreaterThan(0)

    await closeDetail(page, title)
    await expect(page.locator('iframe')).toHaveCount(0)
    requests.length = 0

    detail = await openDetail(page, title)
    await expect(detail.getByRole('button', { name: 'Video abspielen' })).toBeVisible()
    await expect(detail.locator('[data-detail-image] img').first()).toBeVisible()
    await expect(detail.locator('iframe')).toHaveCount(0)
    expect(requests).toEqual([])
    await closeDetail(page, title)
  })
}

test('an Instagram post plays in Instagram\'s embed, sized as it asks', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[50])
  await stubPlayers(page)
  await gotoHydrated(page, '/')

  const detail = await openDetail(page, 'Brötchen als Reel')
  await detail.getByRole('button', { name: 'Video abspielen' }).click()

  const frame = detail.locator('iframe')
  await expect(frame).toHaveAttribute('src', 'https://www.instagram.com/reel/C0WUh-tqkxU/embed/')
  await expect(frame).toBeVisible()
  await expect.poll(async () => (await frame.boundingBox())?.height).toBe(640)
  // Past the time a post that can't be embedded gets, it still shows.
  await page.waitForTimeout(INSTAGRAM_GRACE_MS + 500)
  await expect(frame).toBeVisible()
  await expect(detail.getByRole('link', { name: 'Auf Instagram öffnen' })).toHaveCount(0)
})

test('an Instagram post that can\'t be embedded shows a link to it on Instagram instead', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[50])
  await stubPlayers(page)
  await gotoHydrated(page, '/')

  const detail = await openDetail(page, 'Privater Post')
  await detail.getByRole('button', { name: 'Video abspielen' }).click()
  // While it is still trying, the broken embed isn't shown.
  await expect(detail.locator('iframe')).toHaveCSS('opacity', '0')

  const link = detail.getByRole('link', { name: 'Auf Instagram öffnen' })
  await expect(link).toBeVisible({ timeout: INSTAGRAM_GRACE_MS + 5000 })
  await expect(link).toHaveAttribute('href', PRIVATE_POST)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(detail.getByText('Dieses Video lässt sich hier nicht abspielen.')).toBeVisible()
  await expect(detail.locator('iframe')).toHaveCount(0)
})

test('a Reel Instagram won\'t play here links to it on Instagram instead of "Video abspielen"', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[50])
  await stubPlayers(page)
  await gotoHydrated(page, '/')
  const requests = platformRequests(page)

  const detail = await openDetail(page, 'Bowl nur auf Instagram')
  const link = detail.getByRole('link', { name: 'Auf Instagram ansehen' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', OUTSIDE_REEL)
  await expect(link).toHaveAttribute('target', '_blank')
  await expect(detail.getByRole('button', { name: 'Video abspielen' })).toHaveCount(0)
  await expect(detail.locator('[data-detail-image] img').first()).toBeVisible()
  await expect(detail.locator('iframe')).toHaveCount(0)
  expect(requests).toEqual([])
})

// Without the fixture's own check: the violation is what this test is after.
withoutPolicyCheck('a frame from any other origin is still against the Content Security Policy', async ({ page }) => {
  const violations: string[] = []
  page.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) violations.push(message.text())
  })
  await page.route('https://elsewhere.example/**', route => route.fulfill({ contentType: 'text/html', body: 'Fremd' }))
  await page.goto('/login')

  await page.evaluate(() => {
    const frame = document.createElement('iframe')
    frame.src = 'https://elsewhere.example/player'
    document.body.append(frame)
  })

  await expect.poll(() => violations.join('\n')).toContain('frame-src')
  expect(violations.join('\n')).toContain('Framing \'https://elsewhere.example/\'')
})
