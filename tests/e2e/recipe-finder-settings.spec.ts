import { expect, newTab, test } from './fixtures'
import { OPERATOR } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'
import { openUserSettings } from './settings-sheet'

// The Recipe Finder in Your Settings and on the Admin Page (#498, ADR 0013):
// every user can ask for access; the Operator sees who asked and switches
// them on; the user then sees it switched on, with the note about Anthropic.
// What the switch does to searching is covered by the API tests. Blanchard
// is used by this file only.
const BLANCHARD = 'blanchard@example.com'

test('a user asks for the Recipe Finder, the Operator switches it on, and the user sees it on', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, BLANCHARD, { name: 'Blanche' })

  // Off: what it does, and the way to ask.
  let sheet = await openUserSettings(page)
  let section = sheet.getByRole('region', { name: 'Rezeptfinder' })
  await expect(section).toContainText('Der Rezeptfinder sucht dir Zutaten und Schritte zu einem Gericht heraus')
  const ask = section.getByRole('button', { name: 'Zugang anfragen' })
  await expect(ask).toBeEnabled()
  await ask.click()

  // Asked: the chip, and the sentence that closes the loop. Nothing left to press.
  await expect(section.getByText('Angefragt', { exact: true })).toBeVisible()
  await expect(section).toContainText(/Deine Anfrage vom \d{1,2}\. \p{L}+ ist angekommen\. Mehr musst du nicht tun\./u)
  await expect(ask).toBeHidden()

  // Still so after a reload.
  sheet = await openUserSettings(page)
  section = sheet.getByRole('region', { name: 'Rezeptfinder' })
  await expect(section.getByText('Angefragt', { exact: true })).toBeVisible()
  await expect(section.getByRole('button', { name: 'Zugang anfragen' })).toBeHidden()

  // The Operator sees the request on the Admin Page, as a table on a computer
  // and as a list on a phone, and switches the user on.
  const operator = await newTab(browser, { viewport: { width: 1280, height: 900 } })
  try {
    await signIn(operator, OPERATOR)
    await gotoHydrated(operator, '/admin')
    const admin = operator.getByRole('region', { name: 'Rezeptfinder' })
    await expect(admin.getByRole('row', { name: /Blanche blanchard@example\.com/ })).toBeVisible()
    const row = admin.getByRole('row', { name: /Blanche/ })
    await expect(row).toContainText(/\d{1,2}\. \p{L}+/u)
    await expect(row).toContainText('0 heute')

    await operator.setViewportSize({ width: 360, height: 800 })
    const listed = admin.getByRole('listitem').filter({ hasText: 'Blanche' })
    await expect(listed).toContainText('Angefragt am')
    await expect(listed).toContainText('Noch keine Suchen')
    expect(await operator.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

    const toggle = admin.getByRole('switch', { name: 'Rezeptfinder für Blanche' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    // On for the user: the sage chip and the note about Anthropic, no switch
    // and no button.
    sheet = await openUserSettings(page)
    section = sheet.getByRole('region', { name: 'Rezeptfinder' })
    await expect(section.getByText('Eingeschaltet', { exact: true })).toBeVisible()
    await expect(section).toContainText('gehen die Caption und der Text der verlinkten Seite an Anthropic')
    await expect(section.getByRole('link', { name: 'Mehr dazu im Datenschutz' })).toHaveAttribute('href', '/datenschutz')
    await expect(section.getByRole('switch')).toHaveCount(0)
    await expect(section.getByRole('button')).toHaveCount(0)

    // Switched off again by the Operator: the user is back to asking. The row
    // stays until the page is loaded again.
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(admin.getByRole('listitem').filter({ hasText: 'Blanche' })).toBeVisible()
    sheet = await openUserSettings(page)
    section = sheet.getByRole('region', { name: 'Rezeptfinder' })
    await expect(section.getByRole('button', { name: 'Zugang anfragen' })).toBeVisible()

    await gotoHydrated(operator, '/admin')
    await expect(operator.getByRole('region', { name: 'Rezeptfinder' }).getByRole('listitem').filter({ hasText: 'Blanche' })).toHaveCount(0)
  }
  finally {
    await operator.context().close()
  }
})

test('the Recipe Finder section is there for every user', async ({ page }) => {
  await signIn(page, BLANCHARD, { name: 'Blanche' })
  const sheet = await openUserSettings(page)
  await expect(sheet.getByRole('region', { name: 'Rezeptfinder' }).getByRole('heading', { name: 'Rezeptfinder', level: 3 })).toBeVisible()
  // After Snackbert's place and before "Konto löschen".
  const headings = await sheet.getByRole('heading', { level: 3 }).allTextContents()
  expect(headings.indexOf('Rezeptfinder')).toBeLessThan(headings.indexOf('Konto löschen'))
})
