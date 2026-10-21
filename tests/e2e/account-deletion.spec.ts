import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { openUserSettings } from './settings-sheet'

// Account deletion (#346): "Konto löschen" at the end of your settings says
// what happens, asks for your Username, and signs you out for good.
// Semmelweis is used by this file only.
const SEMMELWEIS = ALLOWLISTED[126]

test('deleting your account from your settings, confirmed by your Username, lands you signed out', async ({ page }) => {
  await signIn(page, SEMMELWEIS)
  const sheet = await openUserSettings(page)

  const section = sheet.getByRole('region', { name: 'Konto löschen' })
  await section.getByRole('button', { name: 'Konto löschen' }).click()

  const dialog = page.getByRole('dialog', { name: 'Konto löschen?' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('listitem')).toHaveCount(5)
  await expect(dialog.getByText('Boards, auf denen nur du bist, werden gelöscht, mit allen Gerichten und Bildern.')).toBeVisible()
  const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' })
  const name = dialog.getByLabel('Tipp zum Bestätigen „semmelweis“ ein')

  // Not until the Username is typed.
  await name.fill('semmel')
  await expect(confirm).toBeDisabled()
  await name.fill('semmelweis')
  await confirm.click()

  await expect(page).toHaveURL('/login')
  // Signed out: the Board is out of reach.
  expect((await page.request.get('/api/me')).status()).toBe(401)
})
