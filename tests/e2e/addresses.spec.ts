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
})

test('a renamed Board is at its new address, and its old one forwards there', async ({ page }) => {
  await signIn(page, GRETE)
  const board = await createBoard(page, 'Alter Name')
  await gotoHydrated(page, `/b/${board.slug}/settings`)

  const name = page.getByLabel('Name', { exact: true })
  await name.fill('Neuer Name')
  await name.press('Enter')
  await expect(name).toHaveValue('Neuer Name')
  const { slug } = await (await page.request.get(`/api/boards/${board.id}`)).json() as Created
  expect(slug).toMatch(slugFrom('neuer-name'))
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page).toHaveURL(at(`/b/${slug}`))
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🧭 Neuer Name')

  await gotoHydrated(page, `/b/${board.slug}`)
  await expect(page).toHaveURL(at(`/b/${slug}`))
  await gotoHydrated(page, `/b/${board.slug}/settings`)
  await expect(page).toHaveURL(at(`/b/${slug}/settings`))
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

test('someone else’s Board’s address looks like one that doesn’t exist', async ({ page, browser }) => {
  await signIn(page, GRETE)
  const board = await createBoard(page, 'Nur Grete')
  const youyou = await newTab(browser)
  await signIn(youyou, YOUYOU)

  for (const address of [`/b/${board.slug}`, `/b/${board.id}`, '/b/gibt-es-gar-nicht']) {
    await gotoHydrated(youyou, address)
    await expect(youyou.getByRole('heading', { level: 1 })).toHaveText('Das gibt’s hier nicht.')
    await expect(youyou).toHaveURL(at(address))
  }
  await youyou.context().close()
})
