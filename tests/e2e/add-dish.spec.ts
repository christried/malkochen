import { expect, test } from '@playwright/test'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'

// Grace's Board is used by this file only, so it starts empty.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

test('an empty Board invites the first Dish, which then lands on top of Ideen', async ({ page }) => {
  await signIn(page, ALLOWLISTED[1])
  await gotoHydrated(page, '/')
  const ideen = page.getByRole('region', { name: 'Ideen' })
  await expect(ideen.getByText('Noch nichts hier.')).toBeVisible()
  await expect(ideen.getByText('Füg deinen ersten Link ein!')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Diese Woche' }).getByText('Noch nichts hier.')).toBeVisible()

  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  const save = sheet.getByRole('button', { name: 'Speichern' })
  await expect(save).toBeDisabled()

  await sheet.getByLabel('Titel').fill('Omas Linsensuppe')
  await sheet.getByLabel('Notiz').fill('mit Räuchertofu statt Speck')
  await sheet.getByRole('radio', { name: 'Eintopf' }).click()
  await expect(sheet.getByRole('radio', { name: 'Eintopf' })).toHaveAttribute('aria-checked', 'true')
  await save.click()

  await expect(sheet).toBeHidden()
  const card = ideen.getByRole('article').first()
  await expect(card).toHaveAccessibleName('Omas Linsensuppe')
  await expect(card.getByText('Mit Notiz')).toBeAttached()
  await expect(card.locator('img[src="/placeholders/eintopf-light.svg"]')).toBeVisible()
  await expect(card.locator('img[src="/placeholders/eintopf-dark.svg"]')).toBeHidden()
  await expect(ideen.getByText('Füg deinen ersten Link ein!')).toHaveCount(0)

  // A second Dish, without a note, goes above the first, also after a reload.
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await sheet.getByLabel('Titel').fill('Pad Thai')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  const titles = ideen.getByRole('heading', { level: 3 })
  await expect(titles).toHaveText(['Pad Thai', 'Omas Linsensuppe'])
  await expect(ideen.getByRole('article').first().getByText('Mit Notiz')).toHaveCount(0)

  await reloadHydrated(page)
  await expect(titles).toHaveText(['Pad Thai', 'Omas Linsensuppe'])
  await expect(page.getByRole('region', { name: 'Diese Woche' }).getByText('Noch nichts hier.')).toBeVisible()
})

test('in the dark theme the card shows the dark still', async ({ page }) => {
  await signIn(page, ALLOWLISTED[1])
  await gotoHydrated(page, '/')
  await page.getByRole('radio', { name: 'Dunkel' }).click()

  const card = page.getByRole('article', { name: 'Omas Linsensuppe' })
  await expect(card.locator('img[src="/placeholders/eintopf-dark.svg"]')).toBeVisible()
  await expect(card.locator('img[src="/placeholders/eintopf-light.svg"]')).toBeHidden()
  await page.getByRole('radio', { name: 'Hell' }).click()
})

test('a phone shows one Column at a time, a tablet shows them side by side', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[1])
  await gotoHydrated(page, '/')
  const ideen = page.getByRole('region', { name: 'Ideen' })
  const dieseWoche = page.getByRole('region', { name: 'Diese Woche' })
  await expect(ideen).toBeVisible()
  await expect(dieseWoche).toBeHidden()

  await page.getByRole('button', { name: /^Diese Woche/ }).click()
  await expect(dieseWoche).toBeVisible()
  await expect(ideen).toBeHidden()

  // Adding a Dish switches back to the first Column, where it lands.
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  await sheet.getByLabel('Titel').fill('Shakshuka')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(ideen.getByRole('heading', { level: 3 }).first()).toHaveText('Shakshuka')

  await page.setViewportSize({ width: 800, height: 900 })
  await expect(ideen).toBeVisible()
  await expect(dieseWoche).toBeVisible()
  const [a, b] = [await ideen.boundingBox(), await dieseWoche.boundingBox()]
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1)
  expect(b!.y).toBe(a!.y)
})
