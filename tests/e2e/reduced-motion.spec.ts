import { expect, test } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { confetti, topfbert } from './celebration'
import { clipStill, countVideos } from './clips'
import { gotoHydrated } from './hydration'
import { resetBoard, seedCookings, seedDish } from './seed'
import { stubSourceLookup } from './source-lookup-stub'

// With reduced motion (PRD story 84): the main flows still work, every motion
// graphic shows its still, and no clip ever plays, or even loads. Lise's
// Board is used by this file only.
test.use({ reducedMotion: 'reduce' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const LISE = ALLOWLISTED[20]

test('signing in, adding a Dish from a link, cooking it and searching show stills only', async ({ page }) => {
  const videos = await countVideos(page)

  await gotoHydrated(page, '/login')
  await expect(clipStill(page, 'topfbert-wow')).toBeVisible()
  await expect(page.locator('img[src="/placeholders/pasta-light.svg"]')).toBeVisible()
  // The ring around Topfbert stays where it is.
  expect(await page.getByTestId('hero-ring').evaluate(el => getComputedStyle(el).rotate)).toBe('none')

  await signIn(page, LISE)
  await resetBoard(page)
  let answer!: () => void
  await stubSourceLookup(page, { kind: 'tiktok', canonicalLink: TIKTOK, suggestedTitle: 'Crispy Tofu Bowl', imageUrl: null, imageTicket: null }, new Promise(r => answer = r))
  await gotoHydrated(page, '/')
  await expect(clipStill(page, 'empty-board')).toBeVisible()
  await expect(clipStill(page, 'empty-column').first()).toBeVisible()

  // Add a Dish from a link: the lookup shows Topfbert's still.
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await sheet.getByLabel('Link').fill(TIKTOK)
  await expect(clipStill(sheet, 'lookup-stir')).toBeVisible()
  answer()
  await expect(sheet.getByLabel('Titel')).toHaveValue('Crispy Tofu Bowl')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(sheet).toBeHidden()

  // The Dish is on the Board; in its detail, never cooked, then cooked.
  await page.getByRole('link', { name: 'Crispy Tofu Bowl' }).click()
  const detail = page.getByRole('dialog', { name: 'Crispy Tofu Bowl' })
  const history = detail.getByRole('region', { name: 'Gekocht' })
  await expect(clipStill(history, 'never-cooked')).toBeVisible()
  await history.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(history.locator('[data-cooking]')).toHaveCount(1)
  // The celebration: Topfbert's still behind the toast, and no confetti.
  await expect(topfbert(detail).locator('img[src="/illustrations/topfbert-happy.svg"]')).toBeVisible()
  await expect(topfbert(detail)).toContainText('Mmh!')
  expect(await confetti(page).count()).toBe(0)
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()

  // A search that finds nothing.
  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('Pizza')
  await expect(clipStill(page.getByTestId('search-results'), 'search-empty')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).press('Escape')

  // A link whose lookup fails.
  await stubSourceLookup(page, 'fail')
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await sheet.getByLabel('Link').fill(`${TIKTOK}?kaputt`)
  await expect(clipStill(sheet, 'lookup-failed')).toBeVisible()

  // Whatever would load a clip has had its chance.
  await page.waitForLoadState('networkidle')
  expect(await videos()).toBe(0)
})

test('Not unlocked, the invite landing and the error screen show stills only', async ({ page }) => {
  const videos = await countVideos(page)

  await gotoHydrated(page, '/login?error=not_allowed')
  await expect(clipStill(page, 'not-unlocked')).toBeVisible()

  await signIn(page, LISE)
  const { id: boardId } = await (await page.request.post('/api/boards', { data: { name: 'Ruhig', emoji: '🌿' } })).json() as { id: string }
  await gotoHydrated(page, `/b/${boardId}/settings`)
  const link = await page.getByLabel('Einladungslink').inputValue()
  await page.context().clearCookies()
  await gotoHydrated(page, link)
  // The intro's still is the loop's first frame.
  await expect(page.locator('[data-invite-clip] img[src="/clips/invite-loop-light.png"]')).toBeVisible()
  await expect(page.getByTestId('invite-emoji')).toHaveText('🌿')

  await signIn(page, LISE)
  await gotoHydrated(page, '/b/00000000-0000-4000-8000-000000000000')
  await expect(clipStill(page, 'error')).toBeVisible()

  await page.waitForLoadState('networkidle')
  expect(await videos()).toBe(0)
})

test('the achievement badge shows its count at once; both celebrations show their stills and stay until closed', async ({ page }) => {
  const videos = await countVideos(page)
  await signIn(page, LISE)
  await resetBoard(page)
  await seedDish(page, { title: 'Ramen', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, 'Ramen', 8)
  await gotoHydrated(page, '/')

  // No count-up: the final number as the detail opens, and after cooking.
  await page.getByRole('link', { name: 'Ramen' }).click()
  const detail = page.getByRole('dialog', { name: 'Ramen' })
  const badge = detail.getByTestId('achievement-badge')
  await expect(badge).toBeVisible()
  expect(await badge.innerText()).toContain('8×')
  await detail.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(badge).toHaveAccessibleName('Stammgericht: 9× gekocht, noch 1× bis Klassiker')
  expect(await badge.innerText()).toContain('9×')
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()

  // The 10th Cooking: the milestone's still, until it is closed.
  await page.getByRole('region', { name: 'Gekocht' }).getByRole('button', { name: 'Gekocht ✓: „Ramen“' }).click()
  const milestone = page.getByRole('dialog', { name: 'Klassiker!' })
  await expect(clipStill(milestone, 'milestone-10x')).toBeVisible()
  await page.waitForTimeout(4000)
  await expect(milestone).toBeVisible()
  await milestone.getByRole('button', { name: 'Schließen' }).click()
  await expect(milestone).toBeHidden()

  // A new Board: its still, with the emoji resting on the pebble.
  await page.getByRole('heading', { level: 1 }).getByRole('button').click()
  await page.getByRole('navigation', { name: 'Deine Boards' }).getByRole('button', { name: 'Neues Board' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neues Board' })
  await sheet.getByLabel('Name').fill('Leise')
  await sheet.getByRole('button', { name: 'Board erstellen' }).click()
  const created = page.getByRole('dialog', { name: '🍜 Leise ist bereit' })
  await expect(clipStill(created, 'board-created')).toBeVisible()
  await expect(created.getByTestId('board-created-emoji')).toBeVisible()
  await created.getByRole('button', { name: 'Los geht’s' }).click()
  await expect(created).toBeHidden()

  await page.waitForLoadState('networkidle')
  expect(await videos()).toBe(0)
})
