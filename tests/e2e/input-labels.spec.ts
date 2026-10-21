import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { openBoardSettings } from './board'
import { gotoHydrated } from './hydration'
import { resetBoard, seedDish } from './seed'

// Input labels (#137): label style 5b from the design handoff (components.json
// → Input), the label sitting in the field's border, in a notch. Hilde's
// Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// Where a field's label is, against its control's border, and the colours of
// its label and border, next to the theme's own.
async function fieldLooks(page: Page, control: Locator) {
  return control.evaluate((el) => {
    const field = el.closest('.field')!
    const label = field.querySelector(':scope > label')!
    const outline = field.querySelector(':scope > fieldset')!
    const legend = outline.querySelector('legend')!
    const swatch = (token: string) => {
      const probe = document.createElement('span')
      probe.style.color = `var(${token})`
      document.body.append(probe)
      const colour = getComputedStyle(probe).color
      probe.remove()
      return colour
    }
    const box = outline.getBoundingClientRect()
    const labelBox = label.getBoundingClientRect()
    const borderWidth = Number.parseFloat(getComputedStyle(outline).borderTopWidth)
    // The top border's line runs where the legend is, centred on it.
    const legendBox = legend.getBoundingClientRect()
    return {
      labelText: label.textContent?.trim(),
      legendText: legend.textContent?.trim(),
      hiddenFromReaders: outline.getAttribute('aria-hidden'),
      labelCentre: labelBox.top + labelBox.height / 2,
      borderCentre: legendBox.top + legendBox.height / 2,
      labelInside: labelBox.left > box.left && labelBox.right < box.right,
      borderWidth,
      labelColour: getComputedStyle(label).color,
      borderColour: getComputedStyle(outline).borderTopColor,
      muted: swatch('--color-text-muted'),
      text: swatch('--color-text'),
      danger: swatch('--color-danger'),
      outline: swatch('--field-outline'),
    }
  })
}

// Colours come in over 180ms: polled until they have settled on `expected`
// (the theme's tokens: label, then border).
async function expectColours(page: Page, control: Locator, expected: (looks: Awaited<ReturnType<typeof fieldLooks>>) => [string, string]) {
  await expect.poll(async () => {
    const looks = await fieldLooks(page, control)
    return [looks.labelColour, looks.borderColour].join(' / ') === expected(looks).join(' / ')
  }).toBe(true)
}

async function expectLabelInBorder(page: Page, control: Locator, name: string) {
  await expect(control).toBeVisible()
  await control.blur()
  const looks = await fieldLooks(page, control)
  expect(looks.labelText).toBe(name)
  expect(looks.legendText).toBe(name)
  expect(looks.hiddenFromReaders).toBe('true')
  expect(Math.abs(looks.labelCentre - looks.borderCentre)).toBeLessThanOrEqual(1)
  expect(looks.labelInside).toBe(true)
  expect(looks.borderWidth).toBe(2)
  await expectColours(page, control, l => [l.muted, l.outline])

  // Focus: the border and the label in the text colour.
  await control.focus()
  await expectColours(page, control, l => [l.text, l.text])
  await control.blur()
}

for (const scheme of ['light', 'dark'] as const) {
  test(`every labelled field has its label in the border (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await signIn(page, ALLOWLISTED[33])
    await resetBoard(page)
    await seedDish(page, { title: 'Ofengemüse', sourceLink: TIKTOK, sourceKind: 'tiktok' })

    // Board settings.
    await gotoHydrated(page, '/')
    // The Board has "Name" fields of its own, in sheets that aren't open.
    await openBoardSettings(page)
    await expectLabelInBorder(page, page.getByLabel('Name', { exact: true }), 'Name')
    await expectLabelInBorder(page, page.getByLabel('Neue Spalte'), 'Neue Spalte')
    await expectLabelInBorder(page, page.getByLabel('Einladungslink', { exact: true }), 'Einladungslink')
    await page.getByRole('link', { name: 'Zurück zum Board' }).click()

    // Add Dish: the link step, then the form.
    await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
    let sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
    await expectLabelInBorder(page, sheet.getByLabel('Link'), 'Link')
    await sheet.getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
    sheet = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
    await expectLabelInBorder(page, sheet.getByLabel('Titel'), 'Titel')
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)

    // The Dish detail's edit mode; a link that isn't one shows as an error.
    await page.getByRole('link', { name: 'Ofengemüse' }).click()
    const detail = page.getByRole('dialog', { name: 'Ofengemüse' })
    await detail.getByRole('button', { name: 'Bearbeiten' }).click()
    await expectLabelInBorder(page, detail.getByLabel('Titel'), 'Titel')
    await expectLabelInBorder(page, detail.getByLabel('Veröffentlicht von'), 'Veröffentlicht von')
    const link = detail.getByLabel('Link')
    await expectLabelInBorder(page, link, 'Link')
    await link.fill('kein Link')
    await link.blur()
    await expectColours(page, link, l => [l.danger, l.danger])
  })
}
