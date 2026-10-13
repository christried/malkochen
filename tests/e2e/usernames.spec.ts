import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'

// Usernames (issue #209): a new user picks theirs before their first Board,
// a user from before Usernames is asked once whether theirs fits, and anyone
// changes theirs in their settings. The app shows it wherever it shows the
// user, and their Google name nowhere. The users below are used by this file
// only.

const EMMY = ALLOWLISTED[54]
const MARIE = ALLOWLISTED[55]
const ROSALIND = ALLOWLISTED[56]
const DOROTHY = ALLOWLISTED[57]

const field = (page: Page) => page.getByRole('textbox', { name: 'Name' })
const onABoard = /\/b\/[^/]+$/

test('a new user picks a Username before reaching a Board, and can’t go on until it is valid and free', async ({ page, browser }) => {
  // Someone else has "curie" already.
  await signIn(await newTab(browser), MARIE)
  // As Google creates the user: with its name, and no Username.
  await signIn(page, EMMY, { name: 'Emmy Noether', username: 'none' })

  await gotoHydrated(page, '/')

  await expect(page).toHaveURL('/username')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wie sollen wir dich nennen?')
  await expect(field(page)).toHaveValue('')
  await expect(page.getByText('2 bis 24 Zeichen: Buchstaben, Ziffern und _ . -')).toBeVisible()
  // Their Google name is nowhere, not even as a suggestion.
  await expect(page.getByText(/Emmy|Noether/)).toHaveCount(0)

  const go = page.getByRole('button', { name: 'Los geht’s' })
  await go.click()
  await expect(page.getByRole('alert')).toHaveText('Mindestens 2 Zeichen.')
  await expect(field(page)).toHaveAttribute('aria-invalid', 'true')

  // What is wrong shows while typing.
  await field(page).fill('Emmy Noether')
  await expect(page.getByRole('alert')).toHaveText('Nur Buchstaben, Ziffern und _ . - sind erlaubt.')
  await field(page).fill('E'.repeat(25))
  await expect(page.getByRole('alert')).toHaveText('Höchstens 24 Zeichen.')

  // Taken, whatever the case: the server says so.
  await field(page).fill('Curie')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await go.click()
  await expect(page.getByRole('alert')).toHaveText('Den Namen gibt es schon. Probier einen anderen.')
  await expect(page).toHaveURL('/username')

  // No way around it: every other page leads back here.
  await gotoHydrated(page, '/settings')
  await expect(page).toHaveURL('/username?redirect=/settings')

  await field(page).fill('Emmy')
  await page.getByRole('button', { name: 'Los geht’s' }).click()

  // On to where they were going, with the Username as their name.
  await expect(page).toHaveURL('/settings')
  await expect(page.getByRole('region', { name: 'Konto' }).getByText('Emmy', { exact: true })).toBeVisible()
  await expect(page.getByText(/Noether/)).toHaveCount(0)
  // The prompt is over for good.
  await gotoHydrated(page, '/username')
  await expect(page).toHaveURL(onABoard)
})

test('a user from before Usernames is asked once whether theirs fits, and keeps it with one tap', async ({ page }) => {
  // As the migration left them: a Username from their Google first name.
  await signIn(page, ROSALIND, { name: 'Rosalind Franklin', username: 'suggested' })

  await gotoHydrated(page, '/')

  await expect(page).toHaveURL('/username')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Passt dein Name?')
  await expect(field(page)).toHaveValue('Rosalind')
  await expect(page.getByText(/Franklin/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Passt so' }).click()

  await expect(page).toHaveURL(onABoard)
  await page.getByRole('button', { name: 'Dein Konto' }).click()
  await expect(page.getByRole('menu', { name: `Rosalind ${ROSALIND}` })).toBeVisible()
  // Not asked again: not after a reload, not after signing in again.
  await reloadHydrated(page)
  await expect(page).toHaveURL(onABoard)
  await signIn(page, ROSALIND)
  await gotoHydrated(page, '/')
  await expect(page).toHaveURL(onABoard)
})

test('a user from before Usernames can change theirs instead of keeping it', async ({ page }) => {
  await signIn(page, ALLOWLISTED[52], { name: 'Rosa Luxemburg', username: 'suggested' })
  await gotoHydrated(page, '/')
  await expect(field(page)).toHaveValue('Rosa')

  await field(page).fill('Röschen')
  // No longer "Passt so": it isn't the name they had.
  await expect(page.getByRole('button', { name: 'Passt so' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Los geht’s' }).click()

  await expect(page).toHaveURL(onABoard)
  await page.getByRole('button', { name: 'Dein Konto' }).click()
  await expect(page.getByRole('menu', { name: `Röschen ${ALLOWLISTED[52]}` })).toBeVisible()
})

for (const [device, viewport, renamed] of [
  ['a phone', { width: 390, height: 844 }, 'Dotty'],
  ['a desktop', { width: 1280, height: 800 }, 'Dorothy.H'],
] as const) {
  test(`the Username is changed in the settings on ${device}, and shows across the app afterwards, for other Members too`, async ({ page, browser }) => {
    await page.setViewportSize(viewport)
    await signIn(page, DOROTHY)
    const created = await page.request.post('/api/boards', { data: { name: `Namen ${renamed}`, emoji: '🥕' } })
    const { id: boardId } = await created.json() as { id: string }
    const dish = await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title: 'Linsencurry', placeholder: 'bowl' } })
    const { id: dishId } = await dish.json() as { id: string }
    expect((await page.request.post(`/api/dishes/${dishId}/cook`)).status()).toBe(200)
    const other = await newTab(browser, { viewport })
    await signIn(other, MARIE)
    expect((await other.request.post(`/api/invites/${await inviteToken(page, boardId)}/join`)).status()).toBe(200)

    await gotoHydrated(page, '/settings')
    const account = page.getByRole('region', { name: 'Konto' })
    const save = account.getByRole('button', { name: 'Speichern' })
    // Nothing to save until it is another name.
    await expect(save).toBeDisabled()

    // A name someone else has is refused, in the server's words.
    await field(page).fill('CURIE')
    await save.click()
    await expect(account.getByRole('alert')).toHaveText('Den Namen gibt es schon. Probier einen anderen.')

    await field(page).fill(renamed)
    await save.click()

    await expect(account.getByRole('status')).toHaveText('Gespeichert.')
    await expect(account.getByText(renamed, { exact: true })).toBeVisible()
    await expect(save).toBeDisabled()

    // Across the app: who added the Dish, who cooked it, the Members.
    await gotoHydrated(page, `/b/${boardId}`)
    await expect(page.getByText(`Hinzugefügt von ${renamed}`).first()).toBeAttached()
    await gotoHydrated(page, `/b/${boardId}/settings`)
    await expect(page.getByRole('list', { name: 'Mitglieder' }).getByRole('listitem').first()).toContainText(`${renamed} (du)`)

    // The other Member sees it after a reload.
    await gotoHydrated(other, `/b/${boardId}/settings`)
    await expect(other.getByRole('list', { name: 'Mitglieder' }).getByRole('listitem').first()).toContainText(renamed)
    await gotoHydrated(other, `/b/${boardId}`)
    await expect(other.getByText(`Hinzugefügt von ${renamed}`).first()).toBeAttached()
    // The Dish's own page: who added it, and who cooked it in its history.
    await gotoHydrated(other, `/b/${boardId}/${dishId}`)
    await expect(other.getByText(new RegExp(`^Hinzugefügt von ${renamed.replace('.', '\\.')} am `))).toBeVisible()
    await expect(other.locator('[data-cooking]')).toContainText(`von ${renamed}`)
  })
}
