import { expect, test, type APIRequestContext } from '@playwright/test'
import { gotoHydrated } from './hydration'

// Installing malkochen on a home screen (PRD story 7): what the browser's
// installability checks read. Chrome needs a linked manifest with a name,
// start_url, display "standalone" and 192px and 512px icons; Android masks
// the maskable ones; iOS takes the apple-touch-icon instead.

async function expectImage(request: APIRequestContext, href: string, type: string) {
  const res = await request.get(href)
  expect(res.status(), href).toBe(200)
  expect(res.headers()['content-type'], href).toContain(type)
}

test('every page links a manifest that makes malkochen installable', async ({ page }) => {
  await gotoHydrated(page, '/login')

  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await page.request.get(href!)).json()

  expect(manifest).toMatchObject({ name: 'malkochen', short_name: 'malkochen', start_url: '/', display: 'standalone', lang: 'de' })
  // Dishes, never recipes (CONTEXT.md).
  expect(manifest.description).toBe('Gerichte sammeln. Zusammen kochen.')
  // One colour only, no media queries: the splash defaults to dark.
  expect(manifest).toMatchObject({ background_color: '#131211', theme_color: '#131211' })
  type Icon = { src: string, sizes: string, type: string, purpose: string }
  const icons = manifest.icons as Icon[]
  for (const purpose of ['any', 'maskable']) {
    for (const sizes of ['192x192', '512x512']) {
      expect(icons.some(i => i.purpose === purpose && i.sizes === sizes), `${purpose} ${sizes}`).toBe(true)
    }
  }
  for (const icon of icons) await expectImage(page.request, icon.src, icon.type)
})

test('iOS gets its home-screen icon and the browser tab its favicons', async ({ page }) => {
  await gotoHydrated(page, '/login')

  const touchIcon = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href')
  await expectImage(page.request, touchIcon!, 'image/png')
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'malkochen')
  for (const link of await page.locator('link[rel="icon"]').all()) {
    await expectImage(page.request, (await link.getAttribute('href'))!, (await link.getAttribute('type'))!)
  }
  // The status bar follows the theme: one theme-color per colour scheme.
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2)
})
