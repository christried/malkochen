import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { removeUsers } from './seed'
import { addDish, newBoard } from './week'

// The Shopping List's lines (#536, R15): on a phone a long press changes a
// line and a swipe left removes it (with "Rückgängig"); on a desktop the keys
// and the hover buttons, the hold before a ticked line sinks, and a Dish put
// on twice ("Zweimal auf der Liste"). The lines' own rules are in
// shopping-list.spec.ts; this file covers how they are touched and held.
test.describe.configure({ mode: 'serial' })

const OWNER = ALLOWLISTED[251]
const DESKTOP = { width: 1280, height: 900 }

test.beforeAll(() => removeUsers(OWNER))

const radio = (page: Page, name: string) => page.getByRole('radio', { name })
const shoppingList = (page: Page) => page.getByTestId('shopping-list')
// The lines of a group ("Sonstiges", or a Dish's title), top to bottom.
const linesOf = (page: Page, group: string) =>
  shoppingList(page).locator('[data-shopping-group]').filter({ has: page.locator('h3', { hasText: group }) }).locator('[data-shopping-tick] .text')
// A line's row: its label starts with the line's text ("Reis, Sonstiges, nicht erledigt").
const lineRow = (page: Page, text: string) => shoppingList(page).getByRole('checkbox', { name: text })

async function openList(page: Page, boardId: string) {
  await gotoHydrated(page, `/b/${boardId}`)
  await radio(page, 'Einkauf').click()
  await expect(shoppingList(page)).toBeVisible()
}

async function addLines(page: Page, boardId: string, texts: string[]) {
  for (const text of texts) {
    expect((await page.request.post(`/api/boards/${boardId}/shopping-items`, { data: { id: crypto.randomUUID(), text } })).status()).toBe(201)
  }
}

// A Dish with its Ingredients, through the API; its id.
async function dishWith(page: Page, boardId: string, title: string, ingredients: string[]): Promise<string> {
  const id = await addDish(page, boardId, title)
  const res = await page.request.patch(`/api/dishes/${id}`, { data: { recipe: { ingredients, steps: [] } } })
  expect(res.status()).toBe(200)
  return id
}

// A finger on the screen: it goes down at `from`, waits `holdMs`, moves
// through `path` in `stepMs` steps, and lifts. Real touch input, so the
// browser's own pointer events (pointerType touch) reach the line.
async function touch(page: Page, from: { x: number, y: number }, path: { x: number, y: number }[], { holdMs = 0, stepMs = 16 } = {}) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  if (holdMs > 0) await page.waitForTimeout(holdMs)
  for (const point of path) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] })
    await page.waitForTimeout(stepMs)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await cdp.detach()
}

// The middle of a line's row, and its right edge, in the page's coordinates.
async function rowPoints(page: Page, text: string) {
  const box = (await lineRow(page, text).boundingBox())!
  return { y: box.y + box.height / 2, left: box.x + 24, right: box.x + box.width - 24, box }
}

// The row's own transform, which a swipe moves and a spring-back returns.
const rowTransform = (page: Page, text: string) => lineRow(page, text).evaluate(el => getComputedStyle(el).transform)

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })

  test('a long press of 450ms opens the line for changing, its text selected', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Langdruck')
    await addLines(page, boardId, ['Reis'])
    await openList(page, boardId)

    const { y, left } = await rowPoints(page, 'Reis')
    await touch(page, { x: left, y }, [], { holdMs: 550 })

    const edit = page.getByRole('textbox', { name: 'Eintrag ändern', exact: true })
    await expect(edit).toBeFocused()
    const selection = await edit.evaluate((el: HTMLInputElement) => [el.value, el.selectionStart, el.selectionEnd])
    expect(selection).toEqual(['Reis', 0, 4])
    // Escape cancels, and the line was not ticked on the way.
    await edit.press('Escape')
    await expect(edit).toBeHidden()
    await expect(lineRow(page, 'Reis')).toHaveAttribute('aria-checked', 'false')
  })

  test('a swipe left removes the line with "Eintrag entfernt.", and "Rückgängig" brings it back where it was', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Wischen')
    await addLines(page, boardId, ['Reis', 'Tofu'])
    await openList(page, boardId)

    const { y, right } = await rowPoints(page, 'Reis')
    const path = Array.from({ length: 12 }, (_, step) => ({ x: right - (step + 1) * 24, y }))
    await touch(page, { x: right, y }, path)

    await expect(page.getByRole('status').getByText('Eintrag entfernt.')).toBeVisible()
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Tofu'])
    await page.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Reis', 'Tofu'])
  })

  test('a short swipe springs back, and a tap still ticks the line', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Zurück')
    await addLines(page, boardId, ['Reis'])
    await openList(page, boardId)

    const { y, right } = await rowPoints(page, 'Reis')
    // A slow pull of 60px: short of the threshold, and no flick.
    const path = Array.from({ length: 6 }, (_, step) => ({ x: right - (step + 1) * 10, y }))
    await touch(page, { x: right, y }, path, { stepMs: 60 })

    await expect.poll(() => rowTransform(page, 'Reis')).toBe('none')
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Reis'])
    await expect(page.getByRole('status').getByText('Eintrag entfernt.')).toHaveCount(0)

    const { left } = await rowPoints(page, 'Reis')
    await touch(page, { x: left, y }, [])
    await expect(lineRow(page, 'Reis')).toHaveAttribute('aria-checked', 'true')
  })
})

test.describe('on a desktop', () => {
  test.use({ viewport: DESKTOP })

  test('clearing the text and pressing Enter removes the line, with "Eintrag entfernt."', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Leermachen')
    await addLines(page, boardId, ['Reis', 'Tofu'])
    await openList(page, boardId)

    await page.getByRole('button', { name: '„Reis“ ändern' }).click()
    const edit = page.getByRole('textbox', { name: 'Eintrag ändern', exact: true })
    await expect(edit).toBeFocused()
    await edit.fill('')
    await edit.press('Enter')
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Tofu'])
    await expect(page.getByRole('status').getByText('Eintrag entfernt.')).toBeVisible()
    await page.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Reis', 'Tofu'])
  })

  test('Escape cancels a change, and a blur saves it', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Abbruch')
    await addLines(page, boardId, ['Reis', 'Tofu'])
    await openList(page, boardId)

    await page.getByRole('button', { name: '„Reis“ ändern' }).click()
    const edit = page.getByRole('textbox', { name: 'Eintrag ändern', exact: true })
    await edit.fill('Basmati')
    await edit.press('Escape')
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Reis', 'Tofu'])

    await page.getByRole('button', { name: '„Tofu“ ändern' }).click()
    await page.getByRole('textbox', { name: 'Eintrag ändern', exact: true }).fill('Seidentofu')
    await page.getByRole('heading', { name: 'Einkaufsliste' }).click()
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Reis', 'Seidentofu'])
  })

  test('↑ and ↓ move the focus between the lines, Space ticks, and Delete removes the focused line', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Tasten')
    await addLines(page, boardId, ['Eins', 'Zwei', 'Drei'])
    await openList(page, boardId)

    await lineRow(page, 'Eins').focus()
    await page.keyboard.press('ArrowDown')
    await expect(lineRow(page, 'Zwei')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(lineRow(page, 'Drei')).toBeFocused()
    await page.keyboard.press('ArrowDown')
    await expect(lineRow(page, 'Drei')).toBeFocused()
    await page.keyboard.press('ArrowUp')
    await expect(lineRow(page, 'Zwei')).toBeFocused()

    await page.keyboard.press('Space')
    await expect(lineRow(page, 'Zwei')).toHaveAttribute('aria-checked', 'true')

    await lineRow(page, 'Zwei').focus()
    await page.keyboard.press('Delete')
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Eins', 'Drei'])
  })

  test('a ticked line waits about 600ms in its place before it sinks to the bottom of its group', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Warten')
    await addLines(page, boardId, ['Eins', 'Zwei', 'Drei'])
    await openList(page, boardId)

    await lineRow(page, 'Eins').click()
    await expect(lineRow(page, 'Eins')).toHaveAttribute('aria-checked', 'true')
    // Right after the tick it is still first.
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Eins', 'Zwei', 'Drei'])

    // After the hold it has sunk.
    await page.waitForTimeout(1000)
    await expect(linesOf(page, 'Sonstiges')).toHaveText(['Zwei', 'Drei', 'Eins'])
  })

  test('the pencil and the trash show on hover, and a Dish put on twice says "Zweimal auf der Liste"', async ({ page }) => {
    await signIn(page, OWNER)
    const boardId = await newBoard(page, 'Zweimal')
    await addLines(page, boardId, ['Brot'])
    await dishWith(page, boardId, 'Linsensuppe', ['Linsen', 'Tomaten'])
    await gotoHydrated(page, `/b/${boardId}`)

    const pencil = page.getByRole('button', { name: '„Brot“ ändern' })
    await radio(page, 'Einkauf').click()
    await expect(pencil).toHaveCSS('opacity', '0')
    await lineRow(page, 'Brot').hover()
    await expect(pencil).toHaveCSS('opacity', '1')

    // The Dish, put on twice from its detail.
    for (let round = 0; round < 2; round++) {
      await radio(page, 'Spalten').click()
      await page.getByRole('link', { name: 'Linsensuppe' }).first().click()
      const detail = page.getByRole('dialog', { name: 'Linsensuppe' })
      await expect(detail).toBeVisible()
      await detail.getByRole('button', { name: 'Auf die Einkaufsliste' }).click()
      const picker = page.getByTestId('ingredient-picker')
      await picker.getByRole('button', { name: '2 Zutaten hinzufügen' }).click()
      await expect(page.getByText('2 Zutaten auf der Einkaufsliste.')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(detail).toBeHidden()
    }
    await radio(page, 'Einkauf').click()
    const group = shoppingList(page).locator('[data-shopping-group]').filter({ has: page.locator('h3', { hasText: 'Linsensuppe' }) })
    await expect(group.getByText('Zweimal auf der Liste')).toBeVisible()
    await expect(group.getByRole('list', { name: 'Linsensuppe' })).toHaveCount(1)
  })
})
