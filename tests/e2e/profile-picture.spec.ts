import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId, removeUsers } from './seed'

// A Profile Picture of your own, uploaded in your settings: seen round in a
// preview first, then on your badges for every Member, instead of your
// Google photo. Removed, the Google photo is back. Maryam and Jocelyn are
// used by this file only; Jocelyn joins Maryam's Board to look.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const MARYAM = ALLOWLISTED[31]
const JOCELYN = ALLOWLISTED[32]
// Stands in for Google's photo URL; served by the app, so it loads offline.
const GOOGLE_PHOTO = `${E2E_ORIGIN}/icons/icon-192.png`
const PROFILE = { name: 'Maryam', image: GOOGLE_PHOTO }

test.beforeAll(() => removeUsers(MARYAM, JOCELYN))

const PICTURE_URL = /^\/images\/pictures\/[0-9a-f-]{36}\.jpg$/

async function phonePhoto(background: string) {
  const buffer = await sharp({ create: { width: 1800, height: 1200, channels: 3, background } }).jpeg().toBuffer()
  return { name: 'IMG_0815.jpg', mimeType: 'image/jpeg', buffer }
}

function account(page: Page) {
  return page.getByRole('region', { name: 'Konto' })
}

// The picture shown for you in your settings.
function shownPicture(page: Page) {
  return account(page).locator('img').first()
}

function preview(page: Page) {
  return page.getByRole('dialog', { name: 'Dein Profilbild' })
}

test('a picture uploaded in the settings shows round in a preview, and once used, on your badges for every Member', async ({ page, browser }) => {
  await signIn(page, MARYAM, PROFILE)
  // A Dish of Maryam's, so her badge shows on the Board.
  const boardId = await landingBoardId(page)
  expect((await page.request.post(`/api/boards/${boardId}/dishes`, { data: { title: 'Mangold-Galette', placeholder: 'bowl' } })).status()).toBe(201)
  await gotoHydrated(page, '/settings')
  await expect(shownPicture(page)).toHaveAttribute('src', GOOGLE_PHOTO)
  // Nothing of your own to remove yet.
  await expect(account(page).getByRole('button', { name: 'Eigenes Bild entfernen' })).toHaveCount(0)

  await account(page).getByLabel('Eigenes Bild hochladen').setInputFiles(await phonePhoto('#4a7'))

  // The preview: the stored picture, cut to a circle.
  const dialog = preview(page)
  await expect(dialog).toBeVisible()
  const previewed = dialog.getByRole('img', { name: 'Vorschau' })
  await expect(previewed).toHaveAttribute('src', PICTURE_URL)
  const { width, height, radius } = await previewed.evaluate((img) => {
    const { width, height } = img.getBoundingClientRect()
    return { width, height, radius: Number.parseFloat(getComputedStyle(img).borderRadius) }
  })
  expect(width).toBeCloseTo(height, 0)
  expect(radius).toBeGreaterThanOrEqual(width / 2)
  // Not used yet.
  await expect(shownPicture(page)).toHaveAttribute('src', GOOGLE_PHOTO)

  await dialog.getByRole('button', { name: 'Übernehmen' }).click()

  await expect(dialog).toBeHidden()
  await expect(shownPicture(page)).toHaveAttribute('src', PICTURE_URL)
  const picture = (await shownPicture(page).getAttribute('src'))!
  await expect(account(page).getByRole('button', { name: 'Eigenes Bild entfernen' })).toBeVisible()
  await reloadHydrated(page)
  await expect(shownPicture(page)).toHaveAttribute('src', picture)

  // On the Board, her header photo and the badge on her Dish.
  await gotoHydrated(page, '/')
  await expect(page.getByRole('button', { name: 'Dein Konto' }).locator('img')).toHaveAttribute('src', picture)
  const card = column(page, 'Ideen').getByRole('article', { name: 'Mangold-Galette' })
  await expect(card.locator(`img[src="${picture}"]`)).toBeVisible()

  // Another Member sees it too.
  const token = await inviteToken(page, boardId)
  const jocelyn = await newTab(browser)
  await signIn(jocelyn, JOCELYN, { name: 'Jocelyn' })
  expect((await jocelyn.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  await gotoHydrated(jocelyn, '/')
  await expect(column(jocelyn, 'Ideen').getByRole('article', { name: 'Mangold-Galette' }).locator(`img[src="${picture}"]`)).toBeVisible()
  await jocelyn.context().close()
})

test('"Abbrechen" in the preview keeps the picture you had', async ({ page }) => {
  await signIn(page, MARYAM, PROFILE)
  await gotoHydrated(page, '/settings')
  const before = (await shownPicture(page).getAttribute('src'))!

  await account(page).getByLabel('Anderes Bild hochladen').setInputFiles(await phonePhoto('#a74'))
  await expect(preview(page).getByRole('img', { name: 'Vorschau' })).toHaveAttribute('src', PICTURE_URL)
  await preview(page).getByRole('button', { name: 'Abbrechen' }).click()

  await expect(preview(page)).toBeHidden()
  await expect(shownPicture(page)).toHaveAttribute('src', before)
  await reloadHydrated(page)
  await expect(shownPicture(page)).toHaveAttribute('src', before)
})

test('signing in again keeps your own picture; removing it brings the Google photo back', async ({ page }) => {
  // As after a new Google sign-in.
  await signIn(page, MARYAM, PROFILE)
  await gotoHydrated(page, '/settings')
  await expect(shownPicture(page)).toHaveAttribute('src', PICTURE_URL)

  await account(page).getByRole('button', { name: 'Eigenes Bild entfernen' }).click()

  await expect(shownPicture(page)).toHaveAttribute('src', GOOGLE_PHOTO)
  await expect(account(page).getByRole('button', { name: 'Eigenes Bild entfernen' })).toHaveCount(0)
  await gotoHydrated(page, '/')
  await expect(column(page, 'Ideen').getByRole('article', { name: 'Mangold-Galette' }).locator(`img[src="${GOOGLE_PHOTO}"]`)).toBeVisible()
})

test('a file that isn’t a photo is refused kindly, and nothing changes', async ({ page }) => {
  await signIn(page, MARYAM, PROFILE)
  await gotoHydrated(page, '/settings')

  await account(page).getByLabel('Eigenes Bild hochladen').setInputFiles({ name: 'rezept.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('Linsen, Reis, Koriander') })

  await expect(account(page).getByRole('alert')).toHaveText('Das ist kein Foto, das ich lesen kann. JPEG, PNG, WebP oder HEIC gehen.')
  await expect(preview(page)).toBeHidden()
  await expect(shownPicture(page)).toHaveAttribute('src', GOOGLE_PHOTO)
})
