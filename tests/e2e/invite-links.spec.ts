import type { Browser, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'

// Invite Links (PRD stories 4, 63–66): the Owner's link in Board settings,
// opened by a second user. Frances owns the Boards; Sophie and Joan are the
// invited users, used by this file only (Sophie's first sign-in is here).

// A Board of Frances's, and its Invite Link as Board settings shows it.
async function ownersLink(page: Page, name: string, emoji: string): Promise<{ slug: string, link: string }> {
  await signIn(page, ALLOWLISTED[12])
  const res = await page.request.post('/api/boards', { data: { name, emoji } })
  expect(res.status()).toBe(201)
  const { slug } = await res.json()
  await gotoHydrated(page, `/b/${slug}/settings`)
  const link = await page.getByLabel('Einladungslink').inputValue()
  expect(link).toMatch(/\/invite\/[0-9a-f]{32}$/)
  return { slug, link }
}

// A second person's browser, signed out.
async function secondBrowser(browser: Browser): Promise<Page> {
  return newTab(browser)
}

test('a first-time user opens the Invite Link, signs in, and lands on the Board without a "Meine Küche"', async ({ page, browser }) => {
  const { slug, link } = await ownersLink(page, 'Kochclub', '🍜')
  const invited = await secondBrowser(browser)

  await gotoHydrated(invited, link)
  await expect(invited.getByRole('heading', { level: 1 })).toHaveText('Du wurdest zu 🍜 Kochclub eingeladen')
  await expect(invited.getByText('frances lädt dich ein')).toBeVisible()

  // Google itself is out of reach in tests: a stand-in page answers for it.
  await invited.route(/accounts\.google\.com/, route => route.fulfill({ contentType: 'text/html', body: '<title>Google</title>' }))
  await invited.getByRole('button', { name: 'Mit Google anmelden' }).click()
  await invited.waitForURL(/accounts\.google\.com/)
  // Where Better Auth sends a refused sign-in: the remembered invite names the Owner.
  await gotoHydrated(invited, '/login?error=not_allowed')
  await expect(invited.getByText('Sag frances Bescheid')).toBeVisible()
  await expect(invited.getByText('Deine Einladung zu 🍜 Kochclub merken wir uns.')).toBeVisible()
  // Once let in, what Google's callback does: sign in (the remembered invite
  // joins), then back to where sign-in started, the link, then the Board.
  await signIn(invited, ALLOWLISTED[13])

  await gotoHydrated(invited, link)
  await expect(invited).toHaveURL(new RegExp(`/b/${slug}$`))
  await expect(invited.getByRole('heading', { level: 1 })).toHaveText('🍜 Kochclub')
  await invited.getByRole('heading', { level: 1 }).getByRole('button').click()
  await expect(invited.getByRole('navigation', { name: 'Deine Boards' }).getByRole('link')).toHaveText([/Kochclub/])
})

test('a signed-in user opening the link joins at once, and a reset link stops working', async ({ page, browser }) => {
  const { slug, link } = await ownersLink(page, 'Grillabend', '🔥')
  const invited = await secondBrowser(browser)
  await signIn(invited, ALLOWLISTED[10])
  // An invite remembered from an earlier visit is used up by this join.
  await invited.request.post(`/api/invites/${link.split('/').pop()}/remember`)

  await gotoHydrated(invited, link)
  await expect(invited).toHaveURL(new RegExp(`/b/${slug}$`))
  await expect(invited.getByRole('heading', { level: 1 })).toHaveText('🔥 Grillabend')
  expect((await invited.context().cookies()).map(c => c.name)).not.toContain('malkochen.invite')

  // Only the Owner sees "Link zurücksetzen".
  await gotoHydrated(invited, `/b/${slug}/settings`)
  await expect(invited.getByLabel('Einladungslink')).toHaveValue(link)
  await expect(invited.getByRole('button', { name: 'Link zurücksetzen' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Link zurücksetzen' }).click()
  await page.getByRole('dialog', { name: 'Link zurücksetzen?' }).getByRole('button', { name: 'Link zurücksetzen' }).click()
  await expect(page.getByText('Neuer Link erstellt')).toBeVisible()
  await expect(page.getByLabel('Einladungslink')).not.toHaveValue(link)

  const stranger = await secondBrowser(browser)
  await gotoHydrated(stranger, link)
  await expect(stranger.getByRole('heading', { level: 1 })).toHaveText('Dieser Link geht nicht mehr.')
})
