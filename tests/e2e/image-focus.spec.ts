import type { Locator, Page } from '@playwright/test'
import sharp from 'sharp'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { inviteToken } from './invite'
import { landingBoardId, removeStoredImages, seedDish, storedImage } from './seed'

// A Dish's image shifted within its frame (its focus point): in the image
// dialog, a Source image or own photo is dragged, scrolled or moved with the
// arrow keys inside a preview with the card's frame. Every frame showing the
// image then shows that part, for every Member. Maria's Board is used by this
// file only; Inge joins it to look.
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const MARIA = ALLOWLISTED[27]
const INGE = ALLOWLISTED[28]
const TIKTOK = 'https://www.tiktok.com/@veganschnitzel/video/7301234567890123456'

test.afterAll(removeStoredImages)

function imageDialog(page: Page) {
  return page.getByRole('dialog', { name: 'Bild wählen' })
}

function card(page: Page, title: string) {
  return column(page, 'Ideen').getByRole('article', { name: title })
}

// The "Ausschnitt" preview, once its image has loaded.
async function focusPreview(dialog: Locator) {
  const preview = dialog.getByRole('slider', { name: 'Ausschnitt' })
  await expect(preview.locator('img')).toHaveJSProperty('complete', true)
  return preview
}

// Drags the preview's image by `dy` px, as a finger or mouse would.
async function dragImage(page: Page, preview: Locator, dy: number) {
  const box = (await preview.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x, y + dy / 2, { steps: 4 })
  await page.mouse.move(x, y + dy, { steps: 4 })
  await page.mouse.up()
}

async function photo(width: number, height: number) {
  const buffer = await sharp({ create: { width, height, channels: 3, background: '#a47' } }).jpeg().toBuffer()
  return { name: 'IMG_3017.jpg', mimeType: 'image/jpeg', buffer }
}

test('shifting a portrait TikTok image shows that part on the card and in the detail, for every Member', async ({ page, browser }) => {
  await signIn(page, MARIA)
  await gotoHydrated(page, '/')
  await seedDish(page, { title: 'Crispy Reispapier', sourceLink: TIKTOK, sourceKind: 'tiktok', imageUrl: await storedImage(360, 640) })
  await reloadHydrated(page)
  const image = card(page, 'Crispy Reispapier').locator('[data-dish-image]')
  // Until someone shifts it, the middle of it.
  await expect(image).toHaveCSS('object-position', '50% 50%')

  await page.getByRole('link', { name: 'Crispy Reispapier' }).click()
  const detail = page.getByRole('dialog', { name: 'Crispy Reispapier' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  const preview = await focusPreview(imageDialog(page))
  // A portrait image in the card's frame moves up and down.
  await expect(preview).toHaveAttribute('aria-orientation', 'vertical')
  await expect(preview).toHaveAttribute('aria-valuetext', '50 % von links, 50 % von oben')

  // Dragged up, as far as it goes: its lower part shows.
  await dragImage(page, preview, -300)
  await expect(preview).toHaveAttribute('aria-valuetext', '50 % von links, 100 % von oben')
  // And with the keyboard, the focus point back up a little.
  await preview.focus()
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(preview).toHaveAttribute('aria-valuetext', '50 % von links, 90 % von oben')
  // Sideways there's nothing more to see.
  await page.keyboard.press('ArrowLeft')
  await expect(preview).toHaveAttribute('aria-valuetext', '50 % von links, 90 % von oben')
  await imageDialog(page).getByRole('button', { name: 'Schließen' }).click()
  await detail.getByRole('button', { name: 'Speichern' }).click()

  await expect(detail.locator('[data-detail-image] [data-dish-image]')).toHaveCSS('object-position', '50% 90%')
  await detail.getByRole('button', { name: 'Schließen' }).first().click()
  await expect(image).toHaveCSS('object-position', '50% 90%')

  // Another Member sees the same part.
  const token = await inviteToken(page, await landingBoardId(page))
  const inge = await newTab(browser)
  await signIn(inge, INGE)
  expect((await inge.request.post(`/api/invites/${token}/join`)).status()).toBe(200)
  await gotoHydrated(inge, '/')
  await expect(card(inge, 'Crispy Reispapier').locator('[data-dish-image]')).toHaveCSS('object-position', '50% 90%')
  await inge.getByRole('link', { name: 'Crispy Reispapier' }).click()
  await expect(inge.locator('[data-detail-image] [data-dish-image]')).toHaveCSS('object-position', '50% 90%')
  await inge.context().close()
})

test('a new photo starts in the middle, and a Placeholder has nothing to shift', async ({ page }) => {
  await signIn(page, MARIA)
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Crispy Reispapier' }).click()
  const detail = page.getByRole('dialog', { name: 'Crispy Reispapier' })
  await detail.getByRole('button', { name: 'Bearbeiten' }).click()

  // A landscape photo in the card's frame moves sideways.
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  await imageDialog(page).getByLabel('Eigenes Foto').setInputFiles(await photo(1600, 900))
  await expect(imageDialog(page)).toBeHidden()
  await expect(detail.getByRole('img', { name: 'Eigenes Foto' })).toHaveCSS('object-position', '50% 50%')
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  const preview = await focusPreview(imageDialog(page))
  await expect(preview).toHaveAttribute('aria-orientation', 'horizontal')
  await expect(preview).toHaveAttribute('aria-valuetext', '50 % von links, 50 % von oben')
  await preview.focus()
  await page.keyboard.press('ArrowLeft')
  await expect(preview).toHaveAttribute('aria-valuetext', '45 % von links, 50 % von oben')
  // What the dialog shifts, the edit form's image shows too.
  await expect(detail.getByRole('img', { name: 'Eigenes Foto' })).toHaveCSS('object-position', '45% 50%')

  // A Placeholder: nothing to shift.
  await imageDialog(page).getByRole('radio', { name: 'Ramen' }).click()
  await detail.getByRole('button', { name: 'Bild wählen' }).click()
  await expect(imageDialog(page).getByRole('heading', { name: 'Platzhalter' })).toBeVisible()
  await expect(imageDialog(page).getByRole('slider', { name: 'Ausschnitt' })).toHaveCount(0)
  await imageDialog(page).getByRole('button', { name: 'Schließen' }).click()
  await detail.getByRole('button', { name: 'Abbrechen' }).click()

  // Cancelled: the Dish keeps its image where it was shifted to.
  await expect(detail.locator('[data-detail-image] [data-dish-image]')).toHaveCSS('object-position', '50% 90%')
})

test('a photo shifted while adding a Dish shows that part on its card', async ({ page }) => {
  await signIn(page, MARIA)
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await page.getByRole('dialog', { name: 'Gericht hinzufügen' }).getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  await sheet.getByLabel('Titel').fill('Sommerrollen')
  await sheet.getByRole('button', { name: 'Bild wählen' }).click()
  await imageDialog(page).getByLabel('Eigenes Foto').setInputFiles(await photo(900, 1600))

  await sheet.getByRole('button', { name: 'Bild ändern' }).click()
  const preview = await focusPreview(imageDialog(page))
  // Scrolling over it shifts it as a page would scroll: down shows more below.
  await preview.hover()
  await page.mouse.wheel(0, 400)
  await expect(preview).toHaveAttribute('aria-valuetext', '50 % von links, 100 % von oben')
  await dragImage(page, preview, 300)
  await expect(preview).toHaveAttribute('aria-valuetext', '50 % von links, 0 % von oben')
  await imageDialog(page).getByRole('button', { name: 'Schließen' }).click()
  await expect(sheet.getByRole('img', { name: 'Eigenes Foto' })).toHaveCSS('object-position', '50% 0%')
  await sheet.getByRole('button', { name: 'Speichern' }).click()

  await expect(sheet).toBeHidden()
  await expect(card(page, 'Sommerrollen').locator('[data-dish-image]')).toHaveCSS('object-position', '50% 0%')
  await reloadHydrated(page)
  await expect(card(page, 'Sommerrollen').locator('[data-dish-image]')).toHaveCSS('object-position', '50% 0%')
})
