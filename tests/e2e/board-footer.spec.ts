import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'

// The footer at the end of the Board (#405, spec #388): "Was ist neu" and the
// legal pages, not in the menus any more. Read only; Claude Shannon is used
// by this file only.
const SHANNON = ALLOWLISTED[133]

test.beforeEach(async ({ page }) => {
  await signIn(page, SHANNON)
})

async function openFooter(page: Page) {
  await gotoHydrated(page, '/')
  const footer = page.getByTestId('board-footer')
  await footer.scrollIntoViewIfNeeded()
  return footer
}

for (const [name, size] of [['phone', { width: 360, height: 800 }], ['desktop', { width: 1280, height: 900 }]] as const) {
  test(`on ${name} the Board ends in a footer with the Changelog and the legal pages, centred`, async ({ page }) => {
    await page.setViewportSize(size)
    const footer = await openFooter(page)

    await expect(footer).toBeVisible()
    const links = footer.getByRole('link')
    await expect(links).toHaveText(['Was ist neu', 'Impressum', 'Datenschutz'])
    expect(await links.evaluateAll(all => all.map(a => a.getAttribute('href')))).toEqual(['/changelog', '/impressum', '/datenschutz'])
    await expect(page.getByRole('navigation', { name: 'Über malkochen' })).toBeVisible()
    const box = (await footer.locator('nav').boundingBox())!
    expect(Math.abs(box.x + box.width / 2 - size.width / 2)).toBeLessThanOrEqual(2)
  })
}

test('the legal pages are not in the Board switcher on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: /Board wechseln/ }).click()

  const panel = page.getByRole('navigation', { name: 'Deine Boards' })
  await expect(panel).toBeVisible()
  await expect(panel.getByRole('link', { name: 'Impressum' })).toHaveCount(0)
  await expect(panel.getByRole('link', { name: 'Datenschutz' })).toHaveCount(0)
})

test('the user menu on desktop only has "Abmelden"', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Dein Konto' }).click()

  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveText(['Abmelden'])
})
