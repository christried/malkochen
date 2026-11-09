import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { startSnackbertService, type SnackbertSentReport, type SnackbertService } from '../support/snackbert-service'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { removeUsers, seedCookings, seedDish } from './seed'
import { openUserSettings } from './settings-sheet'

// Snackbert in your settings (#423): a section only for people with a
// Snackbert account, with its consent and a link to the privacy policy, and
// the switch. The account check, the switch's rules and the Event Log are
// covered by tests/api/snackbert.test.ts. Sending a Snackbert Report from the
// Dish History (#424) is here too; what the server does with one is covered
// by tests/api/snackbert-reports.test.ts. On a computer only: the phone shows
// the same sheets as dialogs and bottom sheets. These users are used by this
// file only.
const WITH_ACCOUNT = ALLOWLISTED[176]
const WITHOUT_ACCOUNT = ALLOWLISTED[177]
const REPORTER = ALLOWLISTED[194]
const SNACKBERT_OFF = ALLOWLISTED[195]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

let snackbert: SnackbertService

test.beforeAll(async () => {
  // CI's retry runs the whole file again, on the same database.
  await removeUsers(REPORTER, SNACKBERT_OFF)
  snackbert = await startSnackbertService()
})

test.afterAll(() => snackbert.close())

test.beforeEach(() => snackbert.forget())

test('a Snackbert account shows the section, with its consent, and the switch stays on after a reload', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  snackbert.accounts.add(WITH_ACCOUNT)
  await signIn(page, WITH_ACCOUNT)

  let sheet = await openUserSettings(page)
  const region = sheet.getByRole('region', { name: 'Snackbert', exact: true })
  await expect(region).toBeVisible()
  await expect(region.getByText('Schaltest du Snackbert ein')).toBeVisible()
  await expect(region.getByRole('link', { name: 'Mehr dazu im Datenschutz' })).toHaveAttribute('href', '/datenschutz')

  const toggle = () => region.getByRole('switch', { name: 'An Snackbert melden' })
  await expect(toggle()).toHaveAttribute('aria-checked', 'false')
  await expect(toggle()).toBeEnabled()
  await toggle().click()
  await expect(toggle()).toHaveAttribute('aria-checked', 'true')

  // After a reload: still on.
  sheet = await openUserSettings(page)
  await expect(sheet.getByRole('region', { name: 'Snackbert', exact: true }).getByRole('switch', { name: 'An Snackbert melden' })).toHaveAttribute('aria-checked', 'true')

  await sheet.getByRole('region', { name: 'Snackbert', exact: true }).getByRole('switch', { name: 'An Snackbert melden' }).click()
  await expect(sheet.getByRole('region', { name: 'Snackbert', exact: true }).getByRole('switch', { name: 'An Snackbert melden' })).toHaveAttribute('aria-checked', 'false')
})

test('without a Snackbert account there is no Snackbert section', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, WITHOUT_ACCOUNT)

  // Wait until Snackbert has been asked, so the section's absence is not just
  // the answer not having come yet.
  const answered = page.waitForResponse(res => res.url().endsWith('/api/me/snackbert') && res.request().method() === 'GET')
  const sheet = await openUserSettings(page)
  await answered
  await expect(sheet.getByRole('region', { name: 'Benachrichtigungen' })).toBeVisible()
  await expect(sheet.getByRole('region', { name: 'Snackbert', exact: true })).toHaveCount(0)
})

// A Dish with one Cooking on the signed-in user's Board, its detail open.
async function openCookedDish(page: Page, title: string) {
  await gotoHydrated(page, '/')
  await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedCookings(page, title, 1)
  return async () => {
    await gotoHydrated(page, '/')
    await page.getByRole('link', { name: title }).click()
    const detail = page.getByRole('dialog', { name: title })
    return { detail, history: detail.locator('[data-dish-history]') }
  }
}

async function switchSnackbertOn(page: Page, email: string) {
  snackbert.accounts.add(email)
  expect((await page.request.put('/api/me/snackbert')).ok()).toBe(true)
}

const reportsSent = () => snackbert.requests.filter(request => request.path === '/reports')

test('a Snackbert Report is sent from the Dish History with a few words, confirmed, and the Cooking shows "gemeldet"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, REPORTER)
  const open = await openCookedDish(page, 'Pilzpasta')
  await switchSnackbertOn(page, REPORTER)
  const { history } = await open()

  await history.getByRole('button', { name: 'Snackbert melden' }).click()
  const sheet = page.getByRole('dialog', { name: 'Snackbert melden' })
  await expect(sheet.getByText(/^Pilzpasta, gekocht am /)).toBeVisible()
  await expect(sheet.getByRole('button', { name: 'Ohne alles senden' })).toBeEnabled()

  await sheet.getByRole('button', { name: 'Text', exact: true }).click()
  await sheet.getByRole('textbox', { name: 'Ein paar Worte' }).fill('Eine halbe Portion, dazu ein Glas Saft')
  await sheet.getByRole('button', { name: 'Senden', exact: true }).click()

  await expect(sheet.getByText('Danke dir! Ich rechne nach.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Fertig' }).click()
  await expect(sheet).toBeHidden()

  const reported = history.getByRole('button', { name: 'Noch einmal an Snackbert melden' })
  await expect(reported).toContainText('An Snackbert gemeldet ✓')
  const sent = reportsSent()
  expect(sent).toHaveLength(1)
  expect((sent[0]!.body as SnackbertSentReport).report.text).toBe('Eine halbe Portion, dazu ein Glas Saft')
})

test('a Report Snackbert could not take stays in the sheet with what was written, and goes on a second try', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, REPORTER)
  const open = await openCookedDish(page, 'Linsensuppe')
  await switchSnackbertOn(page, REPORTER)
  const { history } = await open()

  await history.getByRole('button', { name: 'Snackbert melden' }).click()
  const sheet = page.getByRole('dialog', { name: 'Snackbert melden' })
  await sheet.getByRole('button', { name: 'Text', exact: true }).click()
  const field = sheet.getByRole('textbox', { name: 'Ein paar Worte' })
  await field.fill('Zwei Teller')

  snackbert.answer(500)
  await sheet.getByRole('button', { name: 'Senden', exact: true }).click()
  await expect(sheet.getByRole('alert')).toContainText('Snackbert war gerade nicht zu erreichen')
  await expect(field).toHaveValue('Zwei Teller')

  snackbert.answer(null)
  await sheet.getByRole('button', { name: 'Nochmal versuchen' }).click()
  await expect(sheet.getByText('Danke dir! Ich rechne nach.')).toBeVisible()
  expect(reportsSent().filter(request => (request.body as SnackbertSentReport).report?.text === 'Zwei Teller').length).toBeGreaterThanOrEqual(1)
})

test('without Snackbert switched on, a Cooking has no "Snackbert melden"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, SNACKBERT_OFF)
  const open = await openCookedDish(page, 'Gemüsecurry')

  // Wait until Snackbert has been asked, so the pill's absence is not just
  // the answer not having come yet.
  const answered = page.waitForResponse(res => /^\/api\/dishes\/[^/]+\/snackbert$/.test(new URL(res.url()).pathname) && res.request().method() === 'GET')
  const { history } = await open()
  await answered
  await expect(history.locator('[data-cooking]')).toHaveCount(1)
  await expect(history.locator('[data-snackbert-report]')).toHaveCount(0)
})

// The Snackbert Question (#425): after a Cooking recorded here, once the
// Gekocht toast has gone, Snackbert asks. When exactly (and when not) is
// covered by tests/client/snackbert-question.test.ts. He never asks in the
// browser tests unless the page turns him on, as here.
const ASKED = ALLOWLISTED[196]
const ASKED_IN_DETAIL = ALLOWLISTED[197]

async function letSnackbertAsk(page: Page) {
  await page.addInitScript(() => {
    (window as { e2eSnackbertQuestion?: boolean }).e2eSnackbertQuestion = true
  })
}

const question = (page: Page) => page.locator('[data-snackbert-question]')

test('cooking a Dish, Snackbert asks once the toast has gone; "Heute nicht" sends him away, "Ja, gern" reports it', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await removeUsers(ASKED)
  await letSnackbertAsk(page)
  await signIn(page, ASKED)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Pilzpasta', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Linsensuppe', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await switchSnackbertOn(page, ASKED)
  await gotoHydrated(page, '/')

  // "Heute nicht": his last word, then he goes.
  await page.getByRole('button', { name: 'Gekocht ✓: „Pilzpasta“' }).click()
  const toast = page.locator('[data-toast]')
  await expect(toast).toContainText('Gekocht')
  await expect(question(page)).toHaveCount(0)
  await expect(toast).toBeHidden({ timeout: 10_000 })
  await expect(question(page)).toContainText('Mmh, Pilzpasta! Magst du mir erzählen, wie viel du davon hattest?')
  await question(page).getByRole('button', { name: 'Heute nicht' }).click()
  await expect(question(page)).toContainText('Alles klar, lass es dir schmecken!')
  await expect(question(page)).toHaveCount(0)

  // "Ja, gern": the report sheet for that Cooking.
  await page.getByRole('button', { name: 'Gekocht ✓: „Linsensuppe“' }).click()
  await expect(question(page)).toContainText('Mmh, Linsensuppe!', { timeout: 10_000 })
  await question(page).getByRole('button', { name: 'Ja, gern' }).click()
  await expect(question(page)).toHaveCount(0)
  const sheet = page.getByRole('dialog', { name: 'Snackbert melden' })
  await expect(sheet.getByText('Linsensuppe, heute gekocht')).toBeVisible()
  await sheet.getByRole('button', { name: 'Text', exact: true }).click()
  await sheet.getByRole('textbox', { name: 'Ein paar Worte' }).fill('Ein großer Teller')
  await sheet.getByRole('button', { name: 'Senden', exact: true }).click()
  await expect(sheet.getByText('Danke dir! Ich rechne nach.')).toBeVisible()
  await sheet.getByRole('button', { name: 'Fertig' }).click()
  await expect(sheet).toBeHidden()
  expect(reportsSent().map(request => (request.body as SnackbertSentReport).report.text)).toEqual(['Ein großer Teller'])

  // The Dish History shows it as reported.
  await page.getByRole('link', { name: 'Linsensuppe' }).click()
  const history = page.getByRole('dialog', { name: 'Linsensuppe' }).locator('[data-dish-history]')
  await expect(history.getByRole('button', { name: 'Noch einmal an Snackbert melden' })).toContainText('An Snackbert gemeldet ✓')
})

test('"Gekocht" in the Dish detail: Snackbert asks there too', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await removeUsers(ASKED_IN_DETAIL)
  await letSnackbertAsk(page)
  await signIn(page, ASKED_IN_DETAIL)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Gemüsecurry', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await switchSnackbertOn(page, ASKED_IN_DETAIL)
  await gotoHydrated(page, '/')

  await page.getByRole('link', { name: 'Gemüsecurry' }).click()
  const detail = page.getByRole('dialog', { name: 'Gemüsecurry' })
  await detail.getByRole('button', { name: 'Gekocht' }).click()
  const asking = detail.locator('[data-snackbert-question]')
  await expect(asking).toContainText('Mmh, Gemüsecurry!', { timeout: 10_000 })
  await asking.getByRole('button', { name: 'Ja, gern' }).click()
  await expect(page.getByRole('dialog', { name: 'Snackbert melden' }).getByText('Gemüsecurry, heute gekocht')).toBeVisible()
})
