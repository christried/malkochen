import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { addDays, weekDays, weekStart } from '../../app/board/week-days'
import { de } from '../../app/strings/de'
import { signIn } from './auth'
import { titles } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { removeUsers } from './seed'
import { addDish, dayList, mouseDrag, newBoard, nextMonday, planOn, plannedTitles, today } from './week'

// The Week Plan view (#517; CONTEXT.md: Week Plan, Planned Dish): the switch
// to it, the week and browsing it, planning with "+", moving, reordering and
// taking off the plan, and what a Member without the Permission to move
// Dishes sees. The owner owns the Boards, the Member joins one. Both are used by this
// file only.
test.describe.configure({ mode: 'serial' })

const OWNER = ALLOWLISTED[232]
const MEMBER = ALLOWLISTED[233]
const DESKTOP = { width: 1280, height: 900 }
const PHONE = { width: 390, height: 844 }

test.beforeAll(() => removeUsers(OWNER, MEMBER))

const radio = (page: Page, name: string) => page.getByRole('radio', { name })
const weekPlan = (page: Page) => page.getByTestId('week-plan')

async function openWeek(page: Page, boardId: string) {
  await gotoHydrated(page, `/b/${boardId}`)
  await radio(page, 'Woche').click()
  await expect(weekPlan(page)).toBeVisible()
}

// The list of a day on the open week, by its name ("Montag, 23. November").
const dayOf = (page: Page, day: string) => dayList(page, de.week.dayName(day))

test('the switch shows the Week Plan and the Columns, and the choice survives a reload', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenküche')
  await addDish(page, boardId, 'Linsensuppe')
  await gotoHydrated(page, `/b/${boardId}`)

  await expect(radio(page, 'Spalten')).toBeChecked()
  await expect(page.getByTestId('columns')).toBeVisible()
  await expect(weekPlan(page)).toBeHidden()
  // The Dish button is for the Columns.
  await expect(page.getByRole('button', { name: 'Gericht hinzufügen' })).toBeVisible()

  await radio(page, 'Woche').click()
  await expect(radio(page, 'Woche')).toBeChecked()
  await expect(weekPlan(page)).toBeVisible()
  await expect(page.getByTestId('columns')).toBeHidden()
  await expect(page.getByRole('button', { name: 'Gericht hinzufügen' })).toBeHidden()

  await reloadHydrated(page)
  await expect(radio(page, 'Woche')).toBeChecked()
  await expect(weekPlan(page)).toBeVisible()
  await expect(page.getByTestId('columns')).toBeHidden()

  // The other way: with ← and →, and the Columns come back after a reload too.
  await radio(page, 'Woche').press('ArrowLeft')
  await expect(radio(page, 'Spalten')).toBeChecked()
  await expect(titles(page, 'Ideen')).toHaveText(['Linsensuppe'])
  await reloadHydrated(page)
  await expect(radio(page, 'Spalten')).toBeChecked()
  await expect(page.getByTestId('columns')).toBeVisible()
})

test('the current week opens with today marked, and earlier and later weeks are browsed and left in one step', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenblick')
  await openWeek(page, boardId)

  const monday = weekStart(today())
  const title = page.getByTestId('week-title')
  await expect(title).toHaveText(de.week.title(monday))
  await expect(page.locator('[data-today]')).toHaveCount(1)
  await expect(page.locator('[data-today]')).toContainText('Heute')
  await expect(dayOf(page, today())).toBeAttached()
  await expect(page.getByRole('button', { name: 'Heute' })).toHaveCount(0)
  // An empty week says so and offers a Dish; "+" is only on today and the days to come.
  await expect(page.getByTestId('empty-week')).toContainText('Die Woche ist noch frei.')
  const daysToCome = weekDays(today()).filter(day => day >= today()).length
  await expect(page.getByRole('button', { name: /^Gericht für \S+ einplanen$/ })).toHaveCount(daysToCome)

  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(title).toHaveText(de.week.title(addDays(monday, 7)))
  await expect(page.locator('[data-today]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Gericht für \S+ einplanen$/ })).toHaveCount(7)
  await expect(page.getByRole('button', { name: 'Heute' })).toBeVisible()

  await page.getByRole('button', { name: 'Vorherige Woche' }).click()
  await page.getByRole('button', { name: 'Vorherige Woche' }).click()
  await expect(title).toHaveText(de.week.title(addDays(monday, -7)))
  // Past days stay as planned: nothing new can go on them.
  await expect(page.getByRole('button', { name: /^Gericht für \S+ einplanen$/ })).toHaveCount(0)
  await expect(page.getByTestId('empty-week')).toContainText('In dieser Woche war nichts geplant.')

  await page.getByRole('button', { name: 'Heute' }).click()
  await expect(title).toHaveText(de.week.title(monday))
  await expect(page.getByRole('button', { name: 'Heute' })).toHaveCount(0)
  await expect(page.locator('[data-today]')).toHaveCount(1)

  // ← and → browse with the keyboard, T goes back.
  await page.getByRole('button', { name: 'Vorherige Woche' }).press('ArrowRight')
  await expect(title).toHaveText(de.week.title(addDays(monday, 7)))
  await page.getByRole('button', { name: 'Vorherige Woche' }).press('t')
  await expect(title).toHaveText(de.week.title(monday))
})

test('"+" plans a Dish from a searchable picker without Archived Dishes, on today and in a later week', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenplanung')
  await addDish(page, boardId, 'Linsensuppe')
  await addDish(page, boardId, 'Kichererbsencurry')
  const archived = await addDish(page, boardId, 'Altes Risotto')
  expect((await page.request.delete(`/api/dishes/${archived}`)).status()).toBe(204)
  await openWeek(page, boardId)

  // The empty week's button opens the picker for today.
  await page.getByRole('button', { name: 'Gericht aussuchen' }).click()
  const picker = page.getByRole('dialog', { name: 'Was gibt es heute?' })
  await expect(picker).toBeVisible()
  // Every Dish of the Board, in the groups of its Columns; not the Archived one.
  await expect(picker.getByRole('button', { name: /Linsensuppe/ })).toBeVisible()
  await expect(picker.getByRole('button', { name: /Kichererbsencurry/ })).toBeVisible()
  await expect(picker.getByText('Altes Risotto')).toHaveCount(0)
  await expect(picker.getByRole('region', { name: 'Ideen' })).toBeVisible()
  await expect(picker.getByRole('region', { name: 'Gekocht' })).toHaveCount(0)

  await picker.getByLabel('Gericht suchen').fill('kicher')
  await expect(picker.getByRole('button', { name: /Kichererbsencurry/ })).toBeVisible()
  await expect(picker.getByRole('button', { name: /Linsensuppe/ })).toHaveCount(0)
  await picker.getByLabel('Gericht suchen').fill('xyz')
  await expect(picker.getByTestId('picker-empty')).toHaveText('Kein Gericht mit „xyz“ auf diesem Board.')
  await picker.getByLabel('Gericht suchen').fill('suppe')
  await picker.getByRole('button', { name: /Linsensuppe/ }).click()

  await expect(picker).toBeHidden()
  await expect(plannedTitles(dayOf(page, today()))).toHaveText(['Linsensuppe'])
  await expect(page.getByTestId('empty-week')).toHaveCount(0)
  // Planning from "+" says nothing: it lands in view.
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0)
  // The Dish stays in its Column.
  await expect(plannedTitles(dayOf(page, today())).first()).toHaveAttribute('aria-label', `Linsensuppe, ${de.week.weekday(today())}`)

  // The same Dish on another day of a later week, from that day's "+".
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  const monday = nextMonday()
  await page.getByRole('button', { name: 'Gericht für Montag einplanen' }).click()
  const later = page.getByRole('dialog', { name: `Was gibt es am ${de.week.dayName(monday)}?` })
  await later.getByRole('button', { name: /Linsensuppe/ }).click()
  await expect(plannedTitles(dayOf(page, monday))).toHaveText(['Linsensuppe'])

  await reloadHydrated(page)
  await expect(weekPlan(page)).toBeVisible()
  await expect(plannedTitles(dayOf(page, today()))).toHaveText(['Linsensuppe'])
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(plannedTitles(dayOf(page, monday))).toHaveText(['Linsensuppe'])

  // A Planned Dish opens the Dish's detail.
  await plannedTitles(dayOf(page, monday)).first().click()
  await expect(page.getByRole('dialog', { name: 'Linsensuppe' })).toBeVisible()
})

test('Planned Dishes are reordered, moved between days and taken off the plan, with "Rückgängig"', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenumbau')
  const monday = nextMonday()
  const [tuesday, wednesday] = [addDays(monday, 1), addDays(monday, 2)]
  const dishes: Record<string, string> = {}
  for (const title of ['Aprikosentarte', 'Bohneneintopf', 'Couscous', 'Dal']) dishes[title] = await addDish(page, boardId, title)
  await planOn(page, boardId, dishes.Aprikosentarte!, monday)
  await planOn(page, boardId, dishes.Bohneneintopf!, monday)
  await planOn(page, boardId, dishes.Couscous!, tuesday)
  await planOn(page, boardId, dishes.Dal!, tuesday)
  await openWeek(page, boardId)
  await page.getByRole('button', { name: 'Nächste Woche' }).click()

  const mondayList = dayOf(page, monday)
  const tuesdayList = dayOf(page, tuesday)
  await expect(plannedTitles(mondayList)).toHaveText(['Aprikosentarte', 'Bohneneintopf'])
  await expect(plannedTitles(tuesdayList)).toHaveText(['Couscous', 'Dal'])

  // Within a day, from the menu: down on the first, up on the second.
  const more = (title: string) => page.getByRole('button', { name: `Mehr zu ${title}` })
  await more('Aprikosentarte').click()
  const menu = page.getByRole('dialog', { name: 'Aprikosentarte' })
  await expect(menu.getByRole('menuitem', { name: 'Nach oben' })).toBeDisabled()
  await menu.getByRole('menuitem', { name: 'Nach unten' }).click()
  await expect(plannedTitles(mondayList)).toHaveText(['Bohneneintopf', 'Aprikosentarte'])
  await expect(more('Aprikosentarte')).toBeFocused()
  await expect(page.getByTestId('week-live')).toHaveText(`Aprikosentarte, jetzt am Montag an Stelle 2 von 2.`)

  // With the keyboard: Alt and the arrows.
  await plannedTitles(mondayList).nth(1).focus()
  await page.keyboard.press('Alt+ArrowUp')
  await expect(plannedTitles(mondayList)).toHaveText(['Aprikosentarte', 'Bohneneintopf'])
  await page.keyboard.press('Alt+ArrowRight')
  await expect(plannedTitles(mondayList)).toHaveText(['Bohneneintopf'])
  await expect(plannedTitles(tuesdayList)).toHaveText(['Couscous', 'Dal', 'Aprikosentarte'])
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(plannedTitles(mondayList)).toHaveText(['Aprikosentarte', 'Bohneneintopf'])

  // To another day, from the menu's day picker.
  await more('Bohneneintopf').click()
  await page.getByRole('dialog', { name: 'Bohneneintopf' }).getByRole('menuitem', { name: 'Auf anderen Tag legen' }).click()
  const days = page.getByRole('dialog', { name: 'Auf anderen Tag legen' })
  await expect(days.locator(`[data-pick-day="${monday}"]`)).toContainText('Liegt hier')
  await days.locator(`[data-pick-day="${wednesday}"]`).click()
  await expect(plannedTitles(dayOf(page, wednesday))).toHaveText(['Bohneneintopf'])
  await expect(plannedTitles(mondayList)).toHaveText(['Aprikosentarte'])
  await expect(page.getByText(`Auf ${de.week.dayName(wednesday)} gelegt.`)).toBeVisible()
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(plannedTitles(mondayList)).toHaveText(['Aprikosentarte', 'Bohneneintopf'])
  await expect(plannedTitles(dayOf(page, wednesday))).toHaveCount(0)

  // By dragging with the mouse: within a day, and into another day's column.
  const dal = page.locator('[data-planned-id]').filter({ has: page.getByRole('link', { name: 'Dal, Dienstag' }) })
  const couscous = page.locator('[data-planned-id]').filter({ has: page.getByRole('link', { name: 'Couscous, Dienstag' }) })
  const lower = (await dal.boundingBox())!
  await mouseDrag(page, couscous, { x: lower.x + lower.width / 2, y: lower.y + lower.height * 0.9 })
  await expect(plannedTitles(tuesdayList)).toHaveText(['Dal', 'Couscous'])
  const into = (await page.locator(`[data-day="${wednesday}"]`).boundingBox())!
  await mouseDrag(page, page.locator('[data-planned-id]').filter({ has: page.getByRole('link', { name: 'Dal, Dienstag' }) }), { x: into.x + into.width / 2, y: into.y + 120 })
  await expect(plannedTitles(dayOf(page, wednesday))).toHaveText(['Dal'])
  await expect(plannedTitles(tuesdayList)).toHaveText(['Couscous'])
  await expect(page.getByText(`Auf ${de.week.dayName(wednesday)} gelegt.`)).toBeVisible()
  // A drag opens no Dish.
  await expect(page.getByRole('dialog', { name: 'Dal' })).toHaveCount(0)

  // Taking one off the plan leaves the Dish on the Board.
  await more('Couscous').click()
  await page.getByRole('dialog', { name: 'Couscous' }).getByRole('menuitem', { name: 'Aus dem Plan nehmen' }).click()
  await expect(plannedTitles(tuesdayList)).toHaveCount(0)
  await expect(page.getByText('Aus dem Plan genommen.')).toBeVisible()
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(plannedTitles(tuesdayList)).toHaveText(['Couscous'])
  await more('Couscous').click()
  await page.getByRole('dialog', { name: 'Couscous' }).getByRole('menuitem', { name: 'Aus dem Plan nehmen' }).click()
  await expect(plannedTitles(tuesdayList)).toHaveCount(0)
  await radio(page, 'Spalten').click()
  await expect(titles(page, 'Ideen')).toContainText(['Couscous'])
})

test('planned offline, a Planned Dish shows at once marked "Noch nicht gesendet", and the mark goes once it is sent', async ({ page, context }) => {
  test.slow()
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenpause')
  await addDish(page, boardId, 'Linsensuppe')
  await openWeek(page, boardId)

  await context.setOffline(true)
  await page.getByRole('button', { name: `Gericht für ${de.week.weekday(today())} einplanen` }).click()
  await page.getByRole('dialog', { name: 'Was gibt es heute?' }).getByRole('button', { name: /Linsensuppe/ }).click()
  const card = page.locator('[data-planned-card]').filter({ hasText: 'Linsensuppe' })
  await expect(card).toBeVisible()
  await expect(card.getByText('Noch nicht gesendet')).toBeVisible()

  await context.setOffline(false)
  await expect(card.getByText('Noch nicht gesendet')).toHaveCount(0, { timeout: 15_000 })
  await reloadHydrated(page)
  await expect(plannedTitles(dayOf(page, today()))).toHaveText(['Linsensuppe'])
})

test('without the Permission to move Dishes, a Member sees the plan but has no way to change it', async ({ page, browser }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenzuschauer')
  const token = await inviteToken(page, boardId)
  const monday = nextMonday()
  const first = await addDish(page, boardId, 'Erbseneintopf')
  const second = await addDish(page, boardId, 'Fenchelsalat')
  await planOn(page, boardId, first, monday)
  await planOn(page, boardId, second, monday)

  const radia = await newTab(browser)
  await radia.setViewportSize(DESKTOP)
  await signIn(radia, MEMBER)
  expect((await radia.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  const { members } = await (await page.request.get(`/api/boards/${boardId}`)).json() as { members: { id: string, isYou: boolean }[] }
  const radiaId = members.find(m => !m.isYou)!.id
  expect((await page.request.patch(`/api/boards/${boardId}/members/${radiaId}/permissions`, { data: { moveDishes: false } })).status()).toBe(200)

  await openWeek(radia, boardId)
  await radia.getByRole('button', { name: 'Nächste Woche' }).click()
  const list = dayOf(radia, monday)
  await expect(plannedTitles(list)).toHaveText(['Erbseneintopf', 'Fenchelsalat'])
  await expect(radia.getByRole('button', { name: /^Gericht für \S+ einplanen$/ })).toHaveCount(0)
  await expect(radia.getByRole('button', { name: /^Mehr zu / })).toHaveCount(0)
  // Dragging picks nothing up.
  const target = (await radia.locator(`[data-day="${addDays(monday, 2)}"]`).boundingBox())!
  const from = (await plannedTitles(list).first().boundingBox())!
  await radia.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await radia.mouse.down()
  await radia.mouse.move(target.x + target.width / 2, target.y + 150, { steps: 10 })
  await expect(radia.getByTestId('drag-planned')).toHaveCount(0)
  await radia.mouse.up()
  await radia.keyboard.press('Alt+ArrowDown')
  await expect(plannedTitles(list)).toHaveText(['Erbseneintopf', 'Fenchelsalat'])
  await expect(plannedTitles(dayOf(radia, addDays(monday, 2)))).toHaveCount(0)
  // Reading goes on: the Dish opens.
  await plannedTitles(list).first().click()
  await expect(radia.getByRole('dialog', { name: 'Erbseneintopf' })).toBeVisible()
})

test('on a phone the switch has its own row, the week opens on today with "+" in each day, and "Heute" floats after browsing', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochentelefon')
  await addDish(page, boardId, 'Gemüsepfanne')
  await openWeek(page, boardId)

  await expect(page.locator('[data-today]')).toBeInViewport()
  await expect(page.getByTestId('empty-week')).toBeVisible()
  // The Dish button is hidden here; the day's "+" is the way to add.
  await expect(page.getByRole('button', { name: 'Gericht hinzufügen' })).toBeHidden()
  await page.getByRole('button', { name: `Gericht für ${de.week.weekday(today())} einplanen` }).click()
  const sheet = page.getByRole('dialog', { name: 'Was gibt es heute?' })
  await sheet.getByRole('button', { name: /Gemüsepfanne/ }).click()
  await expect(sheet).toBeHidden()
  await expect(plannedTitles(dayOf(page, today()))).toHaveText(['Gemüsepfanne'])

  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  const floating = page.getByRole('button', { name: 'Heute' })
  await expect(floating).toBeVisible()
  await floating.click()
  await expect(page.getByTestId('week-title')).toHaveText(de.week.title(weekStart(today())))
  await expect(floating).toHaveCount(0)
})
