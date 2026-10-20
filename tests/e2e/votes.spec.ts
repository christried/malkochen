import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId, removeUsers, seedDish } from './seed'

// Votes (#334): "Wie war's?" with 👍 👎 in the Gekocht toast, which a thumb
// keeps open, and under the Verlauf's heading in the Dish detail, where
// each Member's Vote shows as an entry. How the toast fits a phone is in
// cooking.spec.ts. Cori's Board is used by this file only; Mitchell joins
// it.
test.describe.configure({ mode: 'serial' })

const CORI = ALLOWLISTED[91]
const MITCHELL = ALLOWLISTED[92]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// CI's retry runs the whole file again, on the same database.
test.beforeAll(() => removeUsers(CORI, MITCHELL))

function gekochtToast(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Gekocht ✓' }).locator('[data-toast]')
}

const thumb = (within: Locator, up: boolean) => within.getByRole('button', { name: up ? 'Daumen hoch' : 'Daumen runter' })

async function openDish(page: Page, title: string) {
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: title }).click()
  const history = page.getByRole('dialog', { name: title }).locator('[data-dish-history]')
  return { history, howWasIt: history.locator('[data-how-was-it]'), votes: history.locator('[data-vote-entry]') }
}

test('a Vote from the Gekocht toast keeps it open and can be changed there, on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await signIn(page, CORI)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Shakshuka', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: CORI })
  await reloadHydrated(page)

  await page.getByRole('button', { name: 'Gekocht ✓: „Shakshuka“' }).click()
  const toast = gekochtToast(page)
  await expect(toast).toContainText('Wie war’s?')
  await thumb(toast, true).click()
  await expect(thumb(toast, true)).toHaveAttribute('aria-pressed', 'true')
  await thumb(toast, false).click()

  await expect(thumb(toast, false)).toHaveAttribute('aria-pressed', 'true')
  await expect(thumb(toast, true)).toHaveAttribute('aria-pressed', 'false')
  // The add button stays clear of the taller toast.
  const fab = (await page.getByRole('button', { name: 'Gericht hinzufügen' }).boundingBox())!
  expect(fab.y + fab.height).toBeLessThanOrEqual((await toast.boundingBox())!.y)

  // All Columns side by side, to open it from the Gekocht Column.
  await page.setViewportSize({ width: 1280, height: 800 })
  const { howWasIt, votes } = await openDish(page, 'Shakshuka')
  await expect(thumb(howWasIt, false)).toHaveAttribute('aria-pressed', 'true')
  await expect(votes).toHaveText([/fand es nicht so gut/])
})

test('in the Dish detail the Member changes their Vote and takes it back; each Member\'s Vote shows in the Verlauf', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, CORI)
  const { howWasIt, votes } = await openDish(page, 'Shakshuka')

  await thumb(howWasIt, true).click()

  await expect(thumb(howWasIt, true)).toHaveAttribute('aria-pressed', 'true')
  await expect(votes).toHaveText([/fand es gut/])
  await expect(votes.first()).toHaveAttribute('data-vote-entry', 'up')

  const token = await inviteToken(page, await landingBoardId(page))
  const other = await newTab(browser)
  await signIn(other, MITCHELL)
  const joined = await other.request.post(`/api/invites/${token}/join`, { headers: { origin: E2E_ORIGIN } })
  expect(joined.ok()).toBe(true)
  const theirs = await openDish(other, 'Shakshuka')
  await expect(thumb(theirs.howWasIt, true)).toHaveAttribute('aria-pressed', 'false')
  await thumb(theirs.howWasIt, false).click()
  await expect(theirs.votes).toHaveCount(2)
  await other.close()

  await reloadHydrated(page)
  await expect(votes).toHaveCount(2)
  await expect(votes.nth(1)).toHaveText(/fand es nicht so gut/)
  // Picking the filled thumb again takes the Vote back.
  await thumb(howWasIt, true).click()
  await expect(thumb(howWasIt, true)).toHaveAttribute('aria-pressed', 'false')
  await expect(votes).toHaveCount(1)
  await reloadHydrated(page)
  await expect(votes).toHaveCount(1)
})

test('a Dish never Cooked has no "Wie war\'s?"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await signIn(page, CORI)
  await seedDish(page, { title: 'Bircher Müsli', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  const { history, howWasIt } = await openDish(page, 'Bircher Müsli')

  await expect(history.getByRole('heading', { name: 'Verlauf' })).toBeVisible()
  await expect(howWasIt).toHaveCount(0)
})
