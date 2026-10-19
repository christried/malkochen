import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId, removeUsers, seedDish } from './seed'

// The Dish History ("Verlauf", #332) at the bottom of the Dish detail: who
// added the Dish, its Cookings and its Comments, oldest first, with the
// comment field under it. Its author edits a Comment ("bearbeitet") and
// deletes it with "Rückgängig"; the Owner deletes anyone's. Lamarr's Board
// is used by this file only; Mirzakhani joins it.
test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

const LAMARR = ALLOWLISTED[88]
const MIRZAKHANI = ALLOWLISTED[89]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// CI's retry runs the whole file again, on the same database.
test.beforeAll(() => removeUsers(LAMARR, MIRZAKHANI))

async function openDish(page: Page, title: string) {
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: title }).click()
  const detail = page.getByRole('dialog', { name: title })
  const history = detail.locator('[data-dish-history]')
  return { detail, history, comments: history.locator('[data-comment]'), field: history.getByRole('textbox', { name: 'Kommentar' }) }
}

test('the Verlauf starts with who added the Dish; a Comment written under it shows at its end, and stays', async ({ page }) => {
  await signIn(page, LAMARR)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Linsen-Dal', sourceLink: TIKTOK, sourceKind: 'tiktok', addedBy: LAMARR })
  const { detail, history, comments, field } = await openDish(page, 'Linsen-Dal')

  await expect(history.getByRole('heading', { name: 'Verlauf' })).toBeVisible()
  await expect(history.locator('li').first()).toContainText(/hat das Gericht hinzugefügt/)
  await expect(detail.getByText(/^Hinzugefügt von /)).toHaveCount(0)
  await expect(comments).toHaveCount(0)
  await expect(history.getByRole('button', { name: 'Senden' })).toBeDisabled()

  await field.fill('  Machen wir Freitag?  ')
  await history.getByRole('button', { name: 'Senden' }).click()

  await expect(comments).toHaveCount(1)
  await expect(comments.first()).toContainText('Machen wir Freitag?')
  await expect(comments.first()).toContainText(/heute, \d\d:\d\d/)
  await expect(field).toHaveValue('')

  // Enter sends too.
  await field.fill('Ich bringe Koriander mit')
  await field.press('Enter')
  await expect(comments).toHaveCount(2)
  await expect(comments.nth(1)).toContainText('Ich bringe Koriander mit')

  await reloadHydrated(page)
  await expect(comments).toHaveCount(2)
  await expect(comments.first()).toContainText('Machen wir Freitag?')
})

test('its author edits a Comment, which is then marked "bearbeitet"', async ({ page }) => {
  await signIn(page, LAMARR)
  const { history, comments, field } = await openDish(page, 'Linsen-Dal')
  await expect(comments).toHaveCount(2)

  const startEditing = async () => {
    await comments.first().getByRole('button', { name: 'Kommentar bearbeiten oder löschen' }).click()
    await comments.first().getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(field).toHaveValue('Machen wir Freitag?')
    await expect(field).toBeFocused()
  }
  // Escape leaves the edit, not the detail.
  await startEditing()
  await field.press('Escape')
  await expect(field).toHaveValue('')
  await expect(history).toBeVisible()

  await startEditing()
  await field.fill('Machen wir Samstag?')
  await history.getByRole('button', { name: 'Speichern' }).click()

  await expect(comments.first()).toContainText('Machen wir Samstag?')
  await expect(comments.first()).toContainText('bearbeitet')
  await expect(comments.nth(1)).not.toContainText('bearbeitet')
  await expect(field).toHaveValue('')
  await reloadHydrated(page)
  await expect(comments.first()).toContainText('Machen wir Samstag?')
  await expect(comments.first()).toContainText('bearbeitet')
})

test('deleting a Comment takes it out of the Verlauf, and "Rückgängig" brings it back', async ({ page }) => {
  await signIn(page, LAMARR)
  const { comments } = await openDish(page, 'Linsen-Dal')
  await expect(comments).toHaveCount(2)

  await comments.nth(1).getByRole('button', { name: 'Kommentar bearbeiten oder löschen' }).click()
  await comments.nth(1).getByRole('button', { name: 'Löschen', exact: true }).click()

  await expect(comments).toHaveCount(1)
  const toast = page.getByRole('status').filter({ hasText: 'Kommentar gelöscht' })
  await toast.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(comments).toHaveCount(2)
  await expect(comments.nth(1)).toContainText('Ich bringe Koriander mit')

  // Deleted again, without undo, it stays deleted.
  await comments.nth(1).getByRole('button', { name: 'Kommentar bearbeiten oder löschen' }).click()
  await comments.nth(1).getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(comments).toHaveCount(1)
  await expect(toast).toBeHidden({ timeout: 8000 })
  await reloadHydrated(page)
  await expect(comments).toHaveCount(1)
})

test('another Member can\'t change the Owner\'s Comment; the Owner deletes theirs', async ({ page, browser }) => {
  await signIn(page, LAMARR)
  await gotoHydrated(page, '/')
  const token = await inviteToken(page, await landingBoardId(page))
  const other = await newTab(browser)
  await signIn(other, MIRZAKHANI)
  const joined = await other.request.post(`/api/invites/${token}/join`, { headers: { origin: E2E_ORIGIN } })
  expect(joined.ok()).toBe(true)

  const theirs = await openDish(other, 'Linsen-Dal')
  await expect(theirs.comments).toHaveCount(1)
  await expect(theirs.comments.first().getByRole('button', { name: /^Kommentar / })).toHaveCount(0)
  await theirs.field.fill('Zu scharf für mich')
  await theirs.history.getByRole('button', { name: 'Senden' }).click()
  await expect(theirs.comments).toHaveCount(2)
  // Their own has the "…", with "Bearbeiten".
  await theirs.comments.nth(1).getByRole('button', { name: 'Kommentar bearbeiten oder löschen' }).click()
  await expect(theirs.comments.nth(1).getByRole('button', { name: 'Bearbeiten', exact: true })).toBeVisible()
  await other.context().close()

  const mine = await openDish(page, 'Linsen-Dal')
  await expect(mine.comments).toHaveCount(2)
  await mine.comments.nth(1).getByRole('button', { name: 'Kommentar löschen' }).click()
  await expect(mine.comments.nth(1).getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0)
  await mine.comments.nth(1).getByRole('button', { name: 'Löschen', exact: true }).click()
  await expect(mine.comments).toHaveCount(1)
  await reloadHydrated(page)
  await expect(mine.comments).toHaveCount(1)
})
