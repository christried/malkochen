import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'

// The Caption under a Dish's title (PRD stories 44–45, 50, #393): folded to a
// few lines with "mehr", unfolded with "weniger", plain text, and nothing in
// its place for a Dish without one. Church's Board is used by this file only.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const LONG_CAPTION = [
  'Kichererbsen-Curry mit Spinat.',
  'Zwiebel und Knoblauch anbraten.',
  'Kichererbsen dazugeben und mit Kokosmilch aufgießen.',
  'Zehn Minuten köcheln lassen, mit Salz und Limette abschmecken.',
  'Dazu Reis oder Fladenbrot, ganz nach Lust.',
  'Viel Spaß beim Kochen!',
].join('\n')

async function openDetail(page: Page, title: string) {
  await page.getByRole('link', { name: title }).click()
  const detail = page.getByRole('dialog', { name: title })
  await expect(detail).toBeVisible()
  return detail
}

// Whether the folded text is cut short: it has more content than its box shows.
function isCut(caption: Locator) {
  return caption.evaluate((el) => {
    const element = el as HTMLElement
    return element.scrollHeight > element.clientHeight + 1
  })
}

test('a long Caption is folded with "mehr", unfolds with "weniger", and nothing shows without one', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[134])
  await resetBoard(page)
  await seedDish(page, { title: 'Kichererbsen-Curry', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1, caption: LONG_CAPTION })
  await seedDish(page, { title: 'Linsen-Dal', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: /^Diese Woche/ }).click()

  const detail = await openDetail(page, 'Kichererbsen-Curry')
  const caption = detail.locator('[data-caption] p')
  // Plain text, line breaks kept.
  expect(await caption.textContent()).toBe(LONG_CAPTION)
  // Folded: cut short, with "mehr" to unfold it.
  expect(await isCut(caption)).toBe(true)
  await expect(detail.getByRole('button', { name: 'mehr' })).toBeVisible()

  await detail.getByRole('button', { name: 'mehr' }).click()
  // Unfolded: the whole Caption is shown, and "weniger" folds it again.
  expect(await isCut(caption)).toBe(false)
  await expect(detail.getByRole('button', { name: 'weniger' })).toBeVisible()
  await detail.getByRole('button', { name: 'weniger' }).click()
  expect(await isCut(caption)).toBe(true)

  // Links in a Caption are plain text, not links.
  await expect(detail.locator('[data-caption] a')).toHaveCount(0)

  // A Dish without a Caption has no block in its place.
  await detail.getByRole('button', { name: 'Schließen' }).click()
  const plain = await openDetail(page, 'Linsen-Dal')
  await expect(plain.locator('[data-caption]')).toHaveCount(0)
})
