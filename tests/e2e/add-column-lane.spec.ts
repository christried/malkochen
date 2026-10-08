import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId, resetBoard } from './seed'

// The add lane (handoff breakpoints.desktop: "Kanban lanes + add-Column
// lane"): on a computer a Column is added from the Board itself, after the
// last Column. Rachel and Mae are used by this file only.

const RACHEL = ALLOWLISTED[36]
const MAE = ALLOWLISTED[37]
const DESKTOP = { width: 1440, height: 900 }

// The Board's lane headings, left to right.
function columnNames(page: Page) {
  return page.getByRole('region').getByRole('heading', { level: 2 })
}

// The add lane at rest, and its field once open.
const addLane = (page: Page) => page.getByRole('button', { name: 'Neue Spalte' })
const nameField = (page: Page) => page.getByRole('textbox', { name: 'Neue Spalte' })

async function openBoard(page: Page) {
  await page.setViewportSize(DESKTOP)
  await signIn(page, RACHEL)
  await resetBoard(page)
  await gotoHydrated(page, '/')
  await expect(columnNames(page)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
}

for (const scheme of ['light', 'dark'] as const) {
  test(`at 1440px a dashed add lane follows the last Column, as wide and at the same top (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await openBoard(page)

    const lane = addLane(page)
    await expect(lane).toBeVisible()
    const gekocht = (await column(page, 'Gekocht').boundingBox())!
    const outline = lane.locator('xpath=..')
    const box = (await outline.boundingBox())!
    expect(box.x).toBeGreaterThan(gekocht.x + gekocht.width)
    expect(Math.abs(box.y - gekocht.y)).toBeLessThanOrEqual(1)
    expect(box.width).toBeCloseTo(330, 0)
    expect(await outline.evaluate(el => getComputedStyle(el).borderTopStyle)).toBe('dashed')
    // Its label reads in the theme's own muted text (tokens.css).
    expect(await lane.evaluate(el => getComputedStyle(el).color)).toBe(scheme === 'dark' ? 'rgb(168, 162, 152)' : 'rgb(111, 107, 101)')
  })
}

test('a Column added from the add lane shows before it at once, in the next accent with the empty-Column clip, and stays', async ({ page }) => {
  await openBoard(page)

  await addLane(page).click()
  await expect(nameField(page)).toBeFocused()
  await expect(addLane(page)).toHaveCount(0)
  await nameField(page).fill('  Wochenende  ')
  await nameField(page).press('Enter')

  await expect(columnNames(page)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht', 'Wochenende'])
  const added = column(page, 'Wochenende')
  expect(await added.getAttribute('style')).toContain('--accent: var(--color-carrot)')
  await expect(added.locator('[data-empty-clip]')).toBeVisible()
  // The lane rests again, after the new Column.
  await expect(nameField(page)).toHaveCount(0)
  await expect(addLane(page)).toBeFocused()
  expect((await addLane(page).boundingBox())!.x).toBeGreaterThan((await added.boundingBox())!.x)

  // The round button adds one too.
  await addLane(page).click()
  await nameField(page).fill('Für Gäste')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  await expect(columnNames(page)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht', 'Wochenende', 'Für Gäste'])

  await reloadHydrated(page)
  await expect(columnNames(page)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht', 'Wochenende', 'Für Gäste'])
})

test('an empty name can’t be added; Escape, or clicking away from an empty field, leaves nothing behind', async ({ page }) => {
  await openBoard(page)
  const posts: string[] = []
  page.on('request', r => r.method() === 'POST' && r.url().endsWith('/columns') && posts.push(r.url()))

  await addLane(page).click()
  await nameField(page).fill('   ')
  await expect(page.getByRole('button', { name: 'Hinzufügen', exact: true })).toBeDisabled()
  await nameField(page).press('Enter')
  await expect(nameField(page)).toBeFocused()

  // Escape, with a name typed: back to rest, and the name is gone.
  await nameField(page).fill('Nachtisch')
  await nameField(page).press('Escape')
  await expect(nameField(page)).toHaveCount(0)
  await expect(addLane(page)).toBeFocused()
  await addLane(page).click()
  await expect(nameField(page)).toHaveValue('')

  // Clicking away from the empty field.
  await page.getByRole('heading', { level: 2, name: 'Ideen' }).click()
  await expect(nameField(page)).toHaveCount(0)
  await expect(addLane(page)).toBeVisible()

  // With a name in it, clicking away keeps the field and the name.
  await addLane(page).click()
  await nameField(page).fill('Nachtisch')
  await page.getByRole('heading', { level: 2, name: 'Ideen' }).click()
  await expect(nameField(page)).toHaveValue('Nachtisch')

  await expect(columnNames(page)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
  expect(posts).toEqual([])
})

test('an add that fails says so and keeps the name in the field, focused, for another try', async ({ page }) => {
  await openBoard(page)
  let release = () => {}
  const held = new Promise<void>(resolve => (release = resolve))
  await page.route(/\/api\/boards\/[^/]+\/columns$/, async (route) => {
    if (route.request().method() !== 'POST') return route.fallback()
    await held
    await route.fulfill({ status: 500 })
  })

  await addLane(page).click()
  await nameField(page).fill('Wochenende')
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click()
  // While it is being added, the name stays as sent, and Escape doesn't close.
  await expect(nameField(page)).toHaveAttribute('readonly')
  await page.keyboard.press('Escape')
  await expect(nameField(page)).toHaveValue('Wochenende')
  release()

  await expect(page.getByText('Das hat nicht geklappt. Versuch es gleich noch mal.')).toBeVisible()
  await expect(nameField(page)).toHaveValue('Wochenende')
  await expect(nameField(page)).toBeFocused()
  await expect(nameField(page)).not.toHaveAttribute('readonly')
  await expect(columnNames(page)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
})

test('below 1200px there is no add lane: tablets and phones add Columns in Board settings', async ({ page }) => {
  await openBoard(page)
  await expect(addLane(page)).toBeVisible()

  for (const viewport of [{ width: 1199, height: 900 }, { width: 820, height: 1180 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await expect(addLane(page)).toHaveCount(0)
  }
})

test('another Member sees a Column added from the add lane after their next sync, without a reload', async ({ page, browser }) => {
  await openBoard(page)
  const boardId = await landingBoardId(page)
  const token = await inviteToken(page, boardId)
  const mae = await newTab(browser, { viewport: DESKTOP })
  await signIn(mae, MAE)
  expect((await mae.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  await gotoHydrated(mae, `/b/${boardId}`)
  await expect(columnNames(mae)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])

  await addLane(page).click()
  await nameField(page).fill('Wochenende')
  await nameField(page).press('Enter')
  await expect(columnNames(page)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht', 'Wochenende'])

  await expect(columnNames(mae)).toHaveText(['Ideen', 'Diese Woche', 'Gekocht', 'Wochenende'], { timeout: 10_000 })
})
