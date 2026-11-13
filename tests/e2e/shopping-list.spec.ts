import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers } from './seed'
import { addDish, newBoard, nextMonday, planOn, today } from './week'

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
  await expect(page.getByTestId('empty-shopping-list')).toContainText('Noch nichts zu kaufen.')
  await expect(page.getByRole('button', { name: 'Gericht hinzufügen' })).toBeHidden()

  await reloadHydrated(page)
  await expect(radio(page, 'Einkauf')).toBeChecked()
  await expect(shoppingList(page)).toBeVisible()

  // ← goes back to the Week Plan, then the Columns.
  await radio(page, 'Einkauf').press('ArrowLeft')
  await expect(radio(page, 'Woche')).toBeChecked()
  await radio(page, 'Woche').press('ArrowLeft')
  await expect(radio(page, 'Spalten')).toBeChecked()

  // ← and → cycle: ← from Spalten comes round to Einkauf, → from Einkauf to Spalten.
  await radio(page, 'Spalten').press('ArrowLeft')
  await expect(radio(page, 'Einkauf')).toBeChecked()
  await expect(shoppingList(page)).toBeVisible()
  await radio(page, 'Einkauf').press('ArrowRight')
  await expect(radio(page, 'Spalten')).toBeChecked()
  await expect(page.getByTestId('columns')).toBeVisible()
})

test('items are typed into "Sonstiges" one after another, ticked to the bottom, unticked, changed and removed with "Rückgängig"', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Einkaufszettel')
  await openList(page, boardId)

  const field = page.getByRole('textbox', { name: 'Neu in Sonstiges' })
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
  const edit = page.getByRole('textbox', { name: 'Eintrag ändern', exact: true })
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

test('"Erledigte entfernen" clears the ticked lines, is absent while none is ticked, and "Rückgängig" brings them back', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Erledigtes')
  for (const text of ['Reis', 'Tofu', 'Sojasoße']) {
    expect((await page.request.post(`/api/boards/${boardId}/shopping-items`, { data: { id: crypto.randomUUID(), text } })).status()).toBe(201)
  }
  await openList(page, boardId)

  const clear = page.getByRole('button', { name: 'Erledigte entfernen' })
  await expect(clear).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Reis' }).click()
  await page.getByRole('checkbox', { name: 'Sojasoße' }).click()
  await expect(clear).toBeEnabled()

  await clear.click()
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Tofu'])
  await expect(page.getByText('2 Einträge entfernt.')).toBeVisible()
  await expect(clear).toHaveCount(0)

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
  await expect(picker.getByRole('button', { name: 'Keine Zutat ausgewählt' })).toBeDisabled()
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
  // The soup is planned twice that week, so it went on twice: its lines
  // side by side, in Recipe order.
  await expect(linesOf(page, 'Linsensuppe')).toHaveText(['Linsen', 'Linsen', 'Tomaten', 'Tomaten'])
  await expect(linesOf(page, 'Pasta')).toHaveText(['Penne'])
})

// "Rückgängig" after "Woche auf die Einkaufsliste" (#537, R15) takes just the
// week's Dishes off the list, and the Sonstiges line stays; a week that is on
// already offers no "Rückgängig".
test('"Rückgängig" after "Woche auf die Einkaufsliste" takes the week\'s Dishes off the list again, and "Alles schon" has none', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenrückgang')
  const soup = await dishWith(page, boardId, 'Linsensuppe', ['Linsen', 'Tomaten'])
  const pasta = await dishWith(page, boardId, 'Pasta', ['Penne'])
  const monday = nextMonday()
  await planOn(page, boardId, soup, monday)
  await planOn(page, boardId, pasta, monday)
  await planOn(page, boardId, soup, monday)
  expect((await page.request.post(`/api/boards/${boardId}/shopping-items`, { data: { id: crypto.randomUUID(), text: 'Brot' } })).status()).toBe(201)
  await gotoHydrated(page, `/b/${boardId}`)
  await radio(page, 'Woche').click()
  await page.getByRole('button', { name: 'Nächste Woche' }).click()

  await page.getByRole('button', { name: 'Woche auf die Einkaufsliste' }).click()
  await expect(page.getByText('2 Gerichte auf der Einkaufsliste.')).toBeVisible()
  await page.getByRole('button', { name: 'Rückgängig' }).click()

  // Only the week's Dishes went; the Sonstiges line stayed.
  await radio(page, 'Einkauf').click()
  await expect(linesOf(page, 'Linsensuppe')).toHaveCount(0)
  await expect(linesOf(page, 'Pasta')).toHaveCount(0)
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Brot'])

  // Back on the week, which is still the one shown: put on again, then it is all on.
  await radio(page, 'Woche').click()
  await page.getByRole('button', { name: 'Woche auf die Einkaufsliste' }).click()
  await expect(page.getByText('2 Gerichte auf der Einkaufsliste.')).toBeVisible()
  await page.getByRole('button', { name: 'Woche auf die Einkaufsliste' }).click()
  await expect(page.getByText('Alles schon auf der Einkaufsliste.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0)
})

// The shell (#536, R15): the phone's FAB and add bar, the desktop columns with
// the Sonstiges field, and the masonry of Dish groups.

// A Dish's lines put on the list, through the API, as the Dish detail puts them.
async function putOn(page: Page, boardId: string, dishId: string, lines: string[]) {
  const items = lines.map((text, line) => ({ id: crypto.randomUUID(), text, line }))
  const res = await page.request.post(`/api/boards/${boardId}/shopping-items/dish`, { data: { dishId, items } })
  expect(res.status()).toBe(201)
}

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })

  test('no field on top; the FAB opens the add bar, Enter adds lines and keeps the field, Enter on an empty field closes it', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Telefonleiste')
    await openList(page, boardId)

    // No field on the list itself: the add bar is closed.
    await expect(page.locator('[data-shopping-add]')).toBeHidden()
    const fab = page.getByRole('button', { name: 'Eintrag hinzufügen' })
    await expect(fab).toBeVisible()

    await fab.tap()
    const field = page.getByRole('textbox', { name: 'Neu in Sonstiges' })
    await expect(field).toBeFocused()
    await expect(fab).toBeHidden()

    await field.fill('Milch')
    await field.press('Enter')
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Milch'])
    await expect(field).toBeFocused()
    await expect(field).toHaveValue('')
    await expect(page.locator('[data-shopping-live]')).toHaveText('Milch hinzugefügt.')

    await field.fill('Butter')
    await field.press('Enter')
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Milch', 'Butter'])

    // Enter on the empty field: the bar closes, the FAB comes back.
    await field.press('Enter')
    await expect(field).toBeHidden()
    await expect(fab).toBeVisible()
  })
})

test('on the desktop the Sonstiges column has its field at the end, and "n" focuses it', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Schreibtischfeld')
  expect((await page.request.post(`/api/boards/${boardId}/shopping-items`, { data: { id: crypto.randomUUID(), text: 'Eier' } })).status()).toBe(201)
  await openList(page, boardId)

  const field = shoppingList(page).locator('[data-shopping-group="other"]').getByRole('textbox', { name: 'Neu in Sonstiges' })
  await expect(field).toBeVisible()
  // "n" anywhere on the list's view focuses it (not from a field of its own).
  await page.getByRole('heading', { name: 'Einkaufsliste' }).click()
  await page.keyboard.press('n')
  await expect(field).toBeFocused()
  await field.fill('Brot')
  await field.press('Enter')
  await expect(linesOf(page, 'Sonstiges')).toHaveText(['Eier', 'Brot'])
  await expect(field).toBeFocused()
})

test('an empty list on the desktop shows its card with the field, focused', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Leeres Schreibtisch')
  await openList(page, boardId)

  const card = page.getByTestId('empty-shopping-list')
  await expect(card.getByRole('textbox', { name: 'Neu in Sonstiges' })).toBeFocused()
  await expect(card.getByRole('button', { name: 'Etwas aufschreiben' })).toBeHidden()
})

test('on the desktop the Dish groups fill two columns, the shorter one first: a second Dish sits beside the first, a third under the shorter', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Zwei Spalten')
  const big = await dishWith(page, boardId, 'Großer Eintopf', ['Linsen', 'Tomaten', 'Karotten'])
  const small = await dishWith(page, boardId, 'Kleiner Salat', ['Gurke'])
  const third = await dishWith(page, boardId, 'Dritte Schüssel', ['Dill'])
  await putOn(page, boardId, big, ['Linsen', 'Tomaten', 'Karotten'])
  await putOn(page, boardId, small, ['Gurke'])
  await putOn(page, boardId, third, ['Dill'])
  await openList(page, boardId)

  const box = async (id: string) => (await shoppingList(page).locator(`[data-shopping-group="${id}"]`).boundingBox())!
  const a = await box(big)
  const b = await box(small)
  const c = await box(third)
  // The first Dish is in the left column; the second, the shorter, is to its right, at the top.
  expect(b.x).toBeGreaterThan(a.x + a.width)
  expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(2)
  // The third goes into the shorter column, which is the right one: under the second.
  expect(Math.abs(c.x - b.x)).toBeLessThanOrEqual(2)
  expect(c.y).toBeGreaterThan(b.y + b.height - 1)
})

// The placement of "Woche auf die Einkaufsliste" in the Week Plan's header
// (#537, R15): on a phone a ghost line under the title, the day list below
// it; on desktop a pill in the header row, before "Heute" and the arrows.
test('on a phone the "Woche auf die Einkaufsliste" line sits under the week title, and the days start right below it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Telefonwochenzeile')
  // A Dish today keeps the empty week's card out of the way of the day list.
  await planOn(page, boardId, await addDish(page, boardId, 'Gemüsepfanne'), today())
  await gotoHydrated(page, `/b/${boardId}`)
  await radio(page, 'Woche').click()

  const title = (await page.getByTestId('week-title').boundingBox())!
  const button = (await page.locator('[data-put-week-on]').boundingBox())!
  const days = (await page.getByTestId('week-days').boundingBox())!
  const next = (await page.getByRole('button', { name: 'Nächste Woche' }).boundingBox())!
  // Below the title, its left edge with the title's; the arrows stay on the title's line.
  expect(button.y).toBeGreaterThanOrEqual(title.y + title.height - 1)
  expect(Math.abs(button.x - title.x)).toBeLessThanOrEqual(4)
  expect(next.y).toBeLessThan(button.y)
  expect(button.height).toBe(36)
  // The day list starts 6px below the line.
  expect(days.y - (button.y + button.height)).toBeGreaterThanOrEqual(0)
  expect(days.y - (button.y + button.height)).toBeLessThanOrEqual(8)
})

test('on the desktop the "Woche auf die Einkaufsliste" pill sits in the header row, before "Heute" and the arrows', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Schreibtischwochenzeile')
  await gotoHydrated(page, `/b/${boardId}`)
  await radio(page, 'Woche').click()

  const header = async () => ({
    button: (await page.locator('[data-put-week-on]').boundingBox())!,
    previous: (await page.getByRole('button', { name: 'Vorherige Woche' }).boundingBox())!,
  })
  const { button, previous } = await header()
  expect(button.height).toBe(40)
  expect(button.x + button.width).toBeLessThan(previous.x)
  // In the header row: its middle level with the arrows'.
  expect(Math.abs(button.y + button.height / 2 - (previous.y + previous.height / 2))).toBeLessThanOrEqual(4)

  // Browsed away, "Heute" appears: it is after the pill and before the arrows.
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  const after = await header()
  const todayButton = (await page.locator('[data-today-button]').boundingBox())!
  expect(after.button.x + after.button.width).toBeLessThanOrEqual(todayButton.x)
  expect(todayButton.x + todayButton.width).toBeLessThan(after.previous.x)
})
