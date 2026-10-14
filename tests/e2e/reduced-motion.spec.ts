import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { ANY_CHEER, cheer, confetti, topfbert } from './celebration'
import { clipStill, countClips, emptyColumnStill, loopStill, moving, neverCookedClip } from './clips'
import { editMorph, slowAnimations } from './edit-morph'
import { gotoHydrated } from './hydration'
import { dotsMoving, holdRequests, linkField, linkFound } from './loading'
import { resetBoard, seedCookings, seedDish } from './seed'
import { stubSourceLookup } from './source-lookup-stub'

// With reduced motion (PRD story 84): the main flows still work, every motion
// graphic shows its still, and no clip ever plays, or even loads. Lise's
// Board is used by this file only.
test.use({ reducedMotion: 'reduce' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const LISE = ALLOWLISTED[20]

test('signing in, adding a Dish from a link, cooking it and searching show stills only', async ({ page }) => {
  const clips = await countClips(page)

  await gotoHydrated(page, '/login')
  await expect(loopStill(page, '/clips/topfbert-wow')).toBeVisible()
  await expect(page.locator('img[src="/placeholders/pasta-light.svg"]')).toBeVisible()
  // The ring around Topfbert stays where it is.
  expect(await page.getByTestId('hero-ring').evaluate(el => getComputedStyle(el).rotate)).toBe('none')

  await signIn(page, LISE)
  await resetBoard(page)
  let answer!: () => void
  await stubSourceLookup(page, { kind: 'tiktok', canonicalLink: TIKTOK, suggestedTitle: 'Crispy Tofu Bowl', imageUrl: null, imageTicket: null }, new Promise(r => answer = r))
  await gotoHydrated(page, '/')
  await expect(loopStill(page, '/clips/empty-board')).toBeVisible()
  await expect(emptyColumnStill(column(page, 'Diese Woche'))).toBeVisible()

  // Add a Dish from a link: the lookup shows Topfbert's still.
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await sheet.getByLabel('Link').fill(TIKTOK)
  await expect(loopStill(sheet, '/clips/lookup-stir', null)).toBeVisible()
  // The link field's dots stand still; its sage border and check simply appear.
  const field = linkField(sheet)
  await expect.poll(() => dotsMoving(field)).toBe(false)
  await expect(field.locator('xpath=../fieldset')).toHaveCSS('transition-duration', '0s')
  answer()
  await expect(linkFound(sheet)).toBeVisible()
  // The found title doesn't type in: it is all there with the check.
  expect(await sheet.getByLabel('Titel').inputValue()).toBe('Crispy Tofu Bowl')
  // Saving: the button's dots stand still too.
  const release = await holdRequests(page, 'POST', /\/api\/boards\/[^/]+\/dishes$/)
  const save = sheet.locator('button[type="submit"]')
  await save.click()
  await expect.poll(() => dotsMoving(save)).toBe(false)
  release()
  await expect(sheet).toBeHidden()

  // The Dish is on the Board; in its detail, never cooked, then cooked.
  const card = page.getByRole('link', { name: 'Crispy Tofu Bowl' })
  const neverCooked = await neverCookedClip(card)
  await card.click()
  const detail = page.getByRole('dialog', { name: 'Crispy Tofu Bowl' })
  // Into edit mode and back, the fields swap with a 150ms fade and don't move.
  const normalSpeed = await slowAnimations(page)
  for (const button of ['Bearbeiten', 'Abbrechen']) {
    await detail.getByRole('button', { name: button }).click()
    const morph = await editMorph(detail)
    expect(morph.length).toBeGreaterThan(3)
    for (const field of morph) expect(field).toMatchObject({ delay: 0, duration: 150, moves: false })
  }
  await normalSpeed()
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toBeFocused()
  const history = detail.getByRole('region', { name: 'Gekocht' })
  await expect(loopStill(history, neverCooked)).toBeVisible()
  await history.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(history.locator('[data-cooking]')).toHaveCount(1)
  // The celebration: Topfbert's still in the Gekocht pill, and no confetti.
  await expect(topfbert(detail).locator('img[src="/illustrations/topfbert-happy.svg"]')).toBeVisible()
  await expect(cheer(detail)).toHaveText(ANY_CHEER)
  expect(await confetti(page).count()).toBe(0)
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()

  // A search that finds nothing.
  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('Pizza')
  await expect(loopStill(page.getByTestId('search-results'), '/clips/search-empty')).toBeVisible()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).press('Escape')

  // A link whose lookup fails.
  await stubSourceLookup(page, 'fail')
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await sheet.getByLabel('Link').fill(`${TIKTOK}?kaputt`)
  await expect(loopStill(sheet, '/clips/lookup-failed', null)).toBeVisible()

  // Whatever would load a clip has had its chance.
  await page.waitForLoadState('networkidle')
  expect(await clips()).toBe(0)
})

test('Not unlocked, the invite landing and the error screen show stills only', async ({ page }) => {
  const clips = await countClips(page)

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
  expect(await clips()).toBe(0)
})

test('the achievement badge shows its count at once; both celebrations show their stills and stay until closed', async ({ page }) => {
  const clips = await countClips(page)
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
  // Scrolled down to "Gekocht ✓", the compact bar may be in, with a second
  // "Schließen": the first one is the bar's while it is.
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(detail).toBeHidden()

  // The 10th Cooking: the milestone's still, its pebble resting with its
  // "10×", nothing moving, until it is closed.
  await page.getByRole('region', { name: 'Gekocht' }).getByRole('button', { name: 'Gekocht ✓: „Ramen“' }).click()
  const milestone = page.getByRole('dialog', { name: 'Klassiker!' })
  await expect(loopStill(milestone, '/clips/milestone-10x')).toBeVisible()
  await expect(milestone.getByTestId('celebration-label')).toBeVisible()
  expect(await moving(milestone.locator('.clip'))).toEqual([])
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
  await expect(loopStill(created, '/clips/board-created')).toBeVisible()
  await expect(created.getByTestId('celebration-label')).toBeVisible()
  expect(await moving(created.locator('.clip'))).toEqual([])
  await created.getByRole('button', { name: 'Los geht’s' }).click()
  await expect(created).toBeHidden()

  await page.waitForLoadState('networkidle')
  expect(await clips()).toBe(0)
})
