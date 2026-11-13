import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers } from './seed'
import { addDish, newBoard, nextMonday, planOn } from './week'

// The Shopping List (#536, #537; CONTEXT.md: Shopping List, Shopping Item):
// the switch to it, typing items, ticking, changing and removing them,
// "Erledigte entfernen" with "Rückgängig"; then "Auf die Einkaufsliste" in
// the Dish detail and "Woche auf die Einkaufsliste" on the Week Plan. The
// owner owns the Boards; used by this file only.
test.describe.configure({ mode: 'serial' })

const OWNER = ALLOWLISTED[250]
const DESKTOP = { width: 1280, height: 900 }
const PHONE = { width: 390, height: 844 }

test.beforeAll(() => removeUsers(OWNER))

const radio = (page: Page, name: string) => page.getByRole('radio', { name })
const shoppingList = (page: Page) => page.getByTestId('shopping-list')
// The lines of a group ("Sonstiges", or a Dish's title), top to bottom.
const linesOf = (page: Page, group: string) =>
  shoppingList(page).locator('[data-shopping-group]').filter({ has: page.locator('h3', { hasText: group }) }).locator('[data-shopping-tick] .text')

async function openList(page: Page, boardId: string) {
  await gotoHydrated(page, `/b/${boardId}`)
  await radio(page, 'Einkauf').click()
  await expect(shoppingList(page)).toBeVisible()
}

// A Dish with its Ingredients, through the API; its id.
async function dishWith(page: Page, boardId: string, title: string, ingredients: string[]): Promise<string> {
  const id = await addDish(page, boardId, title)
  const res = await page.request.patch(`/api/dishes/${id}`, { data: { recipe: { ingredients, steps: [] } } })
  expect(res.status()).toBe(200)
  return id
}

test('the switch shows the Shopping List, empty at first, and the choice survives a reload', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Einkaufsküche')
  await gotoHydrated(page, `/b/${boardId}`)

  await expect(radio(page, 'Spalten')).toBeChecked()
  await radio(page, 'Einkauf').click()
  await expect(radio(page, 'Einkauf')).toBeChecked()
  await expect(shoppingList(page)).toBeVisible()
  await expect(page.getByTestId('columns')).toBeHidden()
  await expect(page.getByTestId('empty-shopping-list')).toContainText('Die Einkaufsliste ist leer.')
  await expect(page.getByRole('button', { name: 'Gericht hinzufügen' })).toBeHidden()

  await reloadHydrated(page)
  await expect(radio(page, 'Einkauf')).toBeChecked()
  await expect(shoppingList(page)).toBeVisible()

  // ← goes back to the Week Plan, then the Columns.
  await radio(page, 'Einkauf').press('ArrowLeft')
  await expect(radio(page, 'Woche')).toBeChecked()
  await radio(page, 'Woche').press('ArrowLeft')
  await expect(radio(page, 'Spalten')).toBeChecked()
})

test('items are typed into "Sonstiges" one after another, ticked to the bottom, unticked, changed and removed with "Rückgängig"', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Einkaufszettel')
  await openList(page, boardId)

  const field = page.getByRole('textbox', { name: 'Neuer Eintrag' })
  await field.fill('Hafermilch')
  await field.press('Enter')
  await expect(field).toBeFocused()
  await field.fill('Klopapier')
  await field.press('Enter')
  await field.fill('Spülmittel')
  await field.press('Enter')
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Hafermilch', 'Klopapier', 'Spülmittel'])

  // A tap on the line ticks it: crossed out, at the bottom.
  await linesOf(page, 'Sonstiges').filter({ hasText: 'Hafermilch' }).click()
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Klopapier', 'Spülmittel', 'Hafermilch'])
  await expect(page.getByRole('checkbox', { name: 'Hafermilch' })).toBeChecked()
  // And back.
  await page.getByRole('checkbox', { name: 'Hafermilch' }).click()
  await expect(page.getByRole('checkbox', { name: 'Hafermilch' })).not.toBeChecked()
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Hafermilch', 'Klopapier', 'Spülmittel'])

  // Changing a line's text.
  await page.getByRole('button', { name: '„Hafermilch“ ändern' }).click()
  const edit = page.getByRole('textbox', { name: 'Eintrag', exact: true })
  await edit.fill('2 Hafermilch')
  await edit.press('Enter')
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['2 Hafermilch', 'Klopapier', 'Spülmittel'])

  // Removing one, and "Rückgängig".
  await page.getByRole('button', { name: '„Klopapier“ entfernen' }).click()
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['2 Hafermilch', 'Spülmittel'])
  await expect(page.getByText('Eintrag entfernt.')).toBeVisible()
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['2 Hafermilch', 'Klopapier', 'Spülmittel'])

  // What the server has after a reload.
  await reloadHydrated(page)
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['2 Hafermilch', 'Klopapier', 'Spülmittel'])
})

test('"Erledigte entfernen" clears the ticked lines, off while none is ticked, and "Rückgängig" brings them back', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Erledigtes')
  for (const text of ['Reis', 'Tofu', 'Sojasoße']) {
    expect((await page.request.post(`/api/boards/${boardId}/shopping-items`, { data: { id: crypto.randomUUID(), text } })).status()).toBe(201)
  }
  await openList(page, boardId)

  const clear = page.getByRole('button', { name: 'Erledigte entfernen' })
  await expect(clear).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Reis' }).click()
  await page.getByRole('checkbox', { name: 'Sojasoße' }).click()
  await expect(clear).toBeEnabled()

  await clear.click()
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Tofu'])
  await expect(page.getByText('2 Einträge entfernt.')).toBeVisible()
  await expect(clear).toBeDisabled()

  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Tofu', 'Reis', 'Sojasoße'])
  await expect(page.getByRole('checkbox', { name: 'Reis' })).toBeChecked()
})

test('"Auf die Einkaufsliste" in the Dish detail puts the lines left ticked on, under the Dish', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Linsenküche')
  await dishWith(page, boardId, 'Omas Linsensuppe', ['250 g rote Linsen', '1 Dose gehackte Tomaten', '1 TL Salz'])
  await addDish(page, boardId, 'Ohne Rezept')
  await gotoHydrated(page, `/b/${boardId}`)

  // Only a Dish with Ingredients offers it.
  await page.getByRole('link', { name: 'Ohne Rezept' }).first().click()
  const plain = page.getByRole('dialog', { name: 'Ohne Rezept' })
  await expect(plain).toBeVisible()
  await expect(plain.getByRole('button', { name: 'Auf die Einkaufsliste' })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(plain).toBeHidden()

  await page.getByRole('link', { name: 'Omas Linsensuppe' }).first().click()
  const detail = page.getByRole('dialog', { name: 'Omas Linsensuppe' })
  await detail.getByRole('button', { name: 'Auf die Einkaufsliste' }).click()
  const picker = page.getByTestId('ingredient-picker')
  await expect(picker.getByRole('checkbox')).toHaveCount(3)
  for (const box of await picker.getByRole('checkbox').all()) await expect(box).toBeChecked()
  const confirm = picker.getByRole('button', { name: '3 Zutaten hinzufügen' })
  await expect(confirm).toBeEnabled()

  // Salt is at home.
  await picker.getByRole('checkbox', { name: '1 TL Salz' }).click()
  await expect(picker.getByRole('button', { name: '2 Zutaten hinzufügen' })).toBeEnabled()
  await picker.getByRole('button', { name: '2 Zutaten hinzufügen' }).click()
  await expect(page.getByText('2 Zutaten auf der Einkaufsliste.')).toBeVisible()

  await page.keyboard.press('Escape')
  await radio(page, 'Einkauf').click()
  await expect(linesOf(page, 'Omas Linsensuppe')).toHaveText(['250 g rote Linsen', '1 Dose gehackte Tomaten'])
})

test('unticking every line turns the confirm off', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Nichts nötig')
  await dishWith(page, boardId, 'Pasta', ['Penne'])
  await gotoHydrated(page, `/b/${boardId}`)

  await page.getByRole('link', { name: 'Pasta' }).first().click()
  await page.getByRole('dialog', { name: 'Pasta' }).getByRole('button', { name: 'Auf die Einkaufsliste' }).click()
  const picker = page.getByTestId('ingredient-picker')
  await picker.getByRole('checkbox', { name: 'Penne' }).click()
  await expect(picker.getByRole('button', { name: '0 Zutaten hinzufügen' })).toBeDisabled()
})

test('"Woche auf die Einkaufsliste" puts the week\'s Dishes on, says how many, then that everything is on; a past week doesn\'t offer it', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wocheneinkauf')
  const soup = await dishWith(page, boardId, 'Linsensuppe', ['Linsen', 'Tomaten'])
  const pasta = await dishWith(page, boardId, 'Pasta', ['Penne'])
  const monday = nextMonday()
  await planOn(page, boardId, soup, monday)
  await planOn(page, boardId, pasta, monday)
  await planOn(page, boardId, soup, monday)
  await gotoHydrated(page, `/b/${boardId}`)
  await radio(page, 'Woche').click()

  // A week gone by: nothing to put on.
  await page.getByRole('button', { name: 'Vorherige Woche' }).click()
  await expect(page.getByRole('button', { name: 'Woche auf die Einkaufsliste' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await page.getByRole('button', { name: 'Nächste Woche' }).click()

  await page.getByRole('button', { name: 'Woche auf die Einkaufsliste' }).click()
  await expect(page.getByText('2 Gerichte auf der Einkaufsliste.')).toBeVisible()
  await page.getByRole('button', { name: 'Woche auf die Einkaufsliste' }).click()
  await expect(page.getByText('Alles schon auf der Einkaufsliste.')).toBeVisible()

  await radio(page, 'Einkauf').click()
  await expect(linesOf(page, 'Linsensuppe')).toHaveText(['Linsen', 'Tomaten'])
  await expect(linesOf(page, 'Pasta')).toHaveText(['Penne'])
})
