import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { removeUsers } from './seed'

// Archived Boards (#337; CONTEXT.md: Archived Board): the Owner deleting a
// Board in Board Settings archives it; it waits under "Archiv" at the end of
// their Board Switcher, with the days it has left, and comes back from there,
// or is deleted for good. Kwolek's Boards are used by this file only.
test.describe.configure({ mode: 'serial' })
const KWOLEK = ALLOWLISTED[85]
test.beforeAll(() => removeUsers(KWOLEK))

const switcher = (page: Page) => page.getByRole('heading', { level: 1 }).getByRole('button')
const boardList = (page: Page) => page.getByRole('navigation', { name: 'Deine Boards' })
const archive = (page: Page) => boardList(page).getByRole('list', { name: 'Archiv' })

async function createBoard(page: Page, name: string): Promise<string> {
  const res = await page.request.post('/api/boards', { data: { name, emoji: '🫒' } })
  expect(res.status()).toBe(201)
  return (await res.json()).id
}

test('the Owner deletes a Board, finds it under Archiv in the Board Switcher and restores it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 })
  await signIn(page, KWOLEK)
  const boardId = await createBoard(page, 'Tapasabend')
  await gotoHydrated(page, `/b/${boardId}/settings`)

  await page.getByRole('button', { name: 'Board löschen' }).click()
  const dialog = page.getByRole('dialog', { name: 'Board löschen?' })
  await expect(dialog).toContainText('30 Tage lang findest du es noch unter „Archiv“')
  await dialog.getByLabel('Tipp zum Bestätigen „Tapasabend“ ein').fill('Tapasabend')
  await dialog.getByRole('button', { name: 'Board löschen' }).click()

  await expect(page).not.toHaveURL(/settings/)
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('🫒 Tapasabend')
  await switcher(page).click()
  await expect(boardList(page).getByRole('link', { name: /Tapasabend/ })).toHaveCount(0)
  const archived = archive(page).getByRole('listitem')
  await expect(archived).toHaveCount(1)
  await expect(archived).toContainText(/^🫒Tapasabend\s*Noch 30 Tage/)

  await archived.getByRole('button', { name: '🫒 Tapasabend wiederherstellen' }).click()

  await expect(page).toHaveURL(/\/b\/tapasabend$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🫒 Tapasabend')
  await switcher(page).click()
  await expect(boardList(page).getByRole('link', { name: /^Tapasabend/ })).toBeVisible()
  await expect(archive(page)).toHaveCount(0)
})

test('the Owner deletes an Archived Board for good, after confirming', async ({ page }) => {
  await signIn(page, KWOLEK)
  const boardId = await createBoard(page, 'Resteessen')
  expect((await page.request.delete(`/api/boards/${boardId}`)).status()).toBe(204)
  await gotoHydrated(page, '/')

  await switcher(page).click()
  await archive(page).getByRole('button', { name: '🫒 Resteessen endgültig löschen' }).click()
  const confirm = page.getByRole('dialog', { name: '🫒 Resteessen endgültig löschen?' })
  await expect(confirm).toContainText('Das lässt sich nicht rückgängig machen.')
  await confirm.getByRole('button', { name: 'Endgültig löschen' }).click()

  await expect(confirm).toBeHidden()
  await switcher(page).click()
  await expect(archive(page)).toHaveCount(0)
  expect(await (await page.request.get('/api/boards/archived')).json()).toEqual([])
})
