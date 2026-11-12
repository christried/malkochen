import type { Browser, Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { fastPolls } from './polls'
import { removeUsers } from './seed'

// A Dish's Recipe in its detail (spec #492, ticket #496): typed in its own
// editor, read as two lists with numbered Steps, kept as an Unsent Change when
// malkochen doesn't answer. Beard owns the Boards, Ottolenghi joins them;
// both are used by this file only.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const OWNER = ALLOWLISTED[230]
const MEMBER = ALLOWLISTED[231]

test.beforeAll(async () => {
  await removeUsers(OWNER, MEMBER)
})

// A new Board of the owner's with Dishes `titles`, which the Member has
// joined through its Invite Link (a browser of their own, signed in).
async function sharedBoard(page: Page, browser: Browser, name: string, titles: string[]) {
  await fastPolls(page)
  await signIn(page, OWNER)
  const created = await page.request.post('/api/boards', { data: { name, emoji: '🥘' } })
  expect(created.status()).toBe(201)
  const { id: boardId } = await created.json() as { id: string }
  const dishes: Record<string, string> = {}
  for (const title of titles) {
    const res = await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'bowl' } })
    expect(res.status()).toBe(201)
    dishes[title] = (await res.json() as { id: string }).id
  }
  const token = await inviteToken(page, boardId)
  const member = await newTab(browser)
  await fastPolls(member)
  await signIn(member, MEMBER)
  expect((await member.request.post(`/api/invites/${token}/join`, { headers: { origin: E2E_ORIGIN } })).status()).toBe(200)
  return { boardId, dishes, member }
}

async function openDish(page: Page, boardId: string, title: string) {
  await gotoHydrated(page, `/b/${boardId}`)
  await page.getByRole('link', { name: title, exact: true }).click()
  const detail = page.getByRole('dialog', { name: title })
  await expect(detail).toBeVisible()
  return detail
}

// Pastes `text` into a field as the browser would, line breaks and all.
async function paste(field: Locator, text: string) {
  await field.focus()
  await field.evaluate((el, pasted) => {
    const data = new DataTransfer()
    data.setData('text/plain', pasted)
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
  }, text)
}

const fieldValues = (scope: Locator, kind: 'Zutat' | 'Schritt') => scope.getByRole('textbox', { name: new RegExp(`^${kind} \\d+$`) }).evaluateAll(els => els.map(el => (el as HTMLTextAreaElement).value))

test('a Member types a Recipe in the sheet and reads it back after a reload as two lists with numbered Steps', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 390, height: 844 })
  const { boardId } = await sharedBoard(page, browser, 'Rezeptküche', ['Linsensuppe', 'Pasta'])
  const detail = await openDish(page, boardId, 'Linsensuppe')

  // Without a Recipe: only the dashed button, no header, no empty lists.
  await expect(detail.getByRole('heading', { name: 'Rezept', level: 2 })).toHaveCount(0)
  await expect(detail.getByRole('heading', { name: 'Zutaten' })).toHaveCount(0)
  await detail.getByRole('button', { name: 'Rezept hinzufügen' }).click()

  const editor = page.getByRole('dialog', { name: 'Rezept' })
  await expect(editor).toBeVisible()
  const first = editor.getByRole('textbox', { name: 'Zutat 1' })
  await expect(first).toBeFocused()

  // Enter ends a line and starts the next; on an empty last line it only
  // closes the keyboard.
  await page.keyboard.type('200 g Linsen')
  await page.keyboard.press('Enter')
  await page.keyboard.type('1 Zwiebel')
  await page.keyboard.press('Enter')
  await page.keyboard.type('2 EL Öl')
  await page.keyboard.press('Enter')
  await expect(editor.getByRole('textbox', { name: 'Zutat 4' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(editor.getByRole('textbox', { name: 'Zutat 4' })).not.toBeFocused()
  await expect.poll(() => fieldValues(editor, 'Zutat')).toEqual(['200 g Linsen', '1 Zwiebel', '2 EL Öl', ''])

  // Three pasted lines make three Steps, in the Steps' first, empty line; marks are stripped, and the toast
  // offers to take them back.
  await paste(editor.getByRole('textbox', { name: 'Schritt 1' }), '1. Zwiebel würfeln\n\n2. Anbraten\n- Linsen dazu\n')
  await expect.poll(() => fieldValues(editor, 'Schritt')).toEqual(['Zwiebel würfeln', 'Anbraten', 'Linsen dazu'])
  const toast = page.locator('[data-toast]')
  await expect(toast).toContainText('3 Schritte eingefügt')
  await toast.getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(() => fieldValues(editor, 'Schritt')).toEqual([''])
  await paste(editor.getByRole('textbox', { name: 'Schritt 1' }), '1. Zwiebel würfeln\n\n2. Anbraten\n- Linsen dazu\n')
  await expect.poll(() => fieldValues(editor, 'Schritt')).toEqual(['Zwiebel würfeln', 'Anbraten', 'Linsen dazu'])

  // Moved from the grip's menu: "Linsen dazu" goes up one place.
  await editor.getByRole('button', { name: 'Linsen dazu verschieben' }).click()
  await editor.getByRole('menuitem', { name: 'Nach oben' }).click()
  await expect.poll(() => fieldValues(editor, 'Schritt')).toEqual(['Zwiebel würfeln', 'Linsen dazu', 'Anbraten'])
  await expect(editor.getByText('Linsen dazu, jetzt an Stelle 2 von 3.')).toBeAttached()
  await expect(editor.getByRole('button', { name: 'Linsen dazu verschieben' })).toBeFocused()

  await editor.getByRole('button', { name: 'Speichern' }).click()
  await expect(editor).toBeHidden()

  // Read: the empty fourth Ingredient is gone, the Steps are numbered.
  const read = async (scope: Locator) => {
    await expect(scope.getByRole('heading', { name: 'Rezept', level: 2 })).toBeVisible()
    await expect(scope.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(['200 g Linsen', '1 Zwiebel', '2 EL Öl'])
    const steps = scope.locator('[data-recipe-list="steps"] [data-recipe-line]')
    await expect(steps).toHaveText(['1Zwiebel würfeln', '2Linsen dazu', '3Anbraten'])
    expect(await scope.locator('[data-recipe-list="steps"] ol').count()).toBe(1)
    await expect(scope.getByRole('button', { name: 'Bearbeiten' }).first()).toBeVisible()
  }
  await read(detail)
  await expect(detail.getByRole('button', { name: 'Rezept hinzufügen' })).toHaveCount(0)

  await reloadHydrated(page)
  await read(page.getByRole('dialog', { name: 'Linsensuppe' }))
  // A Dish without one still shows nothing of it to read, and its button.
  await gotoHydrated(page, `/b/${boardId}`)
  await page.getByRole('link', { name: 'Pasta', exact: true }).click()
  const pasta = page.getByRole('dialog', { name: 'Pasta' })
  await expect(pasta.getByRole('button', { name: 'Rezept hinzufügen' })).toBeVisible()
  await expect(pasta.locator('[data-recipe-list]')).toHaveCount(0)
})

test('on a wide screen the panel becomes the editor, and leaving it with changes asks first', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 1024, height: 900 })
  const { boardId, dishes } = await sharedBoard(page, browser, 'Rezeptpanel', ['Bohnentopf'])
  expect((await page.request.patch(`/api/dishes/${dishes['Bohnentopf']}`, { data: { recipe: { ingredients: ['Bohnen'], steps: ['Kochen.'] } } })).status()).toBe(200)
  const detail = await openDish(page, boardId, 'Bohnentopf')

  await detail.getByRole('button', { name: 'Bearbeiten' }).last().click()
  // No dialog on top of the panel: its contents are the editor.
  const editor = detail.locator('[data-recipe-editor]')
  await expect(editor).toBeVisible()
  await expect(editor).toHaveAttribute('data-variant', 'panel')
  await expect(page.getByRole('dialog', { name: 'Rezept' })).toHaveCount(0)
  await expect(detail.getByRole('heading', { level: 1 })).toHaveCount(0)

  // Unchanged, Abbrechen just closes.
  await editor.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(editor).toBeHidden()
  await expect(detail.getByRole('heading', { name: 'Bohnentopf', level: 1 })).toBeVisible()

  // Changed, it asks; "Weiter bearbeiten" stays, "Verwerfen" leaves.
  await detail.getByRole('button', { name: 'Bearbeiten' }).last().click()
  await editor.getByRole('textbox', { name: 'Zutat 1' }).fill('Kidneybohnen')
  await editor.getByRole('button', { name: 'Abbrechen' }).click()
  const question = page.getByRole('dialog', { name: 'Änderungen verwerfen?' })
  await expect(question.getByText('Dein Rezept bleibt dann so, wie es vorher war.')).toBeVisible()
  await question.getByRole('button', { name: 'Weiter bearbeiten' }).click()
  await expect(question).toBeHidden()
  await expect(editor.getByRole('textbox', { name: 'Zutat 1' })).toHaveValue('Kidneybohnen')

  await page.keyboard.press('Escape')
  await expect(question).toBeVisible()
  await question.getByRole('button', { name: 'Verwerfen' }).click()
  await expect(editor).toBeHidden()
  await expect(detail.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(['Bohnen'])

  // Saved, the lines are the Recipe, and removing one can be taken back.
  await detail.getByRole('button', { name: 'Bearbeiten' }).last().click()
  await editor.getByRole('button', { name: 'Zutat hinzufügen' }).click()
  await page.keyboard.type('Lorbeer')
  await editor.getByRole('button', { name: 'Kochen. entfernen' }).click()
  await expect(page.locator('[data-toast]')).toContainText('Schritt entfernt')
  await page.locator('[data-toast]').getByRole('button', { name: 'Rückgängig' }).click()
  await expect.poll(() => fieldValues(editor, 'Schritt')).toEqual(['Kochen.'])
  await editor.getByRole('button', { name: 'Speichern' }).click()
  await expect(editor).toBeHidden()
  await expect(detail.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(['Bohnen', 'Lorbeer'])
})

test('a line is dragged by its grip with the mouse, and moved with Alt+↑/↓ from its field', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 1100, height: 900 })
  const { boardId, dishes } = await sharedBoard(page, browser, 'Rezept sortieren', ['Mohnkuchen'])
  expect((await page.request.patch(`/api/dishes/${dishes['Mohnkuchen']}`, { data: { recipe: { ingredients: ['Mohn', 'Mehl', 'Zucker', 'Butter'], steps: [] } } })).status()).toBe(200)
  const detail = await openDish(page, boardId, 'Mohnkuchen')
  await detail.getByRole('button', { name: 'Bearbeiten' }).last().click()
  const editor = detail.locator('[data-recipe-editor]')
  await expect(editor.getByRole('textbox', { name: 'Zutat 4' })).toBeVisible()

  // Grabbed at the first line's grip and let go below the third.
  const grip = await editor.getByRole('button', { name: 'Mohn verschieben' }).boundingBox()
  const third = await editor.getByRole('textbox', { name: 'Zutat 3' }).boundingBox()
  expect(grip && third).toBeTruthy()
  const x = grip!.x + grip!.width / 2
  const y = grip!.y + grip!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + 10, { steps: 3 })
  // While it is held, it is lifted and its slot is dashed.
  await expect(editor.locator('[data-recipe-edit-line].lifted')).toHaveCount(1)
  await page.mouse.move(x, third!.y + third!.height - 4, { steps: 8 })
  await page.mouse.up()
  await expect.poll(() => fieldValues(editor, 'Zutat')).toEqual(['Mehl', 'Zucker', 'Mohn', 'Butter'])
  await expect(editor.locator('[data-recipe-edit-line].lifted')).toHaveCount(0)
  await expect(editor.getByText('Mohn, jetzt an Stelle 3 von 4.')).toBeAttached()

  // A click on the grip, not a drag, opens its menu instead.
  await editor.getByRole('button', { name: 'Butter verschieben' }).click()
  await expect(editor.getByRole('menuitem', { name: 'Nach unten' })).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(editor.getByRole('menu')).toHaveCount(0)

  // From the field, Alt+↑/↓ moves the line and the cursor stays in it.
  const field = editor.getByRole('textbox', { name: 'Zutat 1' })
  await field.focus()
  await page.keyboard.press('Alt+ArrowDown')
  await expect.poll(() => fieldValues(editor, 'Zutat')).toEqual(['Zucker', 'Mehl', 'Mohn', 'Butter'])
  await expect(editor.getByRole('textbox', { name: 'Zutat 2' })).toBeFocused()
  await expect(editor.getByRole('textbox', { name: 'Zutat 2' })).toHaveValue('Mehl')
})

test('on a touch screen a line is lifted by a long press on its grip, not by a touch that moves first', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 390, height: 844 })
  const { boardId, dishes } = await sharedBoard(page, browser, 'Rezept berühren', ['Apfelkuchen'])
  expect((await page.request.patch(`/api/dishes/${dishes['Apfelkuchen']}`, { data: { recipe: { ingredients: ['Äpfel', 'Mehl', 'Zimt'], steps: [] } } })).status()).toBe(200)
  const detail = await openDish(page, boardId, 'Apfelkuchen')
  await detail.getByRole('button', { name: 'Bearbeiten' }).last().click()
  const editor = page.getByRole('dialog', { name: 'Rezept' })
  const grip = editor.getByRole('button', { name: 'Äpfel verschieben' })
  const box = (await grip.boundingBox())!
  const at = { clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 }
  // A pointer event as a finger makes it.
  const touch = (target: string, type: string, extra: Record<string, number>) => page.evaluate(([selector, kind, init]) => {
    const el = selector === 'window' ? window : document.querySelector(selector as string)!
    el.dispatchEvent(new PointerEvent(kind as string, { pointerType: 'touch', pointerId: 7, isPrimary: true, button: 0, buttons: 1, bubbles: true, cancelable: true, ...init as object }))
  }, [target, type, extra] as const)
  const lifted = editor.locator('[data-recipe-edit-line].lifted')

  // Scrolling: moves before the 300ms are up, and nothing is lifted.
  await touch('[data-recipe-grip]', 'pointerdown', at)
  await touch('window', 'pointermove', { clientX: at.clientX, clientY: at.clientY + 40 })
  await page.waitForTimeout(450)
  await expect(lifted).toHaveCount(0)
  await touch('window', 'pointerup', at)

  // Held still, it is lifted, follows the finger and drops below the second.
  await touch('[data-recipe-grip]', 'pointerdown', at)
  await expect(lifted).toHaveCount(1)
  await touch('window', 'pointermove', { clientX: at.clientX, clientY: at.clientY + 90 })
  await touch('window', 'pointerup', { clientX: at.clientX, clientY: at.clientY + 90 })
  await expect.poll(() => fieldValues(editor, 'Zutat')).toEqual(['Mehl', 'Äpfel', 'Zimt'])
  await expect(lifted).toHaveCount(0)
})

test('a Member who may not edit Dishes reads the Recipe and has no way to change it', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 390, height: 844 })
  const { boardId, dishes, member } = await sharedBoard(page, browser, 'Nur Lesen', ['Mit Rezept', 'Ohne Rezept'])
  expect((await page.request.patch(`/api/dishes/${dishes['Mit Rezept']}`, { data: { recipe: { ingredients: ['Reis'], steps: ['Kochen.'] } } })).status()).toBe(200)
  const { members } = await (await page.request.get(`/api/boards/${boardId}`)).json() as { members: { id: string, isYou: boolean }[] }
  const memberId = members.find(m => !m.isYou)!.id
  expect((await page.request.patch(`/api/boards/${boardId}/members/${memberId}/permissions`, { data: { editDishes: false } })).status()).toBe(200)

  const detail = await openDish(member, boardId, 'Mit Rezept')
  await expect(detail.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(['Reis'])
  await expect(detail.locator('[data-recipe-list="steps"] [data-recipe-line]')).toHaveText(['1Kochen.'])
  await expect(detail.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
  await expect(detail.locator('[data-edit-recipe]')).toHaveCount(0)

  // No Recipe: nothing at all, not even a gap.
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await member.getByRole('link', { name: 'Ohne Rezept', exact: true }).click()
  const empty = member.getByRole('dialog', { name: 'Ohne Rezept' })
  await expect(empty.getByRole('heading', { name: 'Ohne Rezept', level: 1 })).toBeVisible()
  await expect(empty.locator('[data-recipe-section]')).toHaveCount(0)
  await expect(empty.getByRole('button', { name: 'Rezept hinzufügen' })).toHaveCount(0)
})

// The write gets no answer while everything else does, the way
// offline.spec.ts keeps a Gekocht ✓ unsent with a connection.
const EDIT_DISH = (url: URL) => /^\/api\/dishes\/[^/]+$/.test(url.pathname)

test('a Recipe edited while malkochen does not answer is marked unsent, survives a reload and arrives once it answers', async ({ page, browser }) => {
  test.slow()
  await page.setViewportSize({ width: 390, height: 844 })
  const { boardId, dishes, member } = await sharedBoard(page, browser, 'Rezept unterwegs', ['Kürbissuppe'])
  const detail = await openDish(page, boardId, 'Kürbissuppe')
  await openDish(member, boardId, 'Kürbissuppe')

  await page.route(EDIT_DISH, route => route.request().method() === 'PATCH' ? route.abort('connectionrefused') : route.continue())
  await detail.getByRole('button', { name: 'Rezept hinzufügen' }).click()
  const editor = page.getByRole('dialog', { name: 'Rezept' })
  await page.keyboard.type('1 Hokkaido')
  await editor.getByRole('button', { name: 'Schritt hinzufügen' }).click()
  await page.keyboard.type('Weich kochen und pürieren.')
  await editor.getByRole('button', { name: 'Speichern' }).click()

  // It shows at once, marked, and the bar counts it.
  await expect(editor).toBeHidden()
  await expect(detail.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(['1 Hokkaido'])
  const mark = detail.locator('[data-recipe-unsent]')
  await expect(mark).toHaveText('Noch nicht gesendet')
  await expect(page.locator('[data-offline-bar]').filter({ hasText: '1 noch nicht gesendet' })).toBeVisible()
  const onServer = async () => {
    const board = await (await member.request.get(`/api/boards/${boardId}`)).json() as { columns: { dishes: { id: string, recipe: unknown }[] }[] }
    return board.columns.flatMap(c => c.dishes).find(d => d.id === dishes['Kürbissuppe'])?.recipe
  }
  expect(await onServer()).toBeNull()

  // Kept on the device through a reload.
  await reloadHydrated(page)
  const again = page.getByRole('dialog', { name: 'Kürbissuppe' })
  await expect(again.locator('[data-recipe-list="ingredients"] [data-recipe-line]')).toHaveText(['1 Hokkaido'])
  await expect(again.locator('[data-recipe-unsent]')).toBeVisible()

  await page.unroute(EDIT_DISH)
  await expect(again.locator('[data-recipe-unsent]')).toBeHidden({ timeout: 15_000 })
  await expect.poll(onServer, { timeout: 15_000 }).toEqual({ ingredients: ['1 Hokkaido'], steps: ['Weich kochen und pürieren.'], link: null })
  // And it reaches the other Member's open detail by itself.
  const theirs = member.getByRole('dialog', { name: 'Kürbissuppe' })
  await expect(theirs.locator('[data-recipe-list="steps"] [data-recipe-line]')).toHaveText(['1Weich kochen und pürieren.'], { timeout: 15_000 })
})
