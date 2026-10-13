import type { Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { column } from './board'
import { gotoHydrated, reloadHydrated } from './hydration'
import { landingBoardId, resetBoard, seedDish } from './seed'

// Board settings (PRD stories 57–60, 62, 63): the Board's name and emoji,
// its Columns, and copying and sharing its Invite Link. Ida's Board is used
// by this file only; each test starts it afresh, as a new Board.

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

// The Column names in settings, top to bottom, until they are `expected`.
async function expectColumnNames(page: Page, expected: string[]) {
  const fields = page.getByRole('list', { name: 'Spalten' }).getByRole('textbox', { name: /^Name der Spalte/ })
  await expect.poll(() => fields.evaluateAll(els => els.map(el => (el as HTMLInputElement).value))).toEqual(expected)
}

function row(page: Page, name: string) {
  return page.getByRole('listitem').filter({ has: page.getByRole('textbox', { name: `Name der Spalte „${name}“` }) })
}

// Signs in as Ida with a fresh Board, `before` it is shown (e.g. to seed
// Dishes), and opens its settings from the Board.
async function openSettings(page: Page, before?: () => Promise<void>) {
  await signIn(page, ALLOWLISTED[8])
  await resetBoard(page)
  await before?.()
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Board-Einstellungen' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
  // Its own page: nothing of the Board behind it.
  await expect(page.getByRole('button', { name: 'Gericht hinzufügen' })).toHaveCount(0)
}

test('a Member renames the Board and picks another emoji', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSettings(page)

  const name = page.getByLabel('Name', { exact: true })
  await name.fill('Kochclub')
  await name.press('Enter')
  await page.getByRole('button', { name: 'Emoji ändern' }).click()
  await page.getByRole('dialog', { name: 'Emoji wählen' }).getByRole('radio', { name: '🍜' }).click()

  await expect(page.getByRole('button', { name: 'Emoji ändern' })).toHaveText('🍜')
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🍜 Kochclub')
  await reloadHydrated(page)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🍜 Kochclub')
})

test('the new Column field suggests one of its example names, and another once a Column is added', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSettings(page)

  const field = page.getByLabel('Neue Spalte')
  await expect(field).toHaveAttribute('placeholder', /^z\. B\. „(Wochenende|Meal Prep|Für Gäste|Schnell & einfach|Sonntagsbrunch|Nachtisch|Grillsaison|Lunchbox|Feierabendküche|Weihnachten)“$/)

  // Math.random() answering .75 picks the eighth of the ten.
  await page.evaluate(() => { Math.random = () => 0.75 })
  await field.fill('Vorrat')
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht', 'Vorrat'])
  await expect(field).toHaveValue('')
  await expect(field).toHaveAttribute('placeholder', 'z. B. „Lunchbox“')
})

test('a Member adds, renames and reorders Columns; Gekocht is marked and can’t be deleted', async ({ page }) => {
  await openSettings(page)
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])
  await expect(row(page, 'Gekocht')).toContainText('Kann nicht gelöscht werden')
  await expect(page.getByRole('button', { name: 'Spalte „Gekocht“ löschen' })).toHaveCount(0)

  await page.getByLabel('Neue Spalte').fill('Wochenende')
  // The add button sits centred beside the field.
  const middle = async (box: Promise<{ y: number, height: number } | null>) => {
    const { y, height } = (await box)!
    return y + height / 2
  }
  const fieldMiddle = await middle(page.getByLabel('Neue Spalte').boundingBox())
  expect(Math.abs(await middle(page.getByRole('button', { name: 'Hinzufügen' }).boundingBox()) - fieldMiddle)).toBeLessThanOrEqual(1)
  await page.getByRole('button', { name: 'Hinzufügen' }).click()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht', 'Wochenende'])

  const renamed = page.getByRole('textbox', { name: 'Name der Spalte „Wochenende“' })
  await renamed.fill('Für Gäste')
  await renamed.press('Enter')
  await page.getByRole('button', { name: '„Für Gäste“ nach oben' }).click()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Für Gäste', 'Gekocht'])

  await reloadHydrated(page)
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Für Gäste', 'Gekocht'])
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page.getByRole('region').getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Für Gäste', 'Gekocht'])
})

// A Column's subtitle field in settings.
function subtitleField(page: Page, name: string) {
  return page.getByRole('textbox', { name: `Untertitel der Spalte „${name}“` })
}

async function setSubtitle(page: Page, name: string, subtitle: string) {
  const field = subtitleField(page, name)
  await field.fill(subtitle)
  const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/api/columns/') && r.ok())
  await field.press('Enter')
  await saved
}

test('a Member sets and clears Column Subtitles; the Gekocht Column’s is fixed', async ({ page }) => {
  await openSettings(page)
  await expect(subtitleField(page, 'Ideen')).toHaveValue('Worauf hast du Lust?')
  await expect(subtitleField(page, 'Diese Woche')).toHaveValue('Das steht an.')
  await expect(subtitleField(page, 'Ideen')).toHaveAttribute('maxlength', '40')
  await expect(subtitleField(page, 'Gekocht')).toHaveCount(0)
  await expect(row(page, 'Gekocht')).toContainText('Schon geschafft!')

  await setSubtitle(page, 'Ideen', '  Was wir mal kochen wollen ')
  await setSubtitle(page, 'Diese Woche', '')
  await expect(subtitleField(page, 'Ideen')).toHaveValue('Was wir mal kochen wollen')

  await reloadHydrated(page)
  await expect(subtitleField(page, 'Ideen')).toHaveValue('Was wir mal kochen wollen')
  await expect(subtitleField(page, 'Diese Woche')).toHaveValue('')
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(column(page, 'Ideen')).toContainText('Was wir mal kochen wollen')
  await expect(column(page, 'Diese Woche').locator('[data-column-subtitle]')).toHaveCount(0)
})

test('on a computer, each Column shows its name large with its subtitle below, “Diese Woche” on one line', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openSettings(page)
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()

  for (const [name, subtitle] of [['Ideen', 'Worauf hast du Lust?'], ['Diese Woche', 'Das steht an.'], ['Gekocht', 'Schon geschafft!']]) {
    const lane = column(page, name!)
    await expect(lane.getByRole('heading', { level: 2 })).toHaveText(name!)
    await expect(lane.locator('[data-column-subtitle]')).toHaveText(subtitle!)
    await expect(lane.locator('[data-column-subtitle]')).toHaveCSS('font-style', 'italic')
  }
  const title = column(page, 'Diese Woche').getByRole('heading', { level: 2 })
  expect(parseFloat(await title.evaluate(el => getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(32)
  // One line: the name doesn't wrap in a 330px lane.
  const { height, lineHeight } = await title.evaluate(el => ({ height: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight) }))
  expect(height).toBeLessThan(lineHeight * 1.5)
})

test('on a computer, a lane without a subtitle lines up with the others, and a long name wraps inside its lane', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await openSettings(page)
  await setSubtitle(page, 'Diese Woche', '')
  const renamed = page.getByRole('textbox', { name: 'Name der Spalte „Gekocht“' })
  await renamed.fill('Wochenendeinkaufsplanungfürdiegroßefeier')
  const saved = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().includes('/api/columns/') && r.ok())
  await renamed.press('Enter')
  await saved
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()

  const listTop = (name: string) => column(page, name).locator('[data-dish-list]').evaluate(el => el.getBoundingClientRect().top)
  await expect(column(page, 'Diese Woche').locator('[data-column-subtitle]')).toHaveCount(0)
  expect(await listTop('Diese Woche')).toBe(await listTop('Ideen'))
  const lane = column(page, 'Wochenendeinkaufsplanungfürdiegroßefeier')
  const { title, laneRight } = await lane.evaluate(el => ({
    title: el.querySelector('h2 span')!.getBoundingClientRect().right,
    laneRight: el.getBoundingClientRect().right,
  }))
  expect(title).toBeLessThanOrEqual(laneRight)
})

test('an empty Column goes at once', async ({ page }) => {
  await openSettings(page)

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()

  await expectColumnNames(page, ['Ideen', 'Gekocht'])
  // The last Column besides Gekocht stays.
  await expect(page.getByRole('button', { name: 'Spalte „Ideen“ löschen' })).toBeDisabled()
  await reloadHydrated(page)
  await expectColumnNames(page, ['Ideen', 'Gekocht'])
})

test('a Column with Dishes asks where they go, and they go there', async ({ page }) => {
  await openSettings(page, async () => {
    for (const title of ['Ramen', 'Bibimbap']) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  })

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()
  const dialog = page.getByRole('dialog', { name: '2 Gerichte in „Diese Woche“. Wohin verschieben?' })
  await expect(dialog.getByRole('radio', { name: 'Ideen' })).toBeChecked()
  await dialog.getByRole('radio', { name: 'Gekocht' }).check()
  await dialog.getByRole('button', { name: 'Verschieben und löschen' }).click()

  await expect(dialog).toBeHidden()
  await expectColumnNames(page, ['Ideen', 'Gekocht'])
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(column(page, 'Gekocht').getByRole('heading', { level: 3 })).toHaveText(['Bibimbap', 'Ramen'])
})

test('with Gekocht first, the Dishes of a deleted Column go to the first other Column by default', async ({ page }) => {
  await openSettings(page, async () => {
    await seedDish(page, { title: 'Pho', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })
  })
  for (let i = 0; i < 2; i++) await page.getByRole('button', { name: '„Gekocht“ nach oben' }).click()
  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()

  await expect(page.getByRole('dialog', { name: '1 Gericht in „Diese Woche“. Wohin verschieben?' }).getByRole('radio', { name: 'Ideen' })).toBeChecked()
})

test('a Column that got Dishes since settings opened asks where they go instead of failing', async ({ page }) => {
  await openSettings(page)
  await seedDish(page, { title: 'Laksa', sourceLink: TIKTOK, sourceKind: 'tiktok', column: 1 })

  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()

  await expect(page.getByRole('dialog', { name: '1 Gericht in „Diese Woche“. Wohin verschieben?' })).toBeVisible()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])
})

// Resolves once the Columns' new order has been saved.
function orderSaved(page: Page) {
  return page.waitForResponse(r => r.request().method() === 'PUT' && /\/api\/boards\/[^/]+\/columns$/.test(r.url()) && r.ok())
}

test('a Column dragged by its grip moves, the Gekocht Column too', async ({ page }) => {
  await openSettings(page)
  const grip = (await row(page, 'Gekocht').locator('[data-grip]').boundingBox())!
  const target = (await row(page, 'Ideen').boundingBox())!
  const saved = orderSaved(page)

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2, target.y + 4, { steps: 16 })
  await page.mouse.up()

  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])
  await saved
  await reloadHydrated(page)
  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])
})

// #206: the grip is easy to hit. Its grab area is the row's whole left end,
// from the row's edge to just before the name field and as high as the row;
// the name field and the Dish count beside it never start a drag.
function nameField(page: Page, name: string) {
  return page.getByRole('textbox', { name: `Name der Spalte „${name}“` })
}

// The grab area's corners, a few pixels inside it: by the row's left edge at
// the top, and just before the name field at the bottom. Measured once the
// rows have settled from a move before.
async function grabCorners(page: Page, name: string) {
  await page.getByRole('list', { name: 'Spalten' }).evaluate(list => Promise.all(list.getAnimations({ subtree: true }).map(a => a.finished)))
  const rowBox = (await row(page, name).boundingBox())!
  const field = (await nameField(page, name).boundingBox())!
  return {
    byTheEdge: { x: rowBox.x + 4, y: rowBox.y + 5 },
    beforeTheName: { x: field.x - 8, y: rowBox.y + rowBox.height - 5 },
  }
}

test('the grip is large, and its grab area reaches from the row’s edge to just before the name field', async ({ page }) => {
  await openSettings(page)
  const rowBox = (await row(page, 'Ideen').boundingBox())!
  const grip = (await row(page, 'Ideen').locator('[data-grip]').boundingBox())!
  const field = (await nameField(page, 'Ideen').boundingBox())!

  expect(Math.abs(grip.x - rowBox.x)).toBeLessThanOrEqual(1)
  expect(Math.abs(grip.y - rowBox.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(grip.height - rowBox.height)).toBeLessThanOrEqual(1)
  // It ends just before the name field, not on it.
  const before = field.x - (grip.x + grip.width)
  expect(before).toBeGreaterThanOrEqual(0)
  expect(before).toBeLessThanOrEqual(8)
  // The icon itself: 24px, where it was 18px.
  const icon = (await row(page, 'Ideen').locator('[data-grip] svg').boundingBox())!
  expect(icon.width).toBeGreaterThanOrEqual(24)
  expect(icon.height).toBeGreaterThanOrEqual(24)
})

test('pressing anywhere in the grab area drags the Column, with a mouse', async ({ page }) => {
  await openSettings(page)

  // By the row's left edge: Gekocht up to the top.
  let from = (await grabCorners(page, 'Gekocht')).byTheEdge
  let target = (await row(page, 'Ideen').boundingBox())!
  const saved = orderSaved(page)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x, target.y + 4, { steps: 16 })
  await page.mouse.up()
  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])
  await saved

  // Just before the name field, at the row's bottom: Diese Woche up by one
  // row, above Ideen.
  from = (await grabCorners(page, 'Diese Woche')).beforeTheName
  target = (await row(page, 'Ideen').boundingBox())!
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x, from.y - target.height, { steps: 16 })
  await page.mouse.up()
  await expectColumnNames(page, ['Gekocht', 'Diese Woche', 'Ideen'])
})

// A finger pressing at `from` and moving to `to` before it lifts: real touch
// input, so the page's own handling of touches (scrolling, say) applies.
async function touchDrag(page: Page, from: { x: number, y: number }, to: { x: number, y: number }) {
  const touches = await page.context().newCDPSession(page)
  await touches.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] })
  const steps = 12
  for (let step = 1; step <= steps; step++) {
    await touches.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps }],
    })
  }
  await touches.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await touches.detach()
}

test('pressing anywhere in the grab area drags the Column, with a finger; the name field and the Dish count don’t', async ({ browser }) => {
  const page = await newTab(browser, { hasTouch: true, viewport: { width: 390, height: 844 } })
  await openSettings(page)
  await row(page, 'Gekocht').scrollIntoViewIfNeeded()

  // A tap on the name puts the cursor in it.
  await nameField(page, 'Ideen').tap()
  await expect(nameField(page, 'Ideen')).toBeFocused()

  const from = (await grabCorners(page, 'Gekocht')).beforeTheName
  const target = (await row(page, 'Ideen').boundingBox())!
  await touchDrag(page, from, { x: from.x, y: target.y + 4 })
  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])
  await expectSettled(page, 'Gekocht')

  // A finger moving up from the Dish count scrolls or does nothing: no drag.
  const count = (await row(page, 'Diese Woche').getByText('0 Gerichte').boundingBox())!
  const top = (await row(page, 'Gekocht').boundingBox())!
  await touchDrag(page, { x: count.x + 10, y: count.y + count.height / 2 }, { x: count.x + 10, y: top.y + 4 })
  await expectColumnNames(page, ['Gekocht', 'Ideen', 'Diese Woche'])
  await page.context().close()
})

test('the name field and the Dish count are for clicking, not for dragging', async ({ page }) => {
  await openSettings(page)

  // Pressing the Dish count and moving up past the rows above moves nothing.
  const count = (await row(page, 'Gekocht').getByText('0 Gerichte').boundingBox())!
  const top = (await row(page, 'Ideen').boundingBox())!
  await page.mouse.move(count.x + 10, count.y + count.height / 2)
  await page.mouse.down()
  await page.mouse.move(count.x + 10, top.y + 4, { steps: 16 })
  await expect(row(page, 'Gekocht')).toHaveCSS('box-shadow', 'none')
  await page.mouse.up()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])

  // Nor does pressing the name field; a click on it puts the cursor in it.
  const field = (await nameField(page, 'Gekocht').boundingBox())!
  await page.mouse.move(field.x + 6, field.y + field.height / 2)
  await page.mouse.down()
  await page.mouse.move(field.x + 6, top.y + 4, { steps: 16 })
  await expect(row(page, 'Gekocht')).toHaveCSS('box-shadow', 'none')
  await page.mouse.up()
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])
  await nameField(page, 'Ideen').click()
  await expect(nameField(page, 'Ideen')).toBeFocused()
})

// A let-go Column is back in the list: not shifted, no lift shadow.
async function expectSettled(page: Page, name: string) {
  await expect(row(page, name)).toHaveCSS('translate', 'none')
  await expect(row(page, name)).toHaveCSS('box-shadow', 'none')
}

test('a dragged Column settles when let go outside the list, and its new place is saved', async ({ page }) => {
  await openSettings(page)
  const grip = (await row(page, 'Diese Woche').locator('[data-grip]').boundingBox())!
  const target = (await row(page, 'Ideen').boundingBox())!
  const list = (await page.getByRole('list', { name: 'Spalten' }).boundingBox())!
  const x = grip.x + grip.width / 2
  const saved = orderSaved(page)

  // Up past Ideen, then off to the side, away from the grip, and let go there.
  await page.mouse.move(x, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(x, target.y + 4, { steps: 16 })
  await page.mouse.move(list.x + list.width + 40, target.y + 4, { steps: 8 })
  await page.mouse.up()

  await expectSettled(page, 'Diese Woche')
  await expectColumnNames(page, ['Diese Woche', 'Ideen', 'Gekocht'])
  await saved
  await reloadHydrated(page)
  await expectColumnNames(page, ['Diese Woche', 'Ideen', 'Gekocht'])
})

test('a Column barely dragged settles where it was', async ({ page }) => {
  await openSettings(page)
  const grip = (await row(page, 'Ideen').locator('[data-grip]').boundingBox())!

  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2 + 3)
  await page.mouse.up()

  await expectSettled(page, 'Ideen')
  await expectColumnNames(page, ['Ideen', 'Diese Woche', 'Gekocht'])
})

// The Invite Link's buttons (PRD stories 62, 63). invite-links.spec.ts reads
// the link from its field; these click "Link kopieren" and "Link teilen".

// The Invite Link to Ida's Board, made from its slug and secret as the API
// has them rather than read from the page.
async function inviteLink(page: Page): Promise<string> {
  const { slug, inviteToken } = await (await page.request.get(`/api/boards/${await landingBoardId(page)}`)).json() as { slug: string, inviteToken: string }
  return `${E2E_ORIGIN}/invite/${slug}-${inviteToken}`
}

// navigator.share, set before the page loads (settings checks for it once
// mounted): taken away, or a stand-in for the share sheet that records what
// it was given and shares, or is closed without sharing.
async function stubShare(page: Page, sheet: 'none' | 'shares' | 'closed') {
  await page.addInitScript((sheet) => {
    const w = window as unknown as { shared: ShareData[] }
    w.shared = []
    if (sheet === 'none') {
      delete (Navigator.prototype as Partial<Navigator>).share
      return
    }
    Object.defineProperty(navigator, 'share', {
      configurable: true,
      value: async (data: ShareData) => {
        w.shared.push(data)
        if (sheet === 'closed') throw new DOMException('Share canceled', 'AbortError')
      },
    })
  }, sheet)
}

function shared(page: Page): Promise<ShareData[]> {
  return page.evaluate(() => (window as unknown as { shared: ShareData[] }).shared)
}

test('"Link kopieren" puts the Invite Link on the clipboard, and it opens the invite to this Board', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openSettings(page)
  const link = await inviteLink(page)

  await page.getByRole('button', { name: 'Link kopieren' }).click()

  await expect(page.getByRole('status')).toHaveText('Link kopiert')
  await expect(page.getByRole('button', { name: 'Link kopieren' })).toContainText('Kopiert ✓')
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  expect(copied).toBe(link)

  const invited = await newTab(browser)
  await gotoHydrated(invited, copied)
  await expect(invited.getByRole('heading', { level: 1 })).toHaveText('Du wurdest zu 🍲 Meine Küche eingeladen')
  // Every reset Board is a "Meine Küche"; its Owner tells Ida's apart.
  await expect(invited.getByText('ida lädt dich ein')).toBeVisible()
})

test('"Link teilen" hands the Invite Link and the Board’s name to the share sheet', async ({ page }) => {
  await stubShare(page, 'shares')
  await openSettings(page)
  const link = await inviteLink(page)

  await page.getByRole('button', { name: 'Link teilen' }).click()

  await expect.poll(() => shared(page)).toEqual([{ title: '🍲 Meine Küche', text: expect.stringContaining('🍲 Meine Küche'), url: link }])
})

test('closing the share sheet without sharing is no failure', async ({ page }) => {
  await stubShare(page, 'closed')
  await openSettings(page)

  await page.getByRole('button', { name: 'Link teilen' }).click()

  // The sheet was opened and closed by the time it says so: a failure Toast
  // would be up already.
  await expect.poll(async () => (await shared(page)).length).toBe(1)
  await expect(page.getByRole('status')).toBeEmpty()
})

test('without a share sheet there is no "Link teilen", and "Link kopieren" is the primary button', async ({ page }) => {
  await stubShare(page, 'none')
  await openSettings(page)

  const copy = page.getByRole('button', { name: 'Link kopieren' })
  await expect(copy).toBeVisible()
  await expect(page.getByRole('button', { name: 'Link teilen' })).toHaveCount(0)
  // Filled with the primary buttons' colour, the inverse token.
  const inverse = await page.evaluate(() => {
    const probe = document.body.appendChild(document.createElement('div'))
    probe.style.backgroundColor = 'var(--color-inverse)'
    const color = getComputedStyle(probe).backgroundColor
    probe.remove()
    return color
  })
  await expect(copy).toHaveCSS('background-color', inverse)
})
