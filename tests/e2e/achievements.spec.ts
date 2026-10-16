import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { backgroundsBehind, playing } from './clips'
import { gotoHydrated, reloadHydrated } from './hydration'
import { resetBoard, seedCookings, seedDish } from './seed'

// Celebrating repeat cooking (issue #25): the achievement badge in the Dish
// detail, levelled by its Cookings, and the full-screen celebration of a
// Dish's 10th Cooking (milestone-10x); and celebrating a new Board
// (board-created). All Columns side by side (desktop). Both celebrations are
// drawn in code (#215): played once, then resting on their last frame, with
// nothing behind them but the wash.
// Hertha's Board is used by this file only.
test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const HERTHA = ALLOWLISTED[21]

async function openDetail(page: Page, title: string) {
  await page.getByRole('link', { name: title }).click()
  return page.getByRole('dialog', { name: title })
}

function badge(scope: Page | ReturnType<Page['getByRole']>) {
  return scope.getByTestId('achievement-badge')
}

test('the badge shows the level for the Dish\'s Cookings, with pips toward the next', async ({ page }) => {
  await signIn(page, HERTHA)
  await resetBoard(page)
  const levels = [
    { title: 'Linsensuppe', cookings: 1, name: 'Ausprobiert: 1× gekocht, noch 2× bis Wird Liebling', pips: 2, filled: 0 },
    { title: 'Chana Masala', cookings: 2, name: 'Ausprobiert: 2× gekocht, noch 1× bis Wird Liebling', pips: 2, filled: 1 },
    { title: 'Pad Thai', cookings: 3, name: 'Wird Liebling: 3× gekocht, noch 2× bis Stammgericht', pips: 2, filled: 0 },
    { title: 'Dal', cookings: 7, name: 'Stammgericht: 7× gekocht, noch 3× bis Klassiker', pips: 5, filled: 2 },
    { title: 'Ramen', cookings: 12, name: 'Klassiker: 12× gekocht', pips: 0, filled: 0 },
  ]
  for (const { title, cookings } of [...levels, { title: 'Tofu', cookings: 0 }]) {
    await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', column: 2 })
    await seedCookings(page, title, cookings)
  }
  await gotoHydrated(page, '/')

  for (const { title, name, pips, filled } of levels) {
    const detail = await openDetail(page, title)
    await expect(badge(detail)).toHaveAccessibleName(name)
    await expect(badge(detail).locator('[data-pip]')).toHaveCount(pips)
    await expect(badge(detail).locator('[data-pip][data-filled]')).toHaveCount(filled)
    await detail.getByRole('button', { name: 'Schließen' }).click()
    await expect(detail).toBeHidden()
  }

  // Never cooked: no badge.
  const detail = await openDetail(page, 'Tofu')
  await expect(detail.locator('[data-cooking-summary]')).toHaveText('Noch nie gekocht.')
  await expect(badge(detail)).toHaveCount(0)
})

test('deleting a Cooking lowers the level; cooking again raises it', async ({ page }) => {
  await signIn(page, HERTHA)
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Pad Thai')
  await expect(badge(detail)).toHaveAccessibleName('Wird Liebling: 3× gekocht, noch 2× bis Stammgericht')

  await detail.locator('[data-cooking]').first().getByRole('button', { name: /löschen$/ }).click()

  await expect(badge(detail)).toHaveAccessibleName('Ausprobiert: 2× gekocht, noch 1× bis Wird Liebling')
  await expect(badge(detail).locator('[data-pip][data-filled]')).toHaveCount(1)

  await detail.getByRole('button', { name: 'Gekocht ✓' }).click()

  await expect(badge(detail)).toHaveAccessibleName('Wird Liebling: 3× gekocht, noch 2× bis Stammgericht')
  await expect(badge(detail).getByText('3×')).toBeVisible()
})

function milestone(page: Page) {
  return page.getByRole('dialog', { name: 'Klassiker!' })
}

// A celebration's clip plays its drawing once, not a video, with nothing
// behind it but the celebration's wash; then it rests on its last frame.
async function expectPlayedOnce(celebration: Locator, clip: string, theme: 'light' | 'dark' = 'light') {
  const drawn = celebration.locator(`[data-svg-loop][data-clip="/clips/${clip}"]`)
  await expect(drawn).toBeVisible()
  await expect(celebration.locator('video')).toHaveCount(0)
  // Seen playing: polls are at most 1s apart, the clips 1.2s and 1.8s long.
  await expect.poll(() => playing(celebration, `/clips/${clip}`)).toEqual([`/clips/${clip}-${theme}.svg`])
  expect(await backgroundsBehind(drawn, 'dialog')).toEqual([])
  // Played through, it stays up, resting.
  await expect.poll(() => drawn.evaluate((el) => {
    const animations = el.getAnimations({ subtree: true })
    return animations.length > 0 && animations.every(a => a.playState === 'finished')
  })).toBe(true)
  await expect(drawn.locator('[data-loop-svg]')).toBeVisible()
}

test('the 10th Cooking celebrates once; its toast stays on top, and undo there ends it; cooking again doesn’t replay it', async ({ page }) => {
  await signIn(page, HERTHA)
  await seedDish(page, { title: 'Chili sin Carne', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, 'Chili sin Carne', 9)
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gekocht ✓: „Chili sin Carne“' }).click()

  await expect(milestone(page)).toBeVisible()
  await expect(milestone(page)).toContainText('Chili sin Carne ist jetzt ein Klassiker: 10× gekocht.')
  await expectPlayedOnce(milestone(page), 'milestone-10x')
  await expect(milestone(page).getByTestId('celebration-label')).toHaveText('10×')
  // Played through, the pebble with "10×" keeps a gentle pulse (#280).
  await expect.poll(() => milestone(page).locator('[data-idle-pulse]').evaluate(el => el.getAnimations()
    .some(a => a.playState === 'running' && a.effect?.getComputedTiming().iterations === Infinity))).toBe(true)
  // The Gekocht toast shows over it, with its undo.
  await milestone(page).getByRole('status').getByRole('button', { name: 'Rückgängig' }).click()

  await expect(milestone(page)).toBeHidden()
  await expect(page.getByText('10× gekocht')).toBeHidden()
  await page.getByRole('button', { name: 'Gekocht ✓: „Chili sin Carne“' }).click()
  await expect(page.getByText('10× gekocht')).toBeVisible()
  // Where it would have come by now.
  await page.waitForTimeout(2000)
  await expect(milestone(page)).toHaveCount(0)
})

// It stays 6.8s (#280): still up well past the old 3.4s, gone by itself
// after, and the Gekocht toast's countdown, paused meanwhile, runs on.
test('the celebration goes by itself after 6.8s, and the Gekocht toast stays after it', async ({ page }) => {
  await signIn(page, HERTHA)
  await seedDish(page, { title: 'Bohnensalat', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, 'Bohnensalat', 9)
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gekocht ✓: „Bohnensalat“' }).click()

  await expect(milestone(page)).toBeVisible()
  await page.waitForTimeout(5000)
  await expect(milestone(page)).toBeVisible()
  await expect(milestone(page)).toBeHidden({ timeout: 4000 })
  await expect(page.getByRole('status').getByRole('button', { name: 'Rückgängig' })).toBeVisible()
})

// "Überspringen", Escape and a tap anywhere each close it, and every way
// leaves "Rückgängig" offered, its countdown running on (#229, #280).
test('"Überspringen", Escape and a tap anywhere close the celebration; "Rückgängig" stays after each', async ({ page }) => {
  await signIn(page, HERTHA)
  const titles = ['Hummus', 'Tabouleh', 'Baba Ganoush']
  for (const title of titles) {
    await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
    await seedCookings(page, title, 9)
  }
  await gotoHydrated(page, '/')
  const closings: ((celebration: Locator) => Promise<void>)[] = [
    celebration => celebration.getByRole('button', { name: 'Überspringen' }).click(),
    () => page.keyboard.press('Escape'),
    () => page.mouse.click(24, 400),
  ]

  for (const [i, title] of titles.entries()) {
    await page.getByRole('button', { name: `Gekocht ✓: „${title}“` }).click()
    await expect(milestone(page)).toBeVisible()
    await closings[i]!(milestone(page))
    await expect(milestone(page)).toBeHidden()
    await expect(page.getByRole('status').getByRole('button', { name: 'Rückgängig' })).toBeVisible()
  }
})

// The undo countdown waits while the celebration shows, and runs on once it
// closes (#229): recorded after 2.5s, the celebration closes about 10s after
// the click, past the 5s undo window, yet "Rückgängig" is still offered, and
// then goes with the rest of its window.
test('with a slow server, "Rückgängig" is still there after the celebration', async ({ page }) => {
  await signIn(page, HERTHA)
  await seedDish(page, { title: 'Shakshuka', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, 'Shakshuka', 9)
  await gotoHydrated(page, '/')
  await page.route('**/api/dishes/*/cook', async (route) => {
    await new Promise(resolve => setTimeout(resolve, 2500))
    await route.fallback()
  })

  await page.getByRole('button', { name: 'Gekocht ✓: „Shakshuka“' }).click()

  await expect(milestone(page)).toBeVisible({ timeout: 6000 })
  await expect(milestone(page)).toBeHidden({ timeout: 9000 })
  const undo = page.getByRole('status').getByRole('button', { name: 'Rückgängig' })
  await expect(undo).toBeVisible()
  await expect(undo).toBeHidden({ timeout: 5000 })
  await page.unroute('**/api/dishes/*/cook')
})

test('a 10th Cooking the server refuses doesn’t celebrate', async ({ page }) => {
  await signIn(page, HERTHA)
  await seedDish(page, { title: 'Falafel', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, 'Falafel', 9)
  await gotoHydrated(page, '/')
  await page.route('**/api/dishes/*/cook', route => route.fulfill({ status: 500 }))

  await page.getByRole('button', { name: 'Gekocht ✓: „Falafel“' }).click()

  await expect(page.getByRole('status')).toContainText('Falafel')
  await page.waitForTimeout(2000)
  await expect(milestone(page)).toHaveCount(0)
  await page.unroute('**/api/dishes/*/cook')
})

test('the 10th Cooking from the Dish detail celebrates over it; closing returns to it', async ({ page }) => {
  await signIn(page, HERTHA)
  await seedDish(page, { title: 'Gemüsecurry', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, 'Gemüsecurry', 9)
  await gotoHydrated(page, '/')
  const detail = await openDetail(page, 'Gemüsecurry')

  await detail.getByRole('button', { name: 'Gekocht ✓' }).click()

  await expect(milestone(page)).toBeVisible()
  await milestone(page).getByRole('button', { name: 'Überspringen' }).click()
  await expect(milestone(page)).toBeHidden()
  await expect(detail).toBeVisible()
  await expect(badge(detail)).toHaveAccessibleName('Klassiker: 10× gekocht')
})

test('a new Board celebrates with its emoji; "Los geht’s" goes to it', async ({ page }) => {
  await signIn(page, HERTHA)
  await gotoHydrated(page, '/')

  await page.getByRole('heading', { level: 1 }).getByRole('button').click()
  await page.getByRole('navigation', { name: 'Deine Boards' }).getByRole('button', { name: 'Neues Board' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neues Board' })
  await sheet.getByLabel('Name').fill('Kochclub')
  await sheet.getByRole('radio', { name: '🥟' }).click()
  await sheet.getByRole('button', { name: 'Board erstellen' }).click()

  const celebration = page.getByRole('dialog', { name: '🥟 Kochclub ist bereit' })
  await expect(celebration).toBeVisible()
  await expect(celebration.getByTestId('celebration-label')).toHaveText('🥟')
  await expectPlayedOnce(celebration, 'board-created')
  // Its Columns build in.
  await expect(celebration.locator('[data-board-created-column]')).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
  await celebration.getByRole('button', { name: 'Los geht’s' }).click()

  await expect(celebration).toBeHidden()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🥟 Kochclub')
  // Only right after creating it.
  await reloadHydrated(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🥟 Kochclub')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('on a phone in dark, both celebrations play their drawings with nothing behind them', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 860 })
  await page.emulateMedia({ colorScheme: 'dark' })
  await signIn(page, HERTHA)
  await seedDish(page, { title: 'Tofu Scramble', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, 'Tofu Scramble', 9)
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gekocht ✓: „Tofu Scramble“' }).click()
  await expectPlayedOnce(milestone(page), 'milestone-10x', 'dark')
  await milestone(page).getByRole('button', { name: 'Überspringen' }).click()
  await expect(milestone(page)).toBeHidden()

  await page.getByRole('heading', { level: 1 }).getByRole('button').click()
  await page.getByRole('navigation', { name: 'Deine Boards' }).getByRole('button', { name: 'Neues Board' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neues Board' })
  await sheet.getByLabel('Name').fill('Abendbrot')
  await sheet.getByRole('button', { name: 'Board erstellen' }).click()
  await expectPlayedOnce(page.getByRole('dialog', { name: /Abendbrot ist bereit/ }), 'board-created', 'dark')
})
