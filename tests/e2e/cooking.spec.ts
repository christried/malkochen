import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest, column, titles } from './board'
import { confetti, topfbert } from './celebration'
import { gotoHydrated, reloadHydrated } from './hydration'
import { clickAndExpectSaving, holdRequests } from './loading'
import { seedCookings, seedDish } from './seed'

// Cooking (PRD stories 35, 48–55): "Gekocht ✓" on a card, the Gekocht toast
// with "Notiz hinzufügen" and "Rückgängig", and the Cooking History in the
// Dish detail. All Columns side by side (desktop). Hedy's Board is used by
// this file only.
test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

function gekochtToast(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Gekocht ✓' })
}

test('"Gekocht ✓", then undo: the Dish goes back where it was, without a Cooking', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  for (const title of ['Linsensuppe', 'Shakshuka', 'Pad Thai']) {
    await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  }
  await gotoHydrated(page, '/')
  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Shakshuka', 'Linsensuppe'])

  await page.getByRole('button', { name: 'Gekocht ✓: „Shakshuka“' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Linsensuppe'])
  await expect(titles(page, 'Gekocht')).toHaveText(['Shakshuka'])
  await expect(column(page, 'Gekocht').getByText('1× gekocht')).toBeVisible()
  const toast = gekochtToast(page)
  await expect(toast.getByRole('button', { name: 'Notiz hinzufügen' })).toBeVisible()

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Shakshuka', 'Linsensuppe'])
  await expect(titles(page, 'Gekocht')).toHaveText([])
  await expect(page.getByText('1× gekocht')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Shakshuka' })).toBeFocused()
  await reloadHydrated(page)
  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Shakshuka', 'Linsensuppe'])
  await expect(page.getByText('1× gekocht')).toBeHidden()
})

test('a note from the toast shows in the Cooking History; cooking again counts', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gekocht ✓: „Pad Thai“' }).click()
  await gekochtToast(page).getByRole('button', { name: 'Notiz hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Notiz zum Kochen' })
  await expect(sheet.getByLabel('Notiz')).toBeFocused()
  await sheet.getByLabel('Notiz').fill('mit Feta besser')
  const release = await holdRequests(page, 'PATCH', /\/api\/cookings\/[^/]+$/)
  await clickAndExpectSaving(sheet.locator('button[type="submit"]'), 'Speichert …')
  release()
  await expect(sheet).toBeHidden()

  // Out of Gekocht and back in, from the menu: the history stays and grows.
  await page.getByRole('button', { name: 'Mehr zu „Pad Thai“' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Diese Woche' }).click()
  await expect(column(page, 'Diese Woche').getByText('1× gekocht')).toBeVisible()
  await expect(titles(page, 'Gekocht')).toHaveText([])
  await page.getByRole('button', { name: 'Mehr zu „Pad Thai“' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Gekocht' }).click()
  await expect(gekochtToast(page)).toBeVisible()
  await expect(column(page, 'Gekocht').getByText('2× gekocht')).toBeVisible()

  await reloadHydrated(page)
  await page.getByRole('link', { name: 'Pad Thai' }).click()
  const detail = page.getByRole('dialog', { name: 'Pad Thai' })
  await expect(detail.locator('[data-cooking-summary]')).toContainText('2× gekocht · zuletzt')
  const entries = detail.locator('[data-cooking]')
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(1)).toContainText('mit Feta besser')
})

test('in the detail: add a note later, delete a Cooking with undo, and cook again', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Pad Thai' }).click()
  const detail = page.getByRole('dialog', { name: 'Pad Thai' })
  const entries = detail.locator('[data-cooking]')
  await expect(entries).toHaveCount(2)

  // The newest Cooking has no note yet.
  await entries.first().getByRole('button', { name: /^Notiz zum Kochen am .* hinzufügen$/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Notiz zum Kochen' })
  await sheet.getByLabel('Notiz').fill('doppelt Knoblauch')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(entries.first()).toContainText('doppelt Knoblauch')

  await entries.nth(1).getByRole('button', { name: /^Kochen am .* löschen$/ }).click()
  await expect(entries).toHaveCount(1)
  await expect(detail.locator('[data-cooking-summary]')).toContainText('1× gekocht')
  await page.getByRole('status').getByRole('button', { name: 'Rückgängig' }).click()
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(1)).toContainText('mit Feta besser')

  await entries.first().getByRole('button', { name: /^Kochen am .* löschen$/ }).click()
  await expect(entries).toHaveCount(1)
  // Without undo, it stays deleted.
  await expect(page.getByRole('status').getByRole('button', { name: 'Rückgängig' })).toBeHidden({ timeout: 8000 })

  // Already in Gekocht, "Gekocht ✓" records another Cooking.
  await detail.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(entries).toHaveCount(2)
  await expect(gekochtToast(page)).toBeVisible()

  await reloadHydrated(page)
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(1)).toContainText('mit Feta besser')
  await expect(detail).not.toContainText('doppelt Knoblauch')
})

test('"Gekocht ✓" celebrates: veggie confetti, then Topfbert behind the toast until it goes', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await seedDish(page, { title: 'Ramen', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
  await expect(confetti(page)).toHaveCount(0)
  await expect(topfbert(page)).toHaveCount(0)

  await page.getByRole('button', { name: 'Gekocht ✓: „Ramen“' }).click()

  // 14 pieces fly up from the button and fall off the screen, once.
  await expect(confetti(page)).toHaveCount(14)
  await expect(topfbert(page)).toBeVisible()
  await expect(topfbert(page)).toContainText('Mmh!')
  await expect(confetti(page)).toHaveCount(0)
  // Topfbert stays with the toast and leaves with it.
  await expect(topfbert(page)).toBeVisible()
  await gekochtToast(page).getByRole('button', { name: 'Rückgängig' }).click()
  await expect(topfbert(page)).toHaveCount(0)
  await expect(titles(page, 'Ideen')).toContainText(['Ramen'])
})

test('"Gekocht ✓" in the Dish detail celebrates there', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Ramen' }).click()
  const detail = page.getByRole('dialog', { name: 'Ramen' })

  await detail.getByRole('button', { name: 'Gekocht ✓' }).click()

  await expect(confetti(detail)).toHaveCount(14)
  await expect(topfbert(detail)).toContainText('Mmh!')
})

// Spec story 30. The count is `truncate`d, so its text is complete in the DOM
// even when the card shows "99× g…": only its widths tell.
test('"99× gekocht" shows in full beside an avatar and a note, side by side and on a phone', async ({ page }) => {
  const title = 'Ofengemüse mit Halloumi und Zitronen-Joghurt'
  await signIn(page, ALLOWLISTED[6])
  await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', note: 'Mit Feta geht auch.', addedBy: ALLOWLISTED[6] })
  await seedCookings(page, title, 99)

  for (const viewport of [{ width: 1280, height: 800 }, { width: 360, height: 740 }]) {
    await page.setViewportSize(viewport)
    await gotoHydrated(page, '/')
    const card = page.getByRole('article', { name: title })
    const count = card.locator('[data-cooked-count]')
    await expect(count).toHaveText('99× gekocht')
    await cardAtRest(card)

    expect(await count.evaluate(el => el.scrollWidth <= el.clientWidth), `cut at ${viewport.width}px`).toBe(true)
    const parts: Record<string, Locator> = {
      title: card.getByRole('heading', { name: title }),
      avatar: card.getByTitle('Hinzugefügt von '),
      note: card.getByTitle('Mit Notiz'),
      count,
      cook: page.getByRole('button', { name: `Gekocht ✓: „${title}“` }),
    }
    const boxes = await Promise.all(Object.entries(parts).map(async ([name, part]) => ({ name, box: (await part.boundingBox())! })))
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart = a.box.x + a.box.width <= b.box.x || b.box.x + b.box.width <= a.box.x
          || a.box.y + a.box.height <= b.box.y || b.box.y + b.box.height <= a.box.y
        expect(apart, `${a.name} overlaps ${b.name} at ${viewport.width}px`).toBe(true)
      }
    }
  }
})
