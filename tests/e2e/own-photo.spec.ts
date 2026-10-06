import type { Locator, Page } from '@playwright/test'
import sharp from 'sharp'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId } from './seed'
import { stubImage, stubSourceLookup } from './source-lookup-stub'

// "Eigenes Foto": a Member's own photo as a Dish's image, picked in the
// image dialog of Add Dish and of the Dish detail, and seen by every Member.
// Hypatia's Board is used by this file only; Mileva joins it to look.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const HYPATIA = ALLOWLISTED[25]
const MILEVA = ALLOWLISTED[26]

// A phone photo, with where it was taken written into it.
const GPS = { GPSLatitudeRef: 'N', GPSLatitude: '48/1 8/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '11/1 34/1 0/1' }
async function phonePhoto(background: string) {
  const buffer = await sharp({ create: { width: 2000, height: 1500, channels: 3, background } })
    .withExif({ IFD0: { Make: 'Phone' }, IFD3: GPS })
    .jpeg()
    .toBuffer()
  return { name: 'IMG_2041.jpg', mimeType: 'image/jpeg', buffer }
}

function imageDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Bild wählen' })
}

// Picks the photo in the dialog's "Eigenes Foto", as the file picker would.
async function pickPhoto(dialog: Locator, file: { name: string, mimeType: string, buffer: Buffer }) {
  await dialog.getByLabel('Eigenes Foto').setInputFiles(file)
}

function card(page: Page, title: string) {
  return column(page, 'Ideen').getByRole('article', { name: title })
}

async function openAddDishWithoutLink(page: Page) {
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await page.getByRole('dialog', { name: 'Gericht hinzufügen' }).getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  return page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
}

test('a photo picked in Add Dish becomes the Dish’s image, without where it was taken, for every Member', async ({ page, browser }) => {
  await signIn(page, HYPATIA)
  await gotoHydrated(page, '/')
  const sheet = await openAddDishWithoutLink(page)
  await sheet.getByLabel('Titel').fill('Ofengemüse')

  await sheet.getByRole('button', { name: 'Bild wählen' }).click()
  const dialog = imageDialog(page)
  // No link, so no "Bild vom Link": an own photo or a Placeholder.
  await expect(dialog.getByRole('button', { name: 'Bild vom Link' })).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'Platzhalter' })).toBeVisible()
  await pickPhoto(dialog, await phonePhoto('#7a4'))

  await expect(dialog).toBeHidden()
  const preview = sheet.getByRole('img', { name: 'Eigenes Foto' })
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('src', /^\/images\/dishes\/[0-9a-f-]{36}\.jpg$/)
  const stored = (await preview.getAttribute('src'))!
  // With a photo, no Placeholder picker.
  await expect(sheet.getByRole('radiogroup', { name: 'Bild' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Speichern' }).click()

  await expect(sheet).toBeHidden()
  await expect(card(page, 'Ofengemüse').locator('[data-dish-image]')).toHaveAttribute('src', stored)
  await expect(page.locator('[data-toast]')).toHaveCount(0)

  // Stored scaled down, as a JPEG, without the photo's metadata.
  const bytes = await (await page.request.get(stored)).body()
  const { format, width, exif } = await sharp(bytes).metadata()
  expect({ format, width, exif }).toEqual({ format: 'jpeg', width: 1600, exif: undefined })

  // Another Member sees it too.
  const token = await inviteToken(page, await landingBoardId(page))
  const mileva = await newTab(browser)
  await signIn(mileva, MILEVA)
  expect((await mileva.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  await gotoHydrated(mileva, '/')
  await expect(card(mileva, 'Ofengemüse').locator('[data-dish-image]')).toHaveAttribute('src', stored)
  await mileva.context().close()
})

test('a file that isn’t a photo, or is too large, is refused kindly and the dialog stays open', async ({ page }) => {
  await signIn(page, HYPATIA)
  await gotoHydrated(page, '/')
  const sheet = await openAddDishWithoutLink(page)
  await sheet.getByRole('button', { name: 'Bild wählen' }).click()
  const dialog = imageDialog(page)

  await pickPhoto(dialog, { name: 'rezept.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('Linsen, Reis, Koriander, Kreuzkümmel') })
  await expect(dialog.getByRole('alert')).toHaveText('Das ist kein Foto, das ich lesen kann. JPEG, PNG, WebP oder HEIC gehen.')
  await expect(dialog).toBeVisible()

  await pickPhoto(dialog, { name: 'riesig.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(10_000_001) })
  await expect(dialog.getByRole('alert')).toHaveText('Das Foto ist zu groß. Ein kleineres oder ein JPEG klappt bestimmt.')
  await expect(dialog).toBeVisible()

  // Opened again, it starts afresh.
  await dialog.getByRole('button', { name: 'Schließen' }).click()
  await sheet.getByRole('button', { name: 'Bild wählen' }).click()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(sheet.getByRole('img', { name: 'Eigenes Foto' })).toHaveCount(0)
})

test('with a link, the dialog offers "Bild vom Link" back after a photo or a Placeholder', async ({ page }) => {
  const found = 'https://images.invalid/linsen-cover.png'
  await stubSourceLookup(page, { kind: 'blog', canonicalLink: 'https://koch.example/linsen', suggestedTitle: 'Linsensalat', imageUrl: found, imageTicket: 'fixture-ticket' })
  await stubImage(page, found, 400, 300)
  await signIn(page, HYPATIA)
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await sheet.getByLabel('Link').fill('https://koch.example/linsen')
  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toHaveAttribute('src', found)

  await sheet.getByRole('button', { name: 'Bild ändern' }).click()
  await pickPhoto(imageDialog(page), await phonePhoto('#a47'))
  await expect(imageDialog(page)).toBeHidden()
  await expect(sheet.getByRole('img', { name: 'Eigenes Foto' })).toBeVisible()
  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toHaveCount(0)

  await sheet.getByRole('button', { name: 'Bild ändern' }).click()
  await imageDialog(page).getByRole('button', { name: 'Bild vom Link' }).click()
  await expect(imageDialog(page)).toBeHidden()
  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toHaveAttribute('src', found)
  await expect(sheet.getByRole('img', { name: 'Eigenes Foto' })).toHaveCount(0)

  // A Placeholder replaces it; "Bild vom Link" brings it back again.
  await sheet.getByRole('button', { name: 'Bild ändern' }).click()
  await imageDialog(page).getByRole('radio', { name: 'Ramen' }).click()
  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toHaveCount(0)
  await sheet.getByRole('button', { name: 'Bild wählen' }).click()
  await imageDialog(page).getByRole('button', { name: 'Bild vom Link' }).click()
  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toHaveAttribute('src', found)
})

test('a Member replaces a Dish’s image with a photo in the detail, and every Member sees it', async ({ page, browser }) => {
  await signIn(page, HYPATIA)
  await gotoHydrated(page, '/')
  const before = (await card(page, 'Ofengemüse').locator('[data-dish-image]').getAttribute('src'))!
  await page.getByRole('link', { name: 'Ofengemüse' }).click()
  const detail = page.getByRole('dialog', { name: 'Ofengemüse' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()

  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  await pickPhoto(imageDialog(page), await phonePhoto('#47a'))
  await expect(imageDialog(page)).toBeHidden()
  const preview = detail.getByRole('img', { name: 'Eigenes Foto' })
  await expect(preview).toHaveAttribute('src', /^\/images\/dishes\/[0-9a-f-]{36}\.jpg$/)
  const replaced = (await preview.getAttribute('src'))!
  expect(replaced).not.toBe(before)
  await detail.getByRole('button', { name: 'Speichern' }).click()

  await expect(detail.locator('[data-detail-image] [data-dish-image]')).toHaveAttribute('src', replaced)
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(card(page, 'Ofengemüse').locator('[data-dish-image]')).toHaveAttribute('src', replaced)

  const mileva = await newTab(browser)
  await signIn(mileva, MILEVA)
  await gotoHydrated(mileva, '/')
  await expect(card(mileva, 'Ofengemüse').locator('[data-dish-image]')).toHaveAttribute('src', replaced)
  await mileva.context().close()

  // And back to a Placeholder, even the one it had all along.
  await reloadHydrated(page)
  await page.getByRole('link', { name: 'Ofengemüse' }).click()
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  await imageDialog(page).getByRole('radio', { name: 'Salat / Bowl' }).click()
  await detail.getByRole('button', { name: 'Speichern' }).click()
  await expect(detail.locator('[data-detail-image] img[src="/placeholders/bowl-light.svg"]').first()).toBeVisible()
  await expect(detail.locator('[data-dish-image]')).toHaveCount(0)
})
