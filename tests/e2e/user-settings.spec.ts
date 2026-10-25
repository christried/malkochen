import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { openUserSettings, settingsSheet } from './settings-sheet'

// User settings (PRD stories 73–75): your Username and Google photo, Darstellung
// and signing out, in a sheet over the Board (#210). Jean is used by this
// file only.
const JEAN = ALLOWLISTED[18]
// Stands in for Google's photo URL; served by the app, so it loads offline.
const PHOTO = `${E2E_ORIGIN}/icons/icon-192.png`

// Handoff tokens.css: light --color-bg #F7F6F2, dark #131211.
const LIGHT_BG = 'rgb(247, 246, 242)'
const DARK_BG = 'rgb(19, 18, 17)'

test.use({ colorScheme: 'light' })

test.beforeEach(async ({ page }) => {
  await signIn(page, JEAN, { name: 'Jean Bartik', image: PHOTO })
})

test('your Profile Picture on the Board opens a menu with who is signed in, signing out and the legal pages, and no way into your settings', async ({ page }) => {
  await gotoHydrated(page, '/')

  const avatar = page.getByRole('button', { name: 'Dein Konto' })
  await expect(avatar.locator(`img[src="${PHOTO}"]`)).toBeVisible()
  await avatar.click()

  const menu = page.getByRole('menu', { name: `Jean ${JEAN}` })
  await expect(menu).toBeVisible()
  await expect(avatar).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator(`img[src="${PHOTO}"]`).filter({ visible: true })).toHaveCount(2)
  // Your settings are the cogwheel's (#282). Its last rows: the legal pages,
  // in malkochen.
  await expect(menu.getByRole('menuitem')).toHaveText(['Abmelden', 'Impressum', 'Datenschutz'])
  await expect(menu.getByRole('menuitem', { name: 'Impressum' })).toHaveAttribute('href', '/impressum')
  await expect(menu.getByRole('menuitem', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz')
})

test('the cogwheel in the Board\'s header opens your settings over the Board, and closing them puts focus back on it', async ({ page }) => {
  await gotoHydrated(page, '/')
  const board = page.url()
  const cogwheel = page.locator('header').getByRole('button', { name: 'Einstellungen', exact: true })
  await cogwheel.click()

  // A sheet over the Board, which stays at its address.
  const sheet = settingsSheet(page)
  await expect(sheet).toBeVisible()
  await expect(page).toHaveURL(board)
  await expect(page.locator('h1')).toHaveText('🍲 Meine Küche')
  const account = sheet.getByRole('region', { name: 'Konto' })
  await expect(account.getByText('Jean', { exact: true })).toBeVisible()
  await expect(account.getByText(JEAN)).toBeVisible()
  await expect(account.locator(`img[src="${PHOTO}"]`)).toBeVisible()
  // Sprache: Automatisch (the browser's language) until another is picked
  // (languages.spec.ts).
  const language = sheet.getByRole('region', { name: 'Sprache' }).getByRole('radiogroup', { name: 'Sprache' })
  await expect(language.getByRole('radio', { name: 'Automatisch' })).toHaveAttribute('aria-checked', 'true')

  // Closed, focus is back on the cogwheel.
  await sheet.getByRole('button', { name: 'Einstellungen schließen' }).click()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(board)
  await expect(cogwheel).toBeFocused()
})

// Where the Board is scrolled: the page down, its Columns sideways.
function scrolledTo(page: Page) {
  return page.evaluate(() => ({ top: window.scrollY, left: document.querySelector('[data-testid="columns"]')!.scrollLeft }))
}

test('closing your settings (Escape, a click on the dimmed Board, or its close button) leaves the Board as it was: nothing reloads, it stays where it was scrolled, and focus is back on the cogwheel', async ({ page }) => {
  // Too small for the Board, so it scrolls both ways.
  await page.setViewportSize({ width: 800, height: 400 })
  await gotoHydrated(page, '/')
  const board = page.url()
  // Gone if the page loads again.
  await page.evaluate(() => Object.assign(window, { stayed: true }))
  await page.getByTestId('columns').evaluate(el => el.scrollTo({ left: el.scrollWidth, behavior: 'instant' }))
  await page.evaluate(() => window.scrollTo({ top: 16, behavior: 'instant' }))
  await expect.poll(async () => (await scrolledTo(page)).left).toBeGreaterThan(0)
  const before = await scrolledTo(page)
  expect(before.top).toBe(16)
  const sheet = settingsSheet(page)
  const cogwheel = page.locator('header').getByRole('button', { name: 'Einstellungen', exact: true })
  const closes = [
    () => page.keyboard.press('Escape'),
    // The dimmed Board, left of the sheet.
    () => page.mouse.click(100, 200),
    () => sheet.getByRole('button', { name: 'Einstellungen schließen' }).click(),
  ]

  for (const close of closes) {
    // Opened by keyboard: a click retried while the sheet moves out scrolls
    // its target into view with block 'end', 'center' or 'start', and that
    // alone takes the window back to the top (#260). The close button sits
    // in the sheet, so its click can't scroll the Board.
    await cogwheel.evaluate(el => el.focus({ preventScroll: true }))
    await page.keyboard.press('Enter')
    await expect(sheet).toBeVisible()
    // From 768px a side sheet: on the right edge, 420px wide, full height (#283).
    await expect.poll(async () => sheet.boundingBox()).toEqual({ x: 380, y: 0, width: 420, height: 400 })

    await close()

    await expect(sheet).toBeHidden()
    await expect(page).toHaveURL(board)
    await expect(cogwheel).toBeFocused()
    expect(await page.evaluate(() => (window as unknown as { stayed?: boolean }).stayed)).toBe(true)
    expect(await scrolledTo(page)).toEqual(before)
  }
})

test('from 768px only your settings sit on the right edge, scrolling inside; other sheets stay centred dialogs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 })
  const sheet = await openUserSettings(page)
  await expect.poll(async () => sheet.boundingBox()).toEqual({ x: 860, y: 0, width: 420, height: 500 })
  // Taller than the window, they scroll inside the sheet, with the app's
  // thin scrollbar (board-scroll.spec.ts).
  expect(await sheet.evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true)
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()

  // Add Dish: still in the middle of the window, clear of its edges.
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const addDish = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await expect(addDish).toBeVisible()
  await expect.poll(async () => {
    const { x, width } = (await addDish.boundingBox())!
    return Math.round(x + width / 2)
  }).toBe(640)
  const box = (await addDish.boundingBox())!
  expect(box.y).toBeGreaterThan(0)
  expect(box.y + box.height).toBeLessThan(500)
})

test('the user menu works by keyboard: open, move, Escape, and "Abmelden" signs you out', async ({ page }) => {
  await gotoHydrated(page, '/')
  const avatar = page.getByRole('button', { name: 'Dein Konto' })
  const menu = page.getByRole('menu')
  const signOut = menu.getByRole('menuitem', { name: 'Abmelden' })
  const impressum = menu.getByRole('menuitem', { name: 'Impressum' })
  const privacy = menu.getByRole('menuitem', { name: 'Datenschutz' })

  // Opening moves focus onto the first row; the arrows go round.
  await avatar.focus()
  await page.keyboard.press('Enter')
  await expect(signOut).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(impressum).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(privacy).toBeFocused()
  await page.keyboard.press('ArrowDown')
  await expect(signOut).toBeFocused()
  await page.keyboard.press('ArrowUp')
  await expect(privacy).toBeFocused()
  await page.keyboard.press('Home')
  await expect(signOut).toBeFocused()
  await page.keyboard.press('End')
  await expect(privacy).toBeFocused()

  // Escape closes it and hands focus back to your picture.
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(avatar).toBeFocused()
  await expect(avatar).toHaveAttribute('aria-expanded', 'false')

  // ArrowUp opens it on the last row.
  await page.keyboard.press('ArrowUp')
  await expect(privacy).toBeFocused()
  await page.keyboard.press('Home')
  await expect(signOut).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/login')
  expect((await page.request.get('/api/me')).status()).toBe(401)
})

test('Tab closes the user menu, and Space chooses a legal page like Enter', async ({ page, context }) => {
  await gotoHydrated(page, '/')
  const avatar = page.getByRole('button', { name: 'Dein Konto' })
  const menu = page.getByRole('menu')

  await avatar.focus()
  await page.keyboard.press('Enter')
  await expect(menu).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(menu).toHaveCount(0)

  await avatar.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await expect(menu.getByRole('menuitem', { name: 'Impressum' })).toBeFocused()
  const opened = context.waitForEvent('page')
  await page.keyboard.press(' ')

  await (await opened).waitForURL(`${E2E_ORIGIN}/impressum`)
  await expect(menu).toHaveCount(0)
})

test('the user menu closes on a press anywhere else', async ({ page }) => {
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'Dein Konto' }).click()
  await expect(page.getByRole('menu')).toBeVisible()

  // The Board's left edge, far from the menu under the top right corner.
  await page.locator('main').click({ position: { x: 5, y: 400 } })

  await expect(page.getByRole('menu')).toHaveCount(0)
})

test('a legal page chosen from the user menu opens in a new tab; the menu closes and focus is back on your picture', async ({ page, context }) => {
  await gotoHydrated(page, '/')
  const avatar = page.getByRole('button', { name: 'Dein Konto' })
  const menu = page.getByRole('menu')
  await avatar.click()

  // A press beside the two links chooses nothing: the menu stays open.
  const row = (await menu.getByRole('menuitem', { name: 'Datenschutz' }).locator('xpath=..').boundingBox())!
  await page.mouse.click(row.x + row.width - 8, row.y + row.height / 2)
  await expect(avatar).toHaveAttribute('aria-expanded', 'true')

  await menu.getByRole('menuitem', { name: 'Impressum' }).focus()
  const opened = context.waitForEvent('page')
  await page.keyboard.press('Enter')
  await (await opened).waitForURL(`${E2E_ORIGIN}/impressum`)
  await expect(menu).toHaveCount(0)
  await expect(avatar).toBeFocused()
})

test('on a phone the legal pages are the last rows of the Board switcher, and the cogwheel opens your settings as a bottom sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await gotoHydrated(page, '/')
  const board = page.url()
  // No room in the header beside the Board's name for your user menu.
  await expect(page.getByRole('button', { name: 'Dein Konto' })).toBeHidden()

  const switcher = page.getByRole('button', { name: /Board wechseln/ })
  await switcher.click()
  const panel = page.getByRole('navigation', { name: 'Deine Boards' })
  // Your settings are the cogwheel's, so the switcher is only about Boards
  // (#282): no settings row before the legal pages.
  await expect(panel.locator('a, button').filter({ hasText: /Einstellungen|Impressum|Datenschutz/ })).toHaveText(['Impressum', 'Datenschutz'])
  const legalRow = panel.getByRole('listitem').last()
  await expect(legalRow.getByRole('link')).toHaveText(['Impressum', 'Datenschutz'])
  await expect(legalRow.getByRole('link', { name: 'Impressum' })).toHaveAttribute('href', '/impressum')
  await expect(legalRow.getByRole('link', { name: 'Datenschutz' })).toHaveAttribute('href', '/datenschutz')
  // A press beside the two links chooses nothing: the switcher stays open.
  const row = (await legalRow.boundingBox())!
  await page.mouse.click(row.x + row.width - 8, row.y + row.height / 2)
  await expect(switcher).toHaveAttribute('aria-expanded', 'true')
  await switcher.click()
  await expect(panel).toHaveCount(0)
  const cogwheel = page.locator('header').getByRole('button', { name: 'Einstellungen', exact: true })
  await cogwheel.click()

  // A bottom sheet: as wide as the screen, on its bottom edge.
  const sheet = settingsSheet(page)
  const atRest = async () => {
    const { x, y, width, height } = (await sheet.boundingBox())!
    return { x, width, bottom: y + height }
  }
  await expect(sheet).toBeVisible()
  await expect(page).toHaveURL(board)
  await expect.poll(atRest).toEqual({ x: 0, width: 390, bottom: 844 })

  // A tap beside it closes it.
  await page.mouse.click(195, 20)
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(board)
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()

  // So does dragging it down by its handle.
  await cogwheel.click()
  await expect(sheet).toBeVisible()
  await expect.poll(atRest).toEqual({ x: 0, width: 390, bottom: 844 })
  const top = (await sheet.boundingBox())!.y
  await page.mouse.move(195, top + 12)
  await page.mouse.down()
  await page.mouse.move(195, top + 400, { steps: 8 })
  await page.mouse.up()
  await expect(sheet).toBeHidden()
  await expect(page).toHaveURL(board)
})

test('Darstellung switches between light and dark, and the choice survives a reload', async ({ page }) => {
  await openUserSettings(page)
  const main = page.locator('main')
  await expect(main).toHaveCSS('background-color', LIGHT_BG)

  await page.getByRole('radio', { name: 'Dunkel' }).click()
  await expect(page.getByRole('radio', { name: 'Dunkel' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(main).toHaveCSS('background-color', DARK_BG)

  await reloadHydrated(page)
  await expect(main).toHaveCSS('background-color', DARK_BG)
  await gotoHydrated(page, '/')
  await expect(page.locator('main')).toHaveCSS('background-color', DARK_BG)

  await openUserSettings(page)
  await page.getByRole('radio', { name: 'Hell' }).click()
  await expect(page.locator('main')).toHaveCSS('background-color', LIGHT_BG)
})

// The Theme reveal (handoff motion.json "Theme reveal"), as the page runs it:
// what animates the View Transition's picture of the new theme, and the
// cross-fade without one.
const NEW_THEME = '::view-transition-new(root)'

interface Reveal { duration: number, from: string, to: string }

// The reveal running now, if any: the clip-path animation on the new theme.
function reveal(page: Page): Promise<Reveal | null> {
  return page.evaluate((pseudo) => {
    const found = document.getAnimations().find(a => (a.effect as KeyframeEffect | null)?.pseudoElement === pseudo
      && (a.effect as KeyframeEffect).getKeyframes().some(k => k.clipPath))
    if (!found) return null
    const effect = found.effect as KeyframeEffect
    const [first, last] = [effect.getKeyframes().at(0)!, effect.getKeyframes().at(-1)!]
    return { duration: Number(effect.getTiming().duration), from: String(first.clipPath), to: String(last.clipPath) }
  }, NEW_THEME)
}

// A motion token's duration in ms, as the page has it now.
function durationMs(page: Page, token: string): Promise<number> {
  return page.evaluate(name => Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)), `--dur-${token}`)
}

// Counts the View Transitions the page starts, and every value <html
// data-theme-reveal> takes from now on, with how long <main>'s background
// then takes to change (the cross-fade, if any).
async function watchTransitions(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { transitions: number, reveals: string[], fades: string[] }
    w.transitions = 0
    w.reveals = []
    w.fades = []
    const start = document.startViewTransition?.bind(document)
    if (start) {
      document.startViewTransition = ((update?: ViewTransitionUpdateCallback) => {
        w.transitions++
        return start(update)
      }) as typeof document.startViewTransition
    }
    new MutationObserver(() => {
      const value = document.documentElement.dataset.themeReveal
      if (!value) return
      w.reveals.push(value)
      const main = getComputedStyle(document.querySelector('main')!)
      const i = main.transitionProperty.split(', ').indexOf('background-color')
      w.fades.push(i < 0 ? 'none' : main.transitionDuration.split(', ')[i]!)
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme-reveal'] })
  })
  return {
    transitions: () => page.evaluate(() => (window as unknown as { transitions: number }).transitions),
    reveals: () => page.evaluate(() => (window as unknown as { reveals: string[] }).reveals),
    fades: () => page.evaluate(() => (window as unknown as { fades: string[] }).fades),
  }
}

test('picking Dunkel reveals it from the tapped option at the swoosh token’s pace, and Hell the same way back', async ({ page }) => {
  await openUserSettings(page)

  for (const [name, background] of [['Dunkel', DARK_BG], ['Hell', LIGHT_BG]] as const) {
    const option = page.getByRole('radio', { name })
    // Measured where the click finds it: the settings run taller than the sheet.
    await option.scrollIntoViewIfNeeded()
    const box = (await option.boundingBox())!
    await option.click()

    await expect.poll(() => reveal(page)).not.toBeNull()
    const { duration, from, to } = (await reveal(page))!
    // Its value is tests/client/theme-reveal-tokens.test.ts's.
    expect(duration).toBe(await durationMs(page, 'swoosh'))
    // A circle growing from the middle of the tapped option over the whole page.
    const [, radius, x, y] = from.match(/circle\(([\d.]+)px at ([\d.]+)px ([\d.]+)px\)/)!.map(Number)
    expect(radius).toBe(0)
    expect(x).toBeCloseTo(box.x + box.width / 2, 0)
    expect(y).toBeCloseTo(box.y + box.height / 2, 0)
    expect(to).toMatch(/^circle\([\d.]+px at /)
    await expect(page.locator('main')).toHaveCSS('background-color', background)
    await expect.poll(() => reveal(page)).toBeNull()
  }
})

test('"System" follows the device colour scheme, revealing it only when it differs from the theme shown', async ({ page }) => {
  await openUserSettings(page)
  const watched = await watchTransitions(page)

  // Light now, and the device is light too: nothing to reveal.
  await page.getByRole('radio', { name: 'System' }).click()

  await expect(page.getByRole('radio', { name: 'System' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  expect(await watched.transitions()).toBe(0)
  expect(await watched.reveals()).toEqual([])

  // The device turns dark: the page follows.
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('main')).toHaveCSS('background-color', DARK_BG)

  // Hell, then back to the device's dark: revealed.
  await page.getByRole('radio', { name: 'Hell' }).click()
  await expect(page.locator('main')).toHaveCSS('background-color', LIGHT_BG)
  await expect.poll(() => reveal(page)).toBeNull()

  await page.getByRole('radio', { name: 'System' }).click()

  await expect.poll(() => reveal(page)).not.toBeNull()
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
  await expect(page.locator('main')).toHaveCSS('background-color', DARK_BG)
})

test('without View Transitions, the theme cross-fades', async ({ page }) => {
  await page.addInitScript(() => {
    delete (Document.prototype as { startViewTransition?: unknown }).startViewTransition
  })
  await openUserSettings(page)
  const watched = await watchTransitions(page)

  await page.getByRole('radio', { name: 'Dunkel' }).click()

  await expect(page.locator('main')).toHaveCSS('background-color', DARK_BG)
  expect(await watched.reveals()).toEqual(['fade'])
  expect(await watched.fades()).toEqual(['0.24s'])
  // Over once it has faded.
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-reveal')
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('your settings appear and disappear on the right edge without sliding', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 500 })
    await gotoHydrated(page, '/')
    // In the page while closed too, so it can be watched from the first frame.
    const dialog = page.locator('dialog:has(h2:text-is("Einstellungen"))')

    // What moves the sheet itself (rather than fading it), two frames after
    // the cogwheel or the close button is pressed.
    const moving = (act: 'open' | 'close') => dialog.evaluate(async (el, act) => {
      const button = act === 'open'
        ? document.querySelector('header button[aria-label="Einstellungen"]')
        : el.querySelector('button[aria-label="Einstellungen schließen"]')
      ;(button as HTMLElement).click()
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
      return el.getAnimations().flatMap(a => (a.effect as KeyframeEffect).getKeyframes()
        .flatMap(k => Object.keys(k).filter(p => ['transform', 'translate', 'scale'].includes(p))))
    }, act)

    expect(await moving('open')).toEqual([])
    const sheet = settingsSheet(page)
    await expect(sheet).toBeVisible()
    await expect.poll(async () => sheet.boundingBox()).toEqual({ x: 860, y: 0, width: 420, height: 500 })
    expect(await moving('close')).toEqual([])
    await expect(sheet).toBeHidden()
  })

  test('the theme switches at once with a short cross-fade, and nothing spreads out', async ({ page }) => {
    await openUserSettings(page)
    const watched = await watchTransitions(page)

    await page.getByRole('radio', { name: 'Dunkel' }).click()

    await expect(page.locator('main')).toHaveCSS('background-color', DARK_BG)
    expect(await watched.reveals()).toEqual(['fade'])
    // Its value is tests/client/theme-reveal-tokens.test.ts's.
    expect(await watched.fades()).toEqual([`${await durationMs(page, 'fade') / 1000}s`])
    expect(await reveal(page)).toBeNull()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme-reveal')
  })
})

test('"Abmelden" ends the session and returns to the sign-in screen', async ({ page }) => {
  await openUserSettings(page)

  await page.getByRole('button', { name: 'Abmelden' }).click()

  await expect(page).toHaveURL('/login')
  expect((await page.request.get('/api/me')).status()).toBe(401)
  // Signed out, /settings asks you to sign in, like any other page.
  await gotoHydrated(page, '/settings')
  await expect(page).toHaveURL('/login')
})

test('/settings forwards to the Board opened last, with your settings open over it', async ({ page }) => {
  const created = await page.request.post('/api/boards', { data: { name: 'Zweitküche', emoji: '🥘' } })
  const { id } = await created.json() as { id: string }
  await gotoHydrated(page, `/b/${id}`)

  const sheet = await openUserSettings(page)

  // The Board's own address, which a reload opens without the sheet.
  await expect(page).toHaveURL(/\/b\/zweitkueche$/)
  await expect(page.locator('h1')).toHaveText('🥘 Zweitküche')
  await expect(sheet.getByRole('region', { name: 'Konto' }).getByText(JEAN)).toBeVisible()
  await reloadHydrated(page)
  await expect(page.getByRole('region', { name: 'Ideen' })).toBeVisible()
  await expect(sheet).toBeHidden()
})
