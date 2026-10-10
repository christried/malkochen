import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { landingBoardId, removeUsers } from './seed'
import { stubSourceLookup } from './source-lookup-stub'

// Share to malkochen (issue #204): the installed app's share target. Android
// opens /share?title=…&text=…&url=… (manifest share_target); the app opens
// the Board used last with Add Dish open and the shared link looked up.
// Stephanie, Gladys and Shafi are used by this file only.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })
test.beforeAll(() => removeUsers(ALLOWLISTED[39], ALLOWLISTED[40], ALLOWLISTED[41]))

const TIKTOK = 'https://www.tiktok.com/@veganfood/video/7301234567890123456'
const REEL = 'https://www.instagram.com/reel/C1a2b3c4d5e/?igsh=abc'
// The landing Board's address, with nothing shared left in it. Its slug is
// unique across everyone's Boards, so it may carry a number.
const MEINE_KUECHE = /\/b\/meine-kueche(-\d+)?$/

async function stubTiktok(page: Page) {
  await stubSourceLookup(page, {
    kind: 'tiktok',
    canonicalLink: TIKTOK,
    suggestedTitle: 'Crispy Tofu Bowl',
    creator: 'Vegan Food Club',
    imageUrl: null,
    imageTicket: null,
  })
}

function addDish(page: Page) {
  return page.getByRole('dialog', { name: 'Gericht hinzufügen' })
}

function share(parts: Record<string, string>) {
  return `/share?${new URLSearchParams(parts)}`
}

test('the manifest declares a GET share target for title, text and url', async ({ page }) => {
  const manifest = await (await page.request.get('/manifest.webmanifest')).json()
  expect(manifest.share_target).toEqual({
    action: '/share',
    method: 'GET',
    params: { title: 'title', text: 'text', url: 'url' },
  })
})

test('a shared url opens Add Dish on the Board used last, filled in and looked up, with no Board picker on a single Board', async ({ page }) => {
  await stubTiktok(page)
  await signIn(page, ALLOWLISTED[39])
  await gotoHydrated(page, share({ title: 'Video', text: 'Schau mal', url: TIKTOK }))

  const sheet = addDish(page)
  await expect(sheet).toBeVisible()
  await expect(page).toHaveURL(MEINE_KUECHE)
  await expect(sheet.getByLabel('Link')).toHaveValue(TIKTOK)
  // The usual Source Lookup ran, as if the link had been pasted.
  await expect(sheet.getByLabel('Titel')).toHaveValue('Crispy Tofu Bowl')
  await expect(sheet.locator('[data-creator]')).toHaveText('Veröffentlicht von Vegan Food Club')
  await expect(sheet.getByLabel('Board')).toHaveCount(0)

  // Closed, Add Dish opens empty again.
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await expect(addDish(page).getByLabel('Link')).toHaveValue('')
})

test('without a url, the first link in the shared text is taken, the caption around it left out', async ({ page }) => {
  await stubTiktok(page)
  await signIn(page, ALLOWLISTED[39])
  await gotoHydrated(page, share({ title: 'Reel', text: `So gut 😍 ${REEL} unbedingt nachkochen!` }))

  await expect(addDish(page).getByLabel('Link')).toHaveValue(REEL)
})

test('shared content without a web link opens Add Dish empty, without an error', async ({ page }) => {
  await signIn(page, ALLOWLISTED[39])
  await gotoHydrated(page, share({ title: 'Lecker', text: 'Das müssen wir machen' }))

  const sheet = addDish(page)
  await expect(sheet).toBeVisible()
  await expect(sheet.getByLabel('Link')).toHaveValue('')
  await expect(sheet.getByRole('alert')).toHaveCount(0)
})

test('a Member of several Boards picks the Board in the sheet, set to the one used last', async ({ page }) => {
  await stubTiktok(page)
  await signIn(page, ALLOWLISTED[40])
  const kitchen = await landingBoardId(page)
  const res = await page.request.post('/api/boards', { data: { name: 'Kochclub', emoji: '🥟' } })
  expect(res.status()).toBe(201)
  const club = (await res.json()).id as string
  // Kochclub becomes the Board used last.
  await gotoHydrated(page, `/b/${club}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🥟 Kochclub')

  await gotoHydrated(page, share({ url: TIKTOK }))
  const sheet = addDish(page)
  await expect(sheet.getByLabel('Titel')).toHaveValue('Crispy Tofu Bowl')
  const picker = sheet.getByLabel('Board')
  await expect(picker).toHaveValue(club)
  await picker.selectOption(kitchen)

  const saved = page.waitForRequest(r => r.method() === 'POST' && /\/api\/boards\/[^/]+\/dishes$/.test(r.url()))
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  expect((await saved).url()).toContain(`/api/boards/${kitchen}/dishes`)
  await expect(sheet).toBeHidden()

  // On Meine Küche, in its first Column; not on Kochclub.
  const dishes = await (await page.request.get(`/api/boards/${kitchen}`)).json() as { columns: { dishes: { title: string }[] }[] }
  expect(dishes.columns[0]!.dishes.map(d => d.title)).toContain('Crispy Tofu Bowl')
  await expect(page.getByRole('article', { name: 'Crispy Tofu Bowl' })).toHaveCount(0)
})

test('signed out, sharing goes through sign-in and lands in the filled-in Add Dish', async ({ page }) => {
  await stubTiktok(page)
  const shared = share({ text: `Guck mal ${TIKTOK}` })
  await gotoHydrated(page, shared)
  await expect(page).toHaveURL(/\/login\?redirect=/)

  // Google is played by the dev sign-in: it signs the browser in and sends
  // it back to where the app asked to return.
  let callbackURL = ''
  await page.route('**/api/auth/sign-in/social', async (route) => {
    callbackURL = (route.request().postDataJSON() as { callbackURL: string }).callbackURL
    await signIn(page, ALLOWLISTED[41])
    await route.fulfill({ json: { url: callbackURL, redirect: true } })
  })
  await page.getByRole('button', { name: 'Mit Google anmelden' }).click()

  await expect(addDish(page).getByLabel('Link')).toHaveValue(TIKTOK)
  expect(callbackURL).toMatch(/^\/share\?/)
  await expect(page).toHaveURL(MEINE_KUECHE)
})
