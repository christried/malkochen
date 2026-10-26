import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN, OPERATOR } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { openUserSettings } from './settings-sheet'

// The Admin Page (#348): the Operator finds "Admin" at the end of their
// settings and its figures behind it; anyone else finds neither the link
// nor the page. The Operator switches Open Sign-up there (#350). Babbage is
// the Operator; Church is used by this file only.
const CHURCH = 'church@example.com'

test('the Operator opens the Admin Page from the end of their settings', async ({ page }) => {
  await signIn(page, OPERATOR)
  const sheet = await openUserSettings(page)

  await sheet.getByRole('link', { name: /^Admin/ }).click()

  await expect(page).toHaveURL('/admin')
  await expect(page.getByRole('heading', { name: 'Admin', level: 1 })).toBeVisible()
  for (const heading of ['Kostenlose Grenzen', 'Aktiv', 'Neue Gerichte nach Quelle', 'Was auf den Boards passiert', 'Neu angemeldet']) {
    await expect(page.getByRole('heading', { name: heading, level: 2 })).toBeVisible()
  }
  await expect(page.getByRole('row', { name: /^Datenbank \(Neon\)/ })).toBeVisible()
})

test('anyone else has no Admin link, and the Admin Page isn\'t there for them', async ({ page }) => {
  await signIn(page, CHURCH)
  const sheet = await openUserSettings(page)

  await expect(sheet.getByRole('region', { name: 'Konto löschen' })).toBeVisible()
  await expect(sheet.getByRole('link', { name: /^Admin/ })).toHaveCount(0)

  await gotoHydrated(page, '/admin')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')
})

test('the Operator switches "Anmeldung offen" on, and a stranger\'s sign-up then works', async ({ page, browser }) => {
  const strangerEmail = `stranger-${Date.now().toString(36)}@example.org`
  const visitor = await (await browser.newContext()).newPage()
  const signUp = () => visitor.request.post('/api/auth/dev/sign-in', { data: { email: strangerEmail }, headers: { origin: E2E_ORIGIN } })
  expect((await signUp()).status()).toBe(403)

  await signIn(page, OPERATOR)
  await gotoHydrated(page, '/admin')
  const open = page.getByRole('switch', { name: 'Anmeldung offen' })
  await expect(open).toHaveAttribute('aria-checked', 'false')
  await open.click()
  try {
    await expect(open).toHaveAttribute('aria-checked', 'true')

    expect((await signUp()).status()).toBe(200)
    await gotoHydrated(visitor, '/')
    await expect(visitor).toHaveURL(/\/b\//)

    // Still on after coming back.
    await reloadHydrated(page)
    await expect(open).toHaveAttribute('aria-checked', 'true')
  }
  finally {
    await open.click()
    await expect(open).toHaveAttribute('aria-checked', 'false')
    await visitor.context().close()
  }
})

test('the Operator finds a Board on the Admin Page, opens it and sees they are there as the Operator', async ({ page, browser }) => {
  const owner = await (await browser.newContext()).newPage()
  try {
    await signIn(owner, ALLOWLISTED[144])
    const created = await owner.request.post('/api/boards', { data: { name: 'Fremdes Fondue', emoji: '🧀' } })
    expect(created.status()).toBe(201)

    await signIn(page, OPERATOR)
    await gotoHydrated(page, '/admin')
    await page.getByTestId('admin-board-search').fill('fondue')
    const row = page.getByTestId('admin-board')
    await expect(row).toHaveCount(1)
    await expect(row).toContainText('Fremdes Fondue')
    await row.getByRole('link', { name: /Fremdes Fondue/ }).click()

    await expect(page).toHaveURL(/\/b\/fremdes-fondue$/)
    await expect(page.getByTestId('operator-note')).toHaveText('Du siehst dieses Board als Betreiber von malkochen.')
    await page.getByRole('heading', { level: 1 }).getByRole('button').click()
    const boards = page.getByRole('navigation', { name: 'Deine Boards' })
    await expect(boards).toBeVisible()
    await expect(boards.getByRole('link', { name: /Fremdes Fondue/ })).toHaveCount(0)
  }
  finally {
    await owner.context().close()
  }
})

test('the Operator sees the Event Log, filters it by a Board, a kind group and a user, and opens the Board from a row', async ({ page, browser }) => {
  const owner = await (await browser.newContext()).newPage()
  try {
    await signIn(owner, ALLOWLISTED[152])
    const created = await owner.request.post('/api/boards', { data: { name: 'Ereignis-Eintopf', emoji: '🍲' } })
    expect(created.status()).toBe(201)
    const board = await created.json() as { id: string }
    const dish = await owner.request.post(`/api/boards/${board.id}/dishes`, { data: { title: 'Linsensuppe', placeholder: 'bowl' } })
    expect(dish.status()).toBe(201)
    const { id: dishId } = await dish.json() as { id: string }
    expect((await owner.request.post(`/api/dishes/${dishId}/comments`, { data: { text: 'Mit Essig' } })).status()).toBe(201)
    const username = ((await (await owner.request.get('/api/me')).json()) as { name: string }).name

    await signIn(page, OPERATOR)
    await gotoHydrated(page, '/admin')
    await expect(page.getByRole('heading', { name: 'Ereignisse', level: 2 })).toBeVisible()
    await expect(page.getByTestId('admin-event').first()).toBeVisible()

    await page.getByLabel('Board', { exact: true }).selectOption(board.id)
    const events = page.getByTestId('admin-event')
    await expect(events).toHaveCount(3)
    await expect(page).toHaveURL(new RegExp(`board=${board.id}`))
    await expect(events.first()).toContainText('Kommentar geschrieben')
    await expect(events.first()).toContainText('Mit Essig')

    await page.getByLabel('Art', { exact: true }).selectOption('dishes')
    await expect(events).toHaveCount(1)
    await expect(events.first()).toContainText('Gericht hinzugefügt')
    await expect(events.first()).toContainText('Linsensuppe')
    await expect(page).toHaveURL(/group=dishes/)

    await page.getByLabel('Nutzer:in', { exact: true }).fill(username.toUpperCase())
    await expect(events).toHaveCount(1)
    await page.getByLabel('Nutzer:in', { exact: true }).fill('gibt-es-nicht-xyz')
    await expect(page.getByText('Keine Ereignisse')).toBeVisible()
    await page.getByLabel('Nutzer:in', { exact: true }).fill('')
    await expect(events).toHaveCount(1)

    // The filters are in the URL, so they survive a reload.
    await reloadHydrated(page)
    await expect(page.getByLabel('Art', { exact: true })).toHaveValue('dishes')
    await expect(events).toHaveCount(1)

    await events.first().getByRole('link', { name: /Ereignis-Eintopf/ }).click()
    await expect(page).toHaveURL(/\/b\/ereignis-eintopf$/)
  }
  finally {
    await owner.context().close()
  }
})
