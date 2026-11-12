import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { addDays, weekDays, weekStart } from '../../app/board/week-days'
import { de } from '../../app/strings/de'
import { signIn } from './auth'
import { column, titles } from './board'
import { confetti, gekochtPill } from './celebration'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { removeUsers } from './seed'
import { addDish, boardMembers, dayList, mouseDrag, newBoard, nextMonday, planOn, plannedTitles, seedCookingDaysAgo, setCook, today } from './week'

// The Week Plan view (#517; CONTEXT.md: Week Plan, Planned Dish): the switch
// to it, the week and browsing it, planning with "+", moving, reordering and
// taking off the plan, and what a Member without the Permission to move
// Dishes sees; then (#518) "Einplanen" in the Dish detail, who cooks, and
// "Gekocht ✓" with the tick. The owner owns the Boards, the Member joins one.
// Both are used by this file only.
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

// "Einplanen" in the Dish detail (#518).
test('"Einplanen" in the Dish detail plans the Dish on the chosen day, today or in a later week, with "Rückgängig"', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wocheneinplaner')
  await addDish(page, boardId, 'Linsensuppe')
  await gotoHydrated(page, `/b/${boardId}`)

  await page.getByRole('link', { name: 'Linsensuppe' }).first().click()
  const detail = page.getByRole('dialog', { name: 'Linsensuppe' })
  await expect(detail).toBeVisible()
  // First in the share row.
  await expect(detail.locator('[data-share-actions]').getByRole('button')).toHaveText([/Einplanen/, /Link teilen/, /Kopieren/])

  await detail.getByRole('button', { name: 'Einplanen' }).click()
  const picker = page.getByRole('dialog', { name: 'An welchem Tag?' })
  await expect(picker).toBeVisible()
  // From today on: past days of the week are not offered.
  await expect(picker.locator('[data-pick-day]')).toHaveCount(weekDays(today()).filter(day => day >= today()).length)
  await expect(picker.locator(`[data-pick-day="${today()}"]`)).toContainText('Heute')
  await picker.locator(`[data-pick-day="${today()}"]`).click()
  await expect(picker).toBeHidden()
  await expect(page.getByText('Für heute eingeplant.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toBeVisible()
  // The detail shows nothing of the plan.
  await expect(detail.getByText(/eingeplant/)).toHaveCount(0)

  // A day of a later week: ‹ is off on this week, › reaches the next.
  await detail.getByRole('button', { name: 'Einplanen' }).click()
  await expect(picker.getByRole('button', { name: 'Vorherige Woche' })).toBeDisabled()
  await picker.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(picker.locator('[data-pick-day]')).toHaveCount(7)
  const monday = nextMonday()
  await picker.locator(`[data-pick-day="${monday}"]`).click()
  const later = `Für ${de.week.dayName(monday)} eingeplant.`
  await expect(page.getByText(later)).toBeVisible()
  await page.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(page.getByText(later)).toBeHidden()

  // On the Week Plan: today's plan stayed, the undone one is gone.
  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await radio(page, 'Woche').click()
  await expect(plannedTitles(dayOf(page, today()))).toHaveText(['Linsensuppe'])
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  await expect(plannedTitles(dayOf(page, monday))).toHaveCount(0)
  // The Dish stays in its Column.
  await radio(page, 'Spalten').click()
  await expect(titles(page, 'Ideen')).toHaveText(['Linsensuppe'])
})

test('a Member who may not move Dishes has no "Einplanen", no way to set who cooks and no "Gekocht ✓"; one who may, has them', async ({ page, browser }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenrechte')
  const token = await inviteToken(page, boardId)
  const dishId = await addDish(page, boardId, 'Erbseneintopf')
  const plannedId = await planOn(page, boardId, dishId, today())

  const radia = await newTab(browser)
  await radia.setViewportSize(DESKTOP)
  await signIn(radia, MEMBER)
  expect((await radia.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  const radiaId = (await boardMembers(page, boardId)).find(m => !m.isYou)!.id
  await setCook(page, plannedId, radiaId)
  const permit = async (moveDishes: boolean) =>
    expect((await page.request.patch(`/api/boards/${boardId}/members/${radiaId}/permissions`, { data: { moveDishes } })).status()).toBe(200)

  await permit(false)
  await openWeek(radia, boardId)
  const card = radia.locator('[data-planned-card]').filter({ hasText: 'Erbseneintopf' })
  // The cook shows, and opens nothing; no "Gekocht ✓", no "⋯".
  await expect(card.locator('[data-planned-cook]')).toBeVisible()
  await expect(card.locator('button[data-planned-cook]')).toHaveCount(0)
  await card.locator('[data-planned-cook]').click({ force: true })
  await expect(radia.getByRole('dialog', { name: 'Wer kocht?' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: 'Gekocht ✓' })).toHaveCount(0)
  await expect(card.getByRole('button', { name: /^Mehr zu / })).toHaveCount(0)
  await card.getByRole('link').click()
  const detail = radia.getByRole('dialog', { name: 'Erbseneintopf' })
  await expect(detail.getByRole('button', { name: 'Link teilen' })).toBeVisible()
  await expect(detail.getByRole('button', { name: 'Einplanen' })).toHaveCount(0)

  await permit(true)
  await reloadHydrated(radia)
  await expect(detail.getByRole('button', { name: 'Einplanen' })).toBeVisible()
  await radia.keyboard.press('Escape')
  const allowed = radia.locator('[data-planned-card]').filter({ hasText: 'Erbseneintopf' })
  await expect(allowed.locator('button[data-planned-cook]')).toBeVisible()
  await expect(allowed.getByRole('button', { name: 'Gekocht ✓' })).toBeVisible()
})

// Who cooks (#518).
test('who cooks is set, changed and cleared from the Board\'s Members, shows as their Profile Picture, and another Member sees it', async ({ page, browser }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenkoch')
  const token = await inviteToken(page, boardId)
  const dishId = await addDish(page, boardId, 'Linsensuppe')
  await planOn(page, boardId, dishId, today())

  const radia = await newTab(browser)
  await radia.setViewportSize(DESKTOP)
  await signIn(radia, MEMBER)
  expect((await radia.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  const members = await boardMembers(page, boardId)
  const me = members.find(m => m.isYou)!
  const other = members.find(m => !m.isYou)!

  await openWeek(page, boardId)
  const card = page.locator('[data-planned-card]').filter({ hasText: 'Linsensuppe' })
  // Nobody by default, and that looks fine.
  await expect(card.locator('[data-planned-cook]')).toHaveCount(0)

  // Set, from the menu.
  await card.getByRole('button', { name: 'Mehr zu Linsensuppe' }).click()
  await page.getByRole('dialog', { name: 'Linsensuppe' }).getByRole('menuitem', { name: 'Wer kocht?' }).click()
  const picker = page.getByRole('dialog', { name: 'Wer kocht?' })
  await expect(picker).toContainText(`Linsensuppe am ${de.week.weekday(today())}`)
  await expect(picker.getByRole('radio')).toHaveCount(3)
  await expect(picker.getByRole('radio', { name: 'Offen lassen' })).toBeChecked()
  await expect(picker.getByRole('radio', { name: new RegExp(`${me.name}.*du`) })).toBeVisible()
  await picker.getByRole('radio', { name: other.name }).click()
  await expect(picker).toBeHidden()
  await expect(card.getByRole('button', { name: `Kocht: ${other.name}. Ändern` })).toBeVisible()
  await expect(card.getByRole('link')).toHaveAttribute('aria-label', `Linsensuppe, ${de.week.weekday(today())}, kocht ${other.name}`)
  await expect(page.getByTestId('week-live')).toHaveText(`${other.name} kocht jetzt.`)
  // No toast for it.
  await expect(page.getByRole('button', { name: 'Rückgängig' })).toHaveCount(0)

  // Another Member sees it, after a reload.
  await openWeek(radia, boardId)
  await expect(radia.locator('[data-planned-card]').filter({ hasText: 'Linsensuppe' }).getByRole('button', { name: `Kocht: ${other.name}. Ändern` })).toBeVisible()
  await reloadHydrated(page)
  await expect(weekPlan(page)).toBeVisible()
  await expect(card.getByRole('button', { name: `Kocht: ${other.name}. Ändern` })).toBeVisible()

  // Changed, from the picture itself.
  await card.getByRole('button', { name: `Kocht: ${other.name}. Ändern` }).click()
  await expect(picker.getByRole('radio', { name: other.name })).toBeChecked()
  await picker.getByRole('radio', { name: new RegExp(`${me.name}.*du`) }).click()
  await expect(card.getByRole('button', { name: `Kocht: ${me.name}. Ändern` })).toBeVisible()
  await expect(card.locator('[data-planned-cook]')).toHaveCount(1)

  // Cleared.
  await card.getByRole('button', { name: `Kocht: ${me.name}. Ändern` }).click()
  await picker.getByRole('radio', { name: 'Offen lassen' }).click()
  await expect(card.locator('[data-planned-cook]')).toHaveCount(0)
  await expect(page.getByTestId('week-live')).toHaveText('Niemand kocht mehr fest.')
  await reloadHydrated(page)
  await expect(weekPlan(page)).toBeVisible()
  await expect(card.locator('[data-planned-cook]')).toHaveCount(0)
})

// "Gekocht ✓" from the plan, and the tick (#518).
test('"Gekocht ✓" on today\'s Planned Dish records the Cooking, moves the Dish into Gekocht, celebrates and ticks; undo unticks', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochenkochen')
  const soup = await addDish(page, boardId, 'Linsensuppe')
  const salad = await addDish(page, boardId, 'Fenchelsalat')
  await planOn(page, boardId, soup, today())
  await planOn(page, boardId, salad, nextMonday())
  await openWeek(page, boardId)

  const card = page.locator('[data-planned-card]').filter({ hasText: 'Linsensuppe' })
  const cookButton = card.getByRole('button', { name: 'Gekocht ✓' })
  await expect(cookButton).toBeVisible()
  await expect(card.locator('[data-cooked-tick]')).toHaveCount(0)

  // Not on another day's.
  await page.getByRole('button', { name: 'Nächste Woche' }).click()
  const later = page.locator('[data-planned-card]').filter({ hasText: 'Fenchelsalat' })
  await expect(later).toBeVisible()
  await expect(later.getByRole('button', { name: 'Gekocht ✓' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Heute' }).first().click()
  await expect(card).toBeVisible()

  await cookButton.click()
  // The celebration: confetti, the pill with Topfbert, the toast with its actions.
  await expect(confetti(page).first()).toBeAttached()
  await expect(gekochtPill(page)).toBeVisible()
  const toast = page.getByRole('status').filter({ hasText: 'Gekocht ✓' })
  await expect(toast.getByRole('button', { name: 'Rückgängig' })).toBeVisible()
  await expect(toast.getByRole('button', { name: 'Kommentieren' })).toBeVisible()
  // The tick, and the Planned Dish stays on its day.
  await expect(card.locator('[data-cooked-tick]')).toBeVisible()
  await expect(card.getByRole('link')).toHaveAttribute('aria-label', `Linsensuppe, ${de.week.weekday(today())}, gekocht`)
  await expect(plannedTitles(dayOf(page, today()))).toHaveText(['Linsensuppe'])
  // No second Cooking from the button while it lingers.
  await expect(card.locator('[data-cook-action]')).toHaveAttribute('inert', '')
  // The Dish went into Gekocht.
  await radio(page, 'Spalten').click()
  await expect(titles(page, 'Gekocht')).toHaveText(['Linsensuppe'])
  await expect(column(page, 'Gekocht').getByText('1× gekocht')).toBeVisible()
  await radio(page, 'Woche').click()

  // Undo: the Cooking goes, the tick fades, the button comes back.
  await toast.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(card.locator('[data-cooked-tick]')).toHaveCount(0)
  await expect(cookButton).toBeVisible()
  await radio(page, 'Spalten').click()
  await expect(titles(page, 'Ideen')).toContainText(['Linsensuppe'])
  await expect(titles(page, 'Gekocht')).toHaveCount(0)
  await radio(page, 'Woche').click()

  // Again: once cooked, the button goes after a moment; the tick stays, also after a reload.
  await cookButton.click()
  await expect(card.locator('[data-cooked-tick]')).toBeVisible()
  await expect(cookButton).toHaveCount(0, { timeout: 8000 })
  await expect(card.locator('[data-cooked-tick]')).toBeVisible()
  await reloadHydrated(page)
  await expect(weekPlan(page)).toBeVisible()
  await expect(card.locator('[data-cooked-tick]')).toBeVisible()
  await expect(cookButton).toHaveCount(0)
})

test('a Cooking recorded anywhere ticks the Planned Dish of that day: from the card today, and a past day\'s too', async ({ page }) => {
  await page.setViewportSize(DESKTOP)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochentick')
  const stew = await addDish(page, boardId, 'Bohneneintopf')
  const rice = await addDish(page, boardId, 'Reispfanne')
  await planOn(page, boardId, stew, today())
  const past = addDays(today(), -2)
  await planOn(page, boardId, rice, past)
  await seedCookingDaysAgo(boardId, 'Reispfanne', 2)
  await gotoHydrated(page, `/b/${boardId}`)

  // From the card in the Columns.
  await page.getByRole('button', { name: 'Gekocht ✓: „Bohneneintopf“' }).click()
  await expect(titles(page, 'Gekocht')).toHaveText(['Bohneneintopf'])
  await radio(page, 'Woche').click()
  const todays = page.locator('[data-planned-card]').filter({ hasText: 'Bohneneintopf' })
  await expect(todays.locator('[data-cooked-tick]')).toBeVisible()
  await expect(todays.getByRole('button', { name: 'Gekocht ✓' })).toHaveCount(0, { timeout: 8000 })

  // A Cooking two days ago ticks the Planned Dish on that day, and it has no button.
  if (weekStart(past) !== weekStart(today())) await page.getByRole('button', { name: 'Vorherige Woche' }).click()
  const earlier = page.locator('[data-planned-card]').filter({ hasText: 'Reispfanne' })
  await expect(plannedTitles(dayOf(page, past))).toHaveText(['Reispfanne'])
  await expect(earlier.locator('[data-cooked-tick]')).toBeVisible()
  await expect(earlier.getByRole('button', { name: 'Gekocht ✓' })).toHaveCount(0)
})

test('on a phone, today\'s Planned Dish is taller with "Gekocht ✓" and shortens once cooked; the cook is set from the cook picker sheet', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, OWNER)
  const boardId = await newBoard(page, 'Wochentelefonkochen')
  const dishId = await addDish(page, boardId, 'Gemüsepfanne')
  await planOn(page, boardId, dishId, today())
  const me = (await boardMembers(page, boardId)).find(m => m.isYou)!
  await openWeek(page, boardId)

  const card = page.locator('[data-planned-card]').filter({ hasText: 'Gemüsepfanne' })
  await expect(card).toBeVisible()
  expect((await card.boundingBox())!.height).toBeGreaterThan(90)

  await card.getByRole('button', { name: 'Mehr zu Gemüsepfanne' }).click()
  await page.getByRole('dialog', { name: 'Gemüsepfanne' }).getByRole('menuitem', { name: 'Wer kocht?' }).click()
  await page.getByRole('dialog', { name: 'Wer kocht?' }).getByRole('radio', { name: new RegExp(me.name) }).click()
  await expect(card.getByRole('button', { name: `Kocht: ${me.name}. Ändern` })).toBeVisible()

  await card.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(card.locator('[data-cooked-tick]')).toBeVisible()
  await expect(card.getByRole('button', { name: 'Gekocht ✓' })).toHaveCount(0, { timeout: 8000 })
  await expect.poll(async () => (await card.boundingBox())!.height, { timeout: 5000 }).toBeLessThan(75)
  // The cook stays.
  await expect(card.getByRole('button', { name: `Kocht: ${me.name}. Ändern` })).toBeVisible()
})
