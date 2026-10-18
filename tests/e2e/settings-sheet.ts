import type { Page } from '@playwright/test'
import { expect } from './fixtures'
import { gotoHydrated } from './hydration'

// Your settings: a sheet over the Board (#210), "Einstellungen" in German,
// "Settings" in English (languages.spec.ts).
export function settingsSheet(page: Page, title = 'Einstellungen') {
  return page.getByRole('dialog', { name: title, exact: true })
}

// Opens them the short way: /settings forwards to the Board opened last, with
// the sheet open over it, and waits until it has moved in. A reload shows the
// Board without it.
export async function openUserSettings(page: Page, title?: string) {
  await gotoHydrated(page, '/settings')
  const sheet = settingsSheet(page, title)
  await expect(sheet).toBeVisible()
  await sheet.evaluate(el => Promise.all(el.getAnimations({ subtree: true }).map(a => a.finished)))
  return sheet
}
