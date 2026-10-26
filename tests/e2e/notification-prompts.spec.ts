import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { TOUR_VERSION } from '../../app/tour/tour'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers, setPromptTimes, setSeen } from './seed'

// Notification Prompts (CONTEXT.md, #407): Topfbert's card at the bottom of
// the Board offers the Email Digest (Push Notifications need the installed
// app, which a browser test can't be: the rule's client tests cover it). In
// every other spec it never shows by itself; here the pages turn that on.
// The users below are used by this file only, and start each test new, two
// days old, with the Tour and the Version seen.
const HOPPER = ALLOWLISTED[168]
const LOVELACE = ALLOWLISTED[169]

// More than the Board waits before it shows a prompt or a popup.
const SETTLE_MS = 2500

test.beforeEach(async ({ page }) => {
  await removeUsers(HOPPER, LOVELACE)
  await page.addInitScript(() => {
    (window as { e2eNotificationPrompt?: boolean }).e2eNotificationPrompt = true
  })
})

async function ready(page: Page, email: string) {
  await signIn(page, email)
  await setSeen(email, { tourSeen: TOUR_VERSION })
  await setPromptTimes(email, { createdDaysAgo: 2 })
}

const card = (page: Page) => page.getByRole('region', { name: 'Die tägliche E-Mail einschalten?' })
const digestOn = async (page: Page) => (await (await page.request.get('/api/me/email-digest')).json() as { on: boolean }).on

test('"Einschalten" switches the Email Digest on, as the switch in Your Settings', async ({ page }) => {
  await ready(page, HOPPER)
  await gotoHydrated(page, '/')

  await expect(card(page)).toBeVisible()
  await card(page).getByRole('button', { name: 'Einschalten' }).click()

  await expect(card(page)).toBeHidden()
  await expect(page.getByText('Die tägliche E-Mail ist an.')).toBeVisible()
  expect(await digestOn(page)).toBe(true)
  const me = await (await page.request.get('/api/me')).json() as { digestPromptedAt: string | null, pushPromptedAt: string | null }
  expect(me.digestPromptedAt).not.toBeNull()
  expect(me.pushPromptedAt).toBeNull()
})

test('"Später" closes it, and a reload the same day shows nothing', async ({ page }) => {
  await ready(page, HOPPER)
  await gotoHydrated(page, '/')
  await expect(card(page)).toBeVisible()

  await card(page).getByRole('button', { name: 'Später' }).click()

  await expect(card(page)).toBeHidden()
  expect(await digestOn(page)).toBe(false)
  await reloadHydrated(page)
  await page.waitForTimeout(SETTLE_MS)
  await expect(card(page)).toBeHidden()
})

test('in a visit with the Changelog Popup there is no prompt, during it or after it', async ({ page }) => {
  await page.addInitScript(() => {
    (window as { e2eChangelogPopup?: boolean }).e2eChangelogPopup = true
  })
  await ready(page, LOVELACE)
  await setSeen(LOVELACE, { version: '0.9.0' })
  await gotoHydrated(page, '/')
  const popup = page.getByRole('dialog', { name: 'Was ist neu' })
  await expect(popup).toBeVisible()
  await expect(card(page)).toBeHidden()

  await popup.getByRole('button', { name: 'Alles klar' }).click()

  await expect(popup).toBeHidden()
  await page.waitForTimeout(SETTLE_MS)
  await expect(card(page)).toBeHidden()
})

test('on a 360px phone the card keeps 12px from the edges and leaves the header free', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await ready(page, HOPPER)
  await gotoHydrated(page, '/')
  await expect(card(page)).toBeVisible()

  const box = (await card(page).boundingBox())!
  expect(box.x).toBeGreaterThanOrEqual(12 - 0.5)
  expect(360 - (box.x + box.width)).toBeGreaterThanOrEqual(12 - 0.5)
  expect(800 - (box.y + box.height)).toBeGreaterThanOrEqual(12 - 0.5)
  const header = (await page.locator('header').first().boundingBox())!
  expect(box.y).toBeGreaterThan(header.y + header.height)
})
