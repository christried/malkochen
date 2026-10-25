import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'

// Sheets and dialogs close on a click on the backdrop only when the press
// started there too, and never while something is typed into them (#390).
// ✕ and Escape always close. Cecilia's Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// A press from inside the sheet's title area that ends on the backdrop.
async function dragOut(page: Page, sheet: ReturnType<Page['getByRole']>) {
  const box = await sheet.boundingBox()
  if (!box) throw new Error('sheet has no box')
  await page.mouse.move(box.x + box.width / 2, box.y + 40)
  await page.mouse.down()
  await page.mouse.move(4, 4, { steps: 8 })
  await page.mouse.up()
}

test.beforeEach(async ({ page }) => {
  await signIn(page, ALLOWLISTED[59])
  await resetBoard(page)
  await seedDish(page, { title: 'Ofengemüse', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
})

test('a press that starts inside a sheet and ends on the backdrop keeps it open', async ({ page }) => {
  await page.keyboard.press('?')
  const sheet = page.getByRole('dialog', { name: 'Tastenkürzel' })
  await expect(sheet).toBeVisible()
  await dragOut(page, sheet)
  await expect(sheet).toBeVisible()
})

test('a click on the backdrop closes an empty sheet', async ({ page }) => {
  await page.keyboard.press('?')
  const sheet = page.getByRole('dialog', { name: 'Tastenkürzel' })
  await expect(sheet).toBeVisible()
  await page.mouse.click(4, 4)
  await expect(sheet).toBeHidden()
})

test('a sheet with typed input ignores a click on the backdrop', async ({ page }) => {
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Link').fill('Pasta mit Pilzen')
  await page.mouse.click(4, 4)
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Link').fill('')
  await page.mouse.click(4, 4)
  await expect(sheet).toBeHidden()
})

test('✕ and Escape still close a sheet with typed input', async ({ page }) => {
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await sheet.getByLabel('Link').fill('Pasta mit Pilzen')
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  await expect(sheet).toBeHidden()
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  await expect(sheet).toBeVisible()
  await sheet.getByLabel('Link').fill('Pasta mit Pilzen')
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
})

test('the Dish detail closes on a click on its backdrop, not on a press that ends there from inside', async ({ page }) => {
  await page.getByRole('link', { name: 'Ofengemüse' }).click()
  const detail = page.getByRole('dialog', { name: 'Ofengemüse' })
  await expect(detail).toBeVisible()
  // It moves in (morphing from the card) before it takes presses.
  await detail.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  await dragOut(page, detail)
  await expect(detail).toBeVisible()
  await page.mouse.click(100, 450)
  await expect(detail).toBeHidden()
})

// The Board's header (#390): from the desktop breakpoint the cogwheel sits
// next to your Profile Picture, and the search opens in the header's centre
// when there is room; on phones and tablets both are as they were.
const DESKTOP = { width: 1280, height: 900 }
const TABLET = { width: 820, height: 1000 }
const PHONE = { width: 390, height: 844 }

function centreY(box: { y: number, height: number }) {
  return box.y + box.height / 2
}

test.describe('the header', () => {
  test('on desktop the cogwheel sits next to your Profile Picture', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await gotoHydrated(page, '/')
    const cogwheel = page.getByRole('button', { name: 'Einstellungen', exact: true })
    const picture = page.getByRole('button', { name: 'Dein Konto' })
    const a = await cogwheel.boundingBox()
    const b = await picture.boundingBox()
    expect(a && b).toBeTruthy()
    expect(Math.abs(centreY(a!) - centreY(b!))).toBeLessThanOrEqual(2)
    const gap = b!.x - (a!.x + a!.width)
    expect(gap).toBeGreaterThan(0)
    expect(gap).toBeLessThanOrEqual(16)
  })

  test('on tablet and phones the cogwheel stays with the Board switcher', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await gotoHydrated(page, '/')
    const cogwheel = page.getByRole('button', { name: 'Einstellungen', exact: true })
    const picture = page.getByRole('button', { name: 'Dein Konto' })
    await expect(picture).toBeVisible()
    const a = await cogwheel.boundingBox()
    const b = await picture.boundingBox()
    expect(a!.x).toBeLessThan(TABLET.width / 2)
    expect(b!.x).toBeGreaterThan(TABLET.width / 2)

    await page.setViewportSize(PHONE)
    await expect(picture).toBeHidden()
    const phone = await cogwheel.boundingBox()
    expect(phone!.x).toBeLessThan(PHONE.width / 2)
  })

  test('on desktop the search opens in the header\'s centre when there is room', async ({ page }) => {
    await page.setViewportSize(DESKTOP)
    await gotoHydrated(page, '/')
    await page.getByRole('button', { name: 'Gerichte suchen' }).click()
    const bar = page.getByRole('search')
    await expect(bar).toBeVisible()
    const header = await page.locator('header').boundingBox()
    const box = await bar.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(header!.y)
    expect(box!.y + box!.height).toBeLessThanOrEqual(header!.y + header!.height)
    const midX = box!.x + box!.width / 2
    expect(Math.abs(midX - (header!.x + header!.width / 2))).toBeLessThan(header!.width / 6)
  })

  test('on tablet the search opens under the header, as before', async ({ page }) => {
    await page.setViewportSize(TABLET)
    await gotoHydrated(page, '/')
    await page.getByRole('button', { name: 'Gerichte suchen' }).click()
    const bar = page.getByRole('search')
    await expect(bar).toBeVisible()
    const header = await page.locator('header').boundingBox()
    const box = await bar.boundingBox()
    expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height)
  })
})
