import type { Locator, Page } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest, openBoardSettings } from './board'
import { gotoHydrated } from './hydration'
import { removeUsers, resetBoard, seedCookings, seedDish } from './seed'
import { openUserSettings } from './settings-sheet'

// Clickable things look clickable under a mouse (#206): every button, link
// and clickable tile shows the pointer cursor and reacts to the mouse resting
// on it (a tint, a lift, growing a little); a disabled control does neither.
// Each test walks every control of a part of the app and reports the ones
// that don't. Cecilia's Board is used by this file only; no test changes it.

const CECILIA = ALLOWLISTED[43]
const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const DESKTOP = { width: 1280, height: 900 }

// Buttons, links, and the tiles that are a label around their input.
const CLICKABLE = 'button, a[href], [role="button"], label:has(input[type="radio"]), label:has(input[type="checkbox"]), label:has(input[type="file"])'

// The mouse away from everything, and whatever was still moving at rest.
async function rest(page: Page) {
  await page.mouse.move(1, page.viewportSize()!.height - 1)
  await page.evaluate(() => Promise.race([
    Promise.all(document.getAnimations()
      .filter(a => a.timeline === document.timeline && a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity)
      .map(a => a.finished.catch(() => {}))),
    new Promise(resolve => setTimeout(resolve, 1500)),
  ]))
}

// How a control looks: what a hover reaction can change, of itself, what it
// holds, and what it sits in (a card lifts with its list item). Loops that
// never end (the add button breathing) are held still, so only the mouse
// changes anything.
function looks(control: Locator) {
  return control.evaluate((el) => {
    for (const animation of document.getAnimations()) {
      if (animation.effect?.getComputedTiming().iterations === Infinity) animation.pause()
    }
    const of = (element: Element, pseudo?: string) => {
      const s = getComputedStyle(element, pseudo)
      return [s.backgroundColor, s.color, s.boxShadow, s.scale, s.translate, s.rotate, s.transform, s.opacity, s.textDecorationLine, s.outlineStyle, s.outlineColor, s.borderTopColor, s.filter].join('|')
    }
    const parts = [el, ...[...el.querySelectorAll('*')].slice(0, 60)].map(part => of(part))
    if (el.parentElement) parts.push(of(el.parentElement))
    return [...parts, of(el, '::before'), of(el, '::after')].join('\n')
  })
}

// What is wrong with the controls in `root`, by their names: none, if all
// of them look clickable (or, disabled, don't).
async function affordanceProblems(page: Page, root: Locator): Promise<string[]> {
  const problems: string[] = []
  // Once a sheet or the Dish detail has finished opening.
  await rest(page)
  const controls = root.locator(CLICKABLE)
  const count = await controls.count()
  let walked = 0
  for (let i = 0; i < count; i++) {
    const control = controls.nth(i)
    const info = await control.evaluate((el) => {
      const style = getComputedStyle(el)
      const input = el.matches('label') ? el.querySelector('input') : null
      return {
        shown: el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) && !el.closest('[inert]') && style.pointerEvents !== 'none',
        disabled: el.matches(':disabled, [aria-disabled="true"]') || !!input?.disabled,
        // The chosen one of a set: pressing it again changes nothing.
        chosen: el.matches('[aria-checked="true"], [aria-pressed="true"]') || !!input?.checked,
        name: el.getAttribute('aria-label') || (el as HTMLElement).innerText.trim().replace(/\s+/g, ' ').slice(0, 40) || el.outerHTML.slice(0, 80),
        cursor: style.cursor,
      }
    })
    if (!info.shown || info.chosen) continue
    walked++
    await control.scrollIntoViewIfNeeded()
    await rest(page)
    const before = await looks(control)
    const box = (await control.boundingBox())!
    const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    await page.mouse.move(at.x, at.y)
    const reached = await control.evaluate((el, { x, y }) => el.contains(document.elementFromPoint(x, y)), at)
    if (!reached) {
      problems.push(`${info.name}: something covers it`)
      continue
    }
    await page.waitForTimeout(150)
    const reacts = await looks(control) !== before
    if (info.disabled) {
      if (info.cursor === 'pointer') problems.push(`${info.name}: disabled, but shows the pointer`)
      if (reacts) problems.push(`${info.name}: disabled, but reacts to the mouse`)
    }
    else {
      if (info.cursor !== 'pointer') problems.push(`${info.name}: no pointer cursor (${info.cursor})`)
      if (!reacts) problems.push(`${info.name}: no hover reaction`)
    }
  }
  await rest(page)
  // A part with nothing to walk would pass for the wrong reason.
  expect(walked, 'controls walked').toBeGreaterThan(0)
  return problems
}

test.beforeAll(async ({ browser }) => {
  await removeUsers(CECILIA)
  const page = await newTab(browser)
  await signIn(page, CECILIA, { name: 'Cecilia' })
  await resetBoard(page)
  await seedDish(page, { title: 'Curry', sourceLink: TIKTOK, sourceKind: 'tiktok', note: 'mit Reis', addedBy: CECILIA, column: 1 })
  await seedCookings(page, 'Curry', 1)
  await page.request.post('/api/boards', { data: { name: 'Kochclub', emoji: '🍜' } })
  await page.context().close()
})

async function openBoard(page: Page, viewport = DESKTOP) {
  await page.setViewportSize(viewport)
  await signIn(page, CECILIA)
  const boards = await (await page.request.get('/api/boards')).json() as { id: string, name: string }[]
  await gotoHydrated(page, `/b/${boards.find(b => b.name === 'Meine Küche')!.id}`)
  // Its card, where every Column shows; phones start on another Column.
  if (viewport.width >= 768) await cardAtRest(page.getByRole('link', { name: 'Curry', exact: true }))
}

test('the Board: its header, a card, the add button and the add lane', async ({ page }) => {
  await openBoard(page)
  expect(await affordanceProblems(page, page.locator('main.board'))).toEqual([])
})

test('the Board switcher’s and the user menu’s rows', async ({ page }) => {
  await openBoard(page)

  await page.getByRole('button', { name: /Board wechseln/ }).click()
  const boards = page.getByRole('navigation', { name: 'Deine Boards' })
  // Two Boards: each row and its Board Settings button.
  await expect(boards.getByRole('link')).toHaveCount(4)
  expect(await affordanceProblems(page, boards)).toEqual([])
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Dein Konto' }).click()
  expect(await affordanceProblems(page, page.getByRole('menu'))).toEqual([])
})

test('a card’s menu and its “Verschieben nach…”', async ({ page }) => {
  await openBoard(page)

  await page.getByRole('button', { name: 'Mehr zu „Curry“' }).click()
  const menu = page.getByRole('dialog', { name: 'Curry' })
  expect(await affordanceProblems(page, menu)).toEqual([])
  await menu.getByRole('button', { name: 'Verschieben nach…' }).click()
  await expect(menu.getByText('Dieses Board')).toBeVisible()
  expect(await affordanceProblems(page, menu)).toEqual([])
})

test('Add Dish, with its save button disabled, and the image dialog’s tiles', async ({ page }) => {
  await openBoard(page)

  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  expect(await affordanceProblems(page, sheet)).toEqual([])

  await sheet.getByRole('button', { name: 'Ohne Link hinzufügen' }).click()
  const form = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  // Nothing to save yet: the button is there, disabled.
  await expect(form.locator('button[type="submit"]')).toBeDisabled()
  expect(await affordanceProblems(page, form)).toEqual([])

  await form.getByRole('button', { name: 'Bild wählen' }).click()
  const images = page.getByRole('dialog', { name: 'Bild wählen' })
  await expect(images.getByRole('radio').first()).toBeVisible()
  expect(await affordanceProblems(page, images)).toEqual([])
})

test('the Dish detail, with its Cooking History', async ({ page }) => {
  await openBoard(page)

  await page.getByRole('link', { name: 'Curry', exact: true }).click()
  const detail = page.getByRole('dialog', { name: 'Curry' })
  await expect(detail.locator('[data-cooking]')).toHaveCount(1)
  expect(await affordanceProblems(page, detail)).toEqual([])
})

test('the search and what it finds', async ({ page }) => {
  await openBoard(page)

  await page.getByRole('button', { name: 'Gerichte suchen' }).click()
  await page.getByRole('searchbox', { name: 'Gerichte suchen' }).fill('Cur')
  const results = page.getByTestId('search-results')
  await expect(results.getByRole('link', { name: /Curry/ })).toBeVisible()
  expect(await affordanceProblems(page, results)).toEqual([])
  expect(await affordanceProblems(page, page.getByRole('search'))).toEqual([])
})

test('Board settings, with a disabled arrow, and its dialogs', async ({ page }) => {
  await openBoard(page)
  await openBoardSettings(page)
  await expect(page.getByRole('button', { name: '„Ideen“ nach oben' })).toBeDisabled()
  expect(await affordanceProblems(page, page.locator('main'))).toEqual([])

  // Where a Column's Dishes go when it is deleted: a row per Column.
  await page.getByRole('button', { name: 'Spalte „Diese Woche“ löschen' }).click()
  const moving = page.getByRole('dialog', { name: /Wohin verschieben/ })
  await expect(moving.getByRole('radio', { name: 'Ideen' })).toBeChecked()
  expect(await affordanceProblems(page, moving)).toEqual([])
  await moving.getByRole('button', { name: 'Abbrechen' }).click()

  await page.getByRole('button', { name: 'Emoji ändern' }).click()
  const emojis = page.getByRole('dialog', { name: 'Emoji wählen' })
  await expect(emojis.getByRole('radio').first()).toBeVisible()
  expect(await affordanceProblems(page, emojis)).toEqual([])
})

test('your settings and the new Board sheet', async ({ page }) => {
  await openBoard(page)

  await page.getByRole('button', { name: /Board wechseln/ }).click()
  await page.getByRole('navigation', { name: 'Deine Boards' }).getByRole('button', { name: 'Neues Board' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neues Board' })
  await expect(sheet.locator('button[type="submit"]')).toBeDisabled()
  expect(await affordanceProblems(page, sheet)).toEqual([])

  expect(await affordanceProblems(page, await openUserSettings(page))).toEqual([])
})

test('the sign-in screen', async ({ browser }) => {
  const page = await newTab(browser, { viewport: DESKTOP })
  await gotoHydrated(page, '/login')
  await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible()
  expect(await affordanceProblems(page, page.locator('body'))).toEqual([])
  await page.context().close()
})

test('with reduced motion nothing grows, and what would have shows a ring instead', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openBoard(page)

  expect(await affordanceProblems(page, page.locator('main.board'))).toEqual([])
  const search = page.getByRole('button', { name: 'Gerichte suchen' })
  await search.hover()
  await expect(search).toHaveCSS('scale', 'none')
  await expect(search).toHaveCSS('outline-style', 'solid')
})

test('a narrow window with a mouse: the Column tabs', async ({ page }) => {
  await openBoard(page, { width: 600, height: 900 })
  expect(await affordanceProblems(page, page.getByRole('navigation', { name: 'Spalten' }))).toEqual([])
})
