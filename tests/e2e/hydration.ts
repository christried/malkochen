import type { Page } from '@playwright/test'

type NuxtWindow = { useNuxtApp?: () => { isHydrating: boolean } }

// Server-rendered pages look finished before they work: until Vue hydrates,
// no event listener is attached and a click is a silent no-op (Playwright does
// not retry clicks). Wait for Nuxt itself to report hydration done -- the same
// check @nuxt/test-utils' waitForHydration uses. Pattern from malmachen.
async function waitForHydration(page: Page) {
  await page.waitForFunction(() => (window as unknown as NuxtWindow).useNuxtApp?.().isHydrating === false)
}

export async function gotoHydrated(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'load' })
  await waitForHydration(page)
}

export async function reloadHydrated(page: Page) {
  await page.reload({ waitUntil: 'load' })
  await waitForHydration(page)
}
