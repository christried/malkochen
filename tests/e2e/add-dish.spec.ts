import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers } from './seed'
import { openUserSettings } from './settings-sheet'

// The sheet opens on the link step; "Ohne Link hinzufügen" leads to the form.
async function addWithoutLink(page: Page) {
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await page.getByRole('dialog', { name: 'Gericht hinzufügen' }).getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  return page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
}

// Grace's Board is used by this file only, so it starts empty.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })
test.beforeAll(() => removeUsers(ALLOWLISTED[1]))

test('an empty Board invites the first Dish, which then lands on top of Ideen', async ({ page }) => {
  await signIn(page, ALLOWLISTED[1])
  await gotoHydrated(page, '/')
  const ideen = page.getByRole('region', { name: 'Ideen' })
  await expect(ideen.getByText('Noch nichts hier.')).toBeVisible()
  await expect(ideen.getByText('Füg deinen ersten Link ein!')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Diese Woche' }).getByText('Noch nichts hier.')).toBeVisible()

  const sheet = await addWithoutLink(page)
  const save = sheet.getByRole('button', { name: 'Speichern' })
  await expect(save).toBeDisabled()

  // Inline: 4×2 with Salat / Bowl selected while no title names a dish; Eintopf is only in the full picker.
  const inline = sheet.getByRole('radiogroup', { name: 'Bild' })
  await expect(inline.getByRole('radio')).toHaveCount(8)
  await expect(inline.getByRole('radio', { name: 'Salat / Bowl' })).toHaveAttribute('aria-checked', 'true')
  await expect(inline.getByRole('radio', { name: 'Eintopf' })).toHaveCount(0)
  // The title names its dish: that Placeholder picks itself, in the last
  // inline slot (handoff illustrations.json autoPick).
  await sheet.getByLabel('Titel').fill('Omas Linsensuppe')
  await expect(inline.getByRole('radio')).toHaveCount(8)
  await expect(inline.getByRole('radio', { name: 'Eintopf' })).toHaveAttribute('aria-checked', 'true')
  // The note suggests one of the made-up examples (app/strings/de.ts).
  await expect(sheet.getByLabel('Notiz')).toHaveAttribute('placeholder', /^Optional, z\. B\. „.+“$/)
  await sheet.getByLabel('Notiz').fill('mit Räuchertofu und Frühlingszwiebeln')

  await sheet.getByRole('button', { name: 'Bild wählen' }).click()
  const all = page.getByRole('dialog', { name: 'Bild wählen' })
  await expect(all.getByRole('radio')).toHaveCount(12)
  // The arrows go on from the selection; past the last tile, the first.
  await all.getByRole('radio', { name: 'Eintopf' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(all.getByRole('radio', { name: 'Pasta' })).toBeFocused()
  await expect(all).toBeVisible()
  await all.getByRole('radio', { name: 'Dumplings' }).click()
  await expect(all).toBeHidden()
  await expect(sheet).toBeVisible()
  await expect(inline.getByRole('radio')).toHaveCount(8)
  await expect(inline.getByRole('radio', { name: 'Dumplings' })).toHaveAttribute('aria-checked', 'true')
  // Picked by hand, it stays, whatever the title says then.
  await sheet.getByLabel('Titel').fill('Pancakes')
  await sheet.getByLabel('Titel').fill('Omas Linsensuppe')
  await expect(inline.getByRole('radio', { name: 'Dumplings' })).toHaveAttribute('aria-checked', 'true')
  await save.click()

  await expect(sheet).toBeHidden()
  const card = ideen.getByRole('article').first()
  await expect(card).toHaveAccessibleName('Omas Linsensuppe')
  await expect(card.getByText('Mit Notiz')).toBeAttached()
  // No Source, no Source badge.
  await expect(card.locator('[data-source-badge]')).toHaveCount(0)
  await expect(card.locator('img[src="/placeholders/dumplings-light.svg"]')).toBeVisible()
  await expect(card.locator('img[src="/placeholders/dumplings-dark.svg"]')).toBeHidden()
  await expect(ideen.getByText('Füg deinen ersten Link ein!')).toHaveCount(0)

  // A second Dish, without a note, goes above the first, also after a reload.
  await addWithoutLink(page)
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
  await openUserSettings(page)
  await page.getByRole('radio', { name: 'Dunkel' }).click()
  // The Theme reveal stores the choice only once it has pictured the old
  // theme; navigating before then renders the Board in the old theme.
  await expect(page.getByRole('radio', { name: 'Dunkel' })).toHaveAttribute('aria-checked', 'true')
  await gotoHydrated(page, '/')

  const card = page.getByRole('article', { name: 'Omas Linsensuppe' })
  await expect(card.locator('img[src="/placeholders/dumplings-dark.svg"]')).toBeVisible()
  await expect(card.locator('img[src="/placeholders/dumplings-light.svg"]')).toBeHidden()
  await openUserSettings(page)
  await page.getByRole('radio', { name: 'Hell' }).click()
  await expect(page.getByRole('radio', { name: 'Hell' })).toHaveAttribute('aria-checked', 'true')
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
  const sheet = await addWithoutLink(page)
  await sheet.getByLabel('Titel').fill('Chana Masala')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(ideen.getByRole('heading', { level: 3 }).first()).toHaveText('Chana Masala')

  await page.setViewportSize({ width: 800, height: 900 })
  await expect(ideen).toBeVisible()
  await expect(dieseWoche).toBeVisible()
  const [a, b] = [await ideen.boundingBox(), await dieseWoche.boundingBox()]
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1)
  expect(b!.y).toBe(a!.y)
})
