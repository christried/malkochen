import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { TOUR_VERSION } from '../../app/tour/tour'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers, setSeen } from './seed'

// The Changelog Popup (CONTEXT.md, #406): on opening a Board, the Versions
// newer than the one the user saw, once; closing it marks them seen. Not for
// a new user (a new account starts with the app's Version as seen), and not
// in a visit with the Tour. In every other spec it never shows by itself;
// here the pages turn that on. The files list only 1.0.0, so the user who
// "saw 0.9.0" has exactly one Version to see. Hopper is used by this file
// only, and starts each test new.
const HOPPER = ALLOWLISTED[141]

// More than the Board waits before it shows the popup (or the Tour).
const SETTLE_MS = 2500

test.beforeEach(async ({ page }) => {
  await removeUsers(HOPPER)
  await page.addInitScript(() => {
    (window as { e2eChangelogPopup?: boolean }).e2eChangelogPopup = true
  })
  await signIn(page, HOPPER)
})

const popup = (page: Page) => page.getByRole('dialog', { name: 'Was ist neu' })

async function newVersion(page: Page): Promise<boolean> {
  return (await (await page.request.get('/api/me')).json() as { newVersion: boolean }).newVersion
}

test('shown once: it lists the Version, "Alles klar" closes it and marks it seen for good', async ({ page }) => {
  await setSeen(HOPPER, { version: '0.9.0', tourSeen: TOUR_VERSION })
  await gotoHydrated(page, '/')

  await expect(popup(page)).toBeVisible()
  await expect(popup(page).getByRole('heading', { name: /^Version \d/ })).toHaveCount(1)
  await expect(popup(page).getByRole('heading', { name: 'Version 1.0.0' })).toBeVisible()
  await expect(popup(page).getByRole('heading', { name: 'Hinzugefügt' }).first()).toBeVisible()
  await expect(popup(page).getByRole('button', { name: 'Alles klar' })).toBeFocused()

  await popup(page).getByRole('button', { name: 'Alles klar' }).click()

  await expect(popup(page)).toBeHidden()
  await expect.poll(() => newVersion(page)).toBe(false)
  await reloadHydrated(page)
  await page.waitForTimeout(SETTLE_MS)
  await expect(popup(page)).toBeHidden()
})

test('Escape closes it and marks the Version seen too', async ({ page }) => {
  await setSeen(HOPPER, { version: '0.9.0', tourSeen: TOUR_VERSION })
  await gotoHydrated(page, '/')
  await expect(popup(page)).toBeVisible()

  await page.keyboard.press('Escape')

  await expect(popup(page)).toBeHidden()
  await expect.poll(() => newVersion(page)).toBe(false)
})

test('a new user gets no popup: their account starts with the current Version as seen', async ({ page }) => {
  await setSeen(HOPPER, { tourSeen: TOUR_VERSION })
  await gotoHydrated(page, '/')

  await page.waitForTimeout(SETTLE_MS)
  await expect(popup(page)).toBeHidden()
})

test('in a visit with the Tour the popup stays away, during it and after it', async ({ page }) => {
  await page.addInitScript(() => {
    (window as { e2eTourAutoStart?: boolean }).e2eTourAutoStart = true
  })
  await setSeen(HOPPER, { version: '0.9.0' })
  await gotoHydrated(page, '/')

  const hello = page.getByRole('dialog', { name: 'Hallo, ich bin Topfbert!' })
  await expect(hello).toBeVisible()
  await expect(popup(page)).toBeHidden()
  await hello.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('dialog', { name: 'Dein erstes Gericht' }).getByRole('button', { name: 'Überspringen' }).click()
  await expect(page.locator('[data-tour-layer]')).toBeHidden()

  await page.waitForTimeout(SETTLE_MS)
  await expect(popup(page)).toBeHidden()
  expect(await newVersion(page)).toBe(true)
})

test('"Alle Änderungen" opens the whole Changelog', async ({ page }) => {
  await setSeen(HOPPER, { version: '0.9.0', tourSeen: TOUR_VERSION })
  await gotoHydrated(page, '/')

  await popup(page).getByRole('link', { name: 'Alle Änderungen' }).click()

  await expect(page).toHaveURL('/changelog')
  await expect(popup(page)).toBeHidden()
  await expect.poll(() => newVersion(page)).toBe(false)
})

test('on a phone the card keeps 16px on each side and fits the window, its entries scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await setSeen(HOPPER, { version: '0.9.0', tourSeen: TOUR_VERSION })
  await gotoHydrated(page, '/')
  await expect(popup(page)).toBeVisible()

  const box = (await popup(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(16)
  expect(360 - (box.x + box.width)).toBeGreaterThanOrEqual(16)
  expect(box.height).toBeLessThanOrEqual(800)
  expect(box.y).toBeGreaterThanOrEqual(0)
  // The buttons stay in view whatever the entries' length.
  await expect(popup(page).getByRole('button', { name: 'Alles klar' })).toBeInViewport()
})
