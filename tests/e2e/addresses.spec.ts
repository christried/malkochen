import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated } from './hydration'
import { inviteToken } from './invite'

// Readable addresses (issue #127, CONTEXT.md: Address): a Board at
// /b/<slug>, a Dish at /b/<Board slug>/<title slug>-<code>; old addresses,
// by id or from before a rename, forward to the current ones. Grete and
// Youyou are used by this file only.

const GRETE = ALLOWLISTED[29]
const YOUYOU = ALLOWLISTED[30]

interface Created {
  id: string
  slug: string
}

async function createBoard(page: Page, name: string): Promise<Created> {
  const res = await page.request.post('/api/boards', { data: { name, emoji: '🧭' } })
  expect(res.status()).toBe(201)
  return res.json()
}

async function addDish(page: Page, boardId: string, title: string): Promise<{ id: string, code: string }> {
  const res = await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title, placeholder: 'eintopf' } })
  expect(res.status()).toBe(201)
  return res.json()
}

// The page's URL ends in `path`.
const at = (path: string) => new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

// The slug a Board's name gives, or that with a number after it: a retried
// test makes its Board again.
const slugFrom = (slug: string) => new RegExp(`^${slug}(-\\d+)?$`)

test('a Board and its Dishes open at addresses made from their names', async ({ page }) => {
  await signIn(page, GRETE)
  const board = await createBoard(page, 'Wegweiser Küche')
  expect(board.slug).toMatch(slugFrom('wegweiser-kueche'))
  const soup = await addDish(page, board.id, 'Omas Linsensuppe')

  await gotoHydrated(page, `/b/${board.slug}`)
  await page.getByRole('link', { name: 'Omas Linsensuppe' }).click()

  await expect(page.getByRole('dialog', { name: 'Omas Linsensuppe' })).toBeVisible()
  await expect(page).toHaveURL(at(`/b/${board.slug}/omas-linsensuppe-${soup.code}`))
  await page.getByRole('dialog', { name: 'Omas Linsensuppe' }).getByRole('button', { name: 'Schließen' }).click()
  await expect(page).toHaveURL(at(`/b/${board.slug}`))
})

test('old addresses forward: a Board’s and a Dish’s ids, and a Dish’s old title', async ({ page }) => {
  await signIn(page, GRETE)
  const board = await createBoard(page, 'Umleitung')
  expect(board.slug).toMatch(slugFrom('umleitung'))
  const soup = await addDish(page, board.id, 'Kürbissuppe')

  await gotoHydrated(page, `/b/${board.id}`)
  await expect(page).toHaveURL(at(`/b/${board.slug}`))
  await expect(column(page, 'Ideen').getByRole('link', { name: 'Kürbissuppe' })).toBeVisible()

  await gotoHydrated(page, `/b/${board.id}/d/${soup.id}`)
  await expect(page).toHaveURL(at(`/b/${board.slug}/kuerbissuppe-${soup.code}`))
  await expect(page.getByRole('dialog', { name: 'Kürbissuppe' })).toBeVisible()

  await gotoHydrated(page, `/b/${board.slug}/alter-titel-${soup.code}`)
  await expect(page).toHaveURL(at(`/b/${board.slug}/kuerbissuppe-${soup.code}`))
  await expect(page.getByRole('dialog', { name: 'Kürbissuppe' })).toBeVisible()

  await gotoHydrated(page, `/b/${board.id}/settings`)
  await expect(page).toHaveURL(at(`/b/${board.slug}/settings`))
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Umleitung')
})

test('a Dish moved to another Board opens there from its old address', async ({ page }) => {
  await signIn(page, GRETE)
  const from = await createBoard(page, 'Abfahrt')
  const to = await createBoard(page, 'Ankunft')
  const stew = await addDish(page, from.id, 'Wandernder Eintopf')
  const { columns } = await (await page.request.get(`/api/boards/${to.id}`)).json() as { columns: { id: string }[] }
  expect((await page.request.post(`/api/dishes/${stew.id}/move`, { data: { columnId: columns[0]!.id } })).status()).toBe(200)

  await gotoHydrated(page, `/b/${from.slug}/wandernder-eintopf-${stew.code}`)

  await expect(page).toHaveURL(at(`/b/${to.slug}/wandernder-eintopf-${stew.code}`))
  await expect(page.getByRole('dialog', { name: 'Wandernder Eintopf' })).toBeVisible()
})

// Opening a Board moves on what is marked "Neu"; the old address forwards
// before the Board is opened, so it is opened once, not twice.
test('a Board opened from its old address still marks another Member’s new Dishes "Neu"', async ({ page, browser }) => {
  await signIn(page, GRETE)
  const board = await createBoard(page, 'Neu nach Umleitung')
  const youyou = await newTab(browser)
  await signIn(youyou, YOUYOU)
  expect((await youyou.request.post(`/api/invites/${await inviteToken(page, board.id)}/join`)).status()).toBe(200)
  await addDish(youyou, board.id, 'Youyous Gratin')
  await youyou.context().close()

  await gotoHydrated(page, `/b/${board.id}`)

  await expect(page).toHaveURL(at(`/b/${board.slug}`))
  await expect(column(page, 'Ideen').getByRole('article', { name: 'Youyous Gratin' }).getByText('Neu')).toBeVisible()
})

// A rename by another Member reaches an open Board by sync. Its links keep
// to the address it was opened at, which still leads to it: following one
// to the new address would open the Board again.
test('a Board renamed while it is open keeps its address until it is opened again', async ({ page, browser }) => {
  await signIn(page, GRETE)
  const board = await createBoard(page, 'Umbenannt beim Lesen')
  const youyou = await newTab(browser)
  await signIn(youyou, YOUYOU)
  expect((await youyou.request.post(`/api/invites/${await inviteToken(page, board.id)}/join`)).status()).toBe(200)
  await addDish(youyou, board.id, 'Youyous Auflauf')

  await gotoHydrated(page, `/b/${board.slug}`)
  const card = column(page, 'Ideen').getByRole('article', { name: 'Youyous Auflauf' })
  await expect(card.getByText('Neu')).toBeVisible()
  expect((await youyou.request.patch(`/api/boards/${board.id}`, { data: { name: 'Neu benannt' } })).status()).toBe(200)
  await youyou.context().close()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🧭 Neu benannt', { timeout: 15_000 })

  await page.getByRole('link', { name: 'Youyous Auflauf' }).click()
  const detail = page.getByRole('dialog', { name: 'Youyous Auflauf' })
  await expect(detail).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/b/${board.slug}/youyous-auflauf-[a-z0-9]+$`))
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(page).toHaveURL(at(`/b/${board.slug}`))
  await expect(card.getByText('Neu')).toBeVisible()
})
