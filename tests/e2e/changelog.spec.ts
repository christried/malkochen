import { readFileSync } from 'node:fs'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { TEST_VERSION } from '../support/test-version'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { openUserSettings } from './settings-sheet'

// The Changelog (CONTEXT.md, #354): "Was ist neu", readable without signing
// in and linked from the sign-in screen; at the end of Your Settings, marked
// "Neu" until the app's Version (TEST_VERSION here) has been opened there.
// Babbage is used by this file only.
const BABBAGE = ALLOWLISTED[130]

// The newest Version, which the page reads from the files (package.json's
// matches it: tests/client/changelog.test.ts).
const { version: NEWEST } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }

test('signed out, the sign-in screen links to the Changelog, which opens without signing in', async ({ page }) => {
  await gotoHydrated(page, '/login')

  await page.getByRole('link', { name: 'Was ist neu' }).click()

  await expect(page).toHaveURL('/changelog')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was ist neu')
  // The newest Version, its sections in German.
  await expect(page.getByRole('heading', { level: 2, name: `Version ${NEWEST}` })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Hinzugefügt' }).first()).toBeVisible()

  await reloadHydrated(page)
  await expect(page).toHaveURL('/changelog')
})

test('"Was ist neu" ends Your Settings with the Version, marked "Neu" until the Changelog has been opened', async ({ page }) => {
  await signIn(page, BABBAGE, { name: 'Charles Babbage' })

  const sheet = await openUserSettings(page)
  const link = sheet.getByRole('link', { name: /^Was ist neu/ })
  await expect(link.getByText('Neu', { exact: true })).toBeVisible()
  await expect(link).toContainText(`Du nutzt malkochen ${TEST_VERSION}.`)
  await link.click()

  await expect(page).toHaveURL('/changelog')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Was ist neu')
  await expect.poll(async () => (await (await page.request.get('/api/me')).json() as { newVersion: boolean }).newVersion).toBe(false)

  // Gone from Your Settings, for good.
  const again = await openUserSettings(page)
  const linkAgain = again.getByRole('link', { name: /^Was ist neu/ })
  await expect(linkAgain).toContainText(`Du nutzt malkochen ${TEST_VERSION}.`)
  await expect(linkAgain.getByText('Neu', { exact: true })).toHaveCount(0)
})

// The page's layout (#405, decided on #392 as B): a card per Version, the
// newest marked, a button copying a Version's link and, on desktop, a rail.
// A Version's card (an attribute selector: the number has dots).
function card(page: Page, version: string) {
  return page.locator(`[id="changelog-${version}"]`)
}

// The Version cards' numbers, newest first.
async function cardVersions(page: Page) {
  const ids = await page.locator('main section[id^="changelog-"]').evaluateAll(cards => cards.map(card => card.id))
  return ids.filter(id => id !== 'changelog-unreleased').map(id => id.replace('changelog-', ''))
}

test('on desktop a rail lists the Versions, follows the one in view and takes you to another', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, '/changelog')
  const versions = await cardVersions(page)
  expect(versions[0]).toBe(NEWEST)

  const rail = page.getByRole('navigation', { name: 'Versionen' })
  const links = rail.getByRole('link').filter({ hasNotText: 'Gerade neu' })
  await expect(links).toHaveCount(versions.length)
  expect(await links.evaluateAll(all => all.map(a => a.getAttribute('href')))).toEqual(versions.map(v => `#changelog-${v}`))
  // Before any scroll, the first entry is the current one.
  await expect(rail.getByRole('link').first()).toHaveAttribute('aria-current', 'true')
  await expect(rail.locator('[aria-current]')).toHaveCount(1)

  // The last Version's card is further down (the second, once there is one).
  const target = versions.at(-1)!
  await rail.locator(`a[href="#changelog-${target}"]`).click()
  await expect(card(page, target)).toBeInViewport()
  await expect(rail.locator(`a[href="#changelog-${target}"]`)).toHaveAttribute('aria-current', 'true')
  await expect(rail.locator('[aria-current]')).toHaveCount(1)
  await expect(page).toHaveURL(`/changelog#changelog-${target}`)
})

test('the newest Version alone is marked "Neueste", and a Version\'s card heading still names it', async ({ page }) => {
  await gotoHydrated(page, '/changelog')

  await expect(page.getByText('Neueste', { exact: true })).toHaveCount(1)
  await expect(card(page, NEWEST).getByText('Neueste', { exact: true })).toBeVisible()
  await expect(card(page, NEWEST)).toHaveAccessibleName(`Version ${NEWEST}`)
})

test('a Version\'s link button copies its address, which opens the page at that card', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await gotoHydrated(page, '/changelog')
  const versions = await cardVersions(page)

  await card(page, NEWEST).getByRole('button', { name: `Link zu Version ${NEWEST} kopieren` }).click()

  await expect(page.getByRole('status')).toHaveText('Link kopiert')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(`${E2E_ORIGIN}/changelog#changelog-${NEWEST}`)

  // Opened at a card further down, the page is scrolled to it.
  const target = versions.at(-1)!
  await gotoHydrated(page, `/changelog#changelog-${target}`)
  await expect(card(page, target)).toBeInViewport()
  await expect(page.getByRole('navigation', { name: 'Versionen' }).locator(`a[href="#changelog-${target}"]`)).toHaveAttribute('aria-current', 'true')
})

test('on a phone the rail is left out and the cards are shown', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await gotoHydrated(page, '/changelog')

  await expect(page.getByRole('navigation', { name: 'Versionen' })).toBeHidden()
  await expect(card(page, NEWEST)).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360)
})
