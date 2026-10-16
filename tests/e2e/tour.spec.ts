import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers } from './seed'
import { settingsSheet, openUserSettings } from './settings-sheet'

// The Tour (CONTEXT.md, #298): Topfbert's walk through the Board, once per
// person, the first time they open a Board, and again from Your Settings.
// In every other spec it never starts by itself; here the pages turn that
// on. Somerville is used by this file only, and starts each test new, as
// if she had never seen the Tour.
const SOMERVILLE = ALLOWLISTED[74]

test.beforeEach(async ({ page }) => {
  await removeUsers(SOMERVILLE)
  await page.addInitScript(() => {
    (window as { e2eTourAutoStart?: boolean }).e2eTourAutoStart = true
  })
  await signIn(page, SOMERVILLE)
})

// More than the Board waits before it starts the Tour by itself.
const SETTLE_MS = 2500

const hello = (page: Page) => page.getByRole('dialog', { name: 'Hallo, ich bin Topfbert!' })
const columnsStep = (page: Page) => page.getByRole('dialog', { name: 'Deine Spalten' })
const switcherStep = (page: Page) => page.getByRole('dialog', { name: 'Kocht zusammen' })
const layer = (page: Page) => page.locator('[data-tour-layer]')
const bubble = (page: Page) => page.locator('[data-tour-step]')
const ended = (page: Page) => page.getByText('Den Rundgang kannst du jederzeit in deinen Einstellungen wieder starten.')

async function tourSeen(page: Page): Promise<number | null> {
  return (await (await page.request.get('/api/me')).json() as { tourSeen: number | null }).tourSeen
}

async function notStarted(page: Page) {
  await page.waitForTimeout(SETTLE_MS)
  await expect(layer(page)).toBeHidden()
}

// Whether the box of `locator` lies wholly inside the window.
async function onScreen(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!
  const { width, height } = page.viewportSize()!
  return box.x >= 0 && box.y >= 0 && box.x + box.width <= width && box.y + box.height <= height
}

// Whether the spotlight's hole holds every element of `target` on screen,
// with 6px to spare (to the window's edge, where it is cut off there).
async function holeRound(page: Page, target: string) {
  const hole = (await page.locator('[data-tour-spot]').boundingBox())!
  const { width } = page.viewportSize()!
  const boxes = await page.locator(`[data-tour="${target}"]:visible`).evaluateAll(els => els.map((el) => {
    const { left, top, right, bottom } = el.getBoundingClientRect()
    return { left, top, right, bottom }
  }))
  return boxes.length > 0 && boxes.every(b =>
    hole.x <= Math.max(0, b.left) - 5.5 && hole.y <= b.top - 5.5
    && hole.x + hole.width >= Math.min(width, b.right) + 5.5 && hole.y + hole.height >= b.bottom + 5.5)
}

test('a first visit shows the Tour; going through it to the end records it and says where to find it again', async ({ page }) => {
  await gotoHydrated(page, '/')

  await expect(hello(page)).toBeVisible()
  await expect(hello(page)).toContainText('Ich zeig dir kurz')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()

  // The Board's own Columns, in their order.
  await expect(columnsStep(page)).toContainText('Gerichte wandern von „Ideen“ über „Diese Woche“ nach „Gekocht“.')
  // A tap beside the spotlight does nothing: the add button stays shut.
  await page.mouse.click(1240, 680)
  await expect(page.getByRole('dialog', { name: 'Gericht hinzufügen' })).toBeHidden()
  await columnsStep(page).getByRole('button', { name: 'Weiter' }).click()

  await expect(switcherStep(page)).toContainText('lädst du andere zu deinem Board ein')
  await switcherStep(page).getByRole('button', { name: 'Fertig' }).click()

  await expect(layer(page)).toBeHidden()
  await expect(ended(page)).toBeVisible()
  await expect.poll(() => tourSeen(page)).toBe(1)

  await reloadHydrated(page)
  await notStarted(page)
})

test('Überspringen mid-Tour ends it for good: a reload doesn\'t start it again', async ({ page }) => {
  await gotoHydrated(page, '/')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()

  await columnsStep(page).getByRole('button', { name: 'Überspringen' }).click()

  await expect(layer(page)).toBeHidden()
  await expect(ended(page)).toBeVisible()
  await expect.poll(() => tourSeen(page)).toBe(1)
  await reloadHydrated(page)
  await notStarted(page)
})

test('a reload halfway through records nothing: the Tour starts over', async ({ page }) => {
  await gotoHydrated(page, '/')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()
  await expect(columnsStep(page)).toBeVisible()

  await reloadHydrated(page)

  await expect(hello(page)).toBeVisible()
  expect(await tourSeen(page)).toBeNull()
})

test('opened to add something shared, the Board doesn\'t start the Tour; the next plain open does', async ({ page }) => {
  await gotoHydrated(page, `/share?${new URLSearchParams({ text: 'Schau mal' })}`)
  const addDish = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await expect(addDish).toBeVisible()
  await addDish.getByRole('button', { name: 'Schließen' }).click()
  await expect(addDish).toBeHidden()

  await notStarted(page)

  await gotoHydrated(page, '/')
  await expect(hello(page)).toBeVisible()
})

test('"Rundgang starten" in Your Settings closes them and starts the whole Tour again', async ({ page }) => {
  await page.request.put('/api/me/tour', { data: { version: 1 }, headers: { origin: E2E_ORIGIN } })
  const sheet = await openUserSettings(page)

  await sheet.getByRole('button', { name: 'Rundgang starten' }).click()

  await expect(settingsSheet(page)).toBeHidden()
  await expect(hello(page)).toBeVisible()
  await hello(page).getByRole('button', { name: 'Überspringen' }).click()
  await expect(ended(page)).toBeVisible()
})

test('→ and ← go forwards and back, focus is in each bubble, and Esc ends the Tour', async ({ page }) => {
  await gotoHydrated(page, '/')
  await expect(hello(page)).toBeVisible()
  await expect(bubble(page)).toBeFocused()

  await page.keyboard.press('ArrowRight')
  await expect(columnsStep(page)).toBeVisible()
  await expect(bubble(page)).toBeFocused()
  await page.keyboard.press('ArrowRight')
  await expect(switcherStep(page)).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(columnsStep(page)).toBeVisible()
  await expect(bubble(page)).toBeFocused()

  await page.keyboard.press('Escape')

  await expect(layer(page)).toBeHidden()
  await expect(ended(page)).toBeVisible()
  await expect.poll(() => tourSeen(page)).toBe(1)
})

test.describe('on a 360px phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })

  test('every bubble, and Topfbert on it, is fully on screen, and the spotlight sits on its target', async ({ page }) => {
    await gotoHydrated(page, '/')
    const topfbert = page.locator('[data-tour-layer] [data-topfbert-idle]')

    for (const [step, target] of [[hello(page), null], [columnsStep(page), 'columns'], [switcherStep(page), 'board-switcher']] as const) {
      await expect(step).toBeVisible()
      await expect.poll(() => onScreen(page, bubble(page))).toBe(true)
      await expect.poll(() => onScreen(page, topfbert)).toBe(true)
      // The hole, once it has glided there: round every element of the
      // target, and 6px more.
      if (target) await expect.poll(() => holeRound(page, target)).toBe(true)
      await step.getByRole('button', { name: /^(Weiter|Fertig)$/ }).click()
    }
    await expect(layer(page)).toBeHidden()
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('nothing in the Tour moves: no fading, gliding or rising, and Topfbert stands still', async ({ page }) => {
    await gotoHydrated(page, '/')
    await expect(hello(page)).toBeVisible()
    await hello(page).getByRole('button', { name: 'Weiter' }).click()
    await expect(columnsStep(page)).toBeVisible()

    expect(await layer(page).evaluate(el => el.getAnimations({ subtree: true }).length)).toBe(0)
    await expect(page.locator('[data-tour-spot]')).toHaveCSS('transition-duration', '0s')
  })
})

test.describe('in dark mode', () => {
  test.use({ colorScheme: 'dark' })

  test('the bubble is in the dark theme', async ({ page }) => {
    await gotoHydrated(page, '/')

    await expect(bubble(page)).toHaveCSS('background-color', 'rgb(42, 40, 37)')
  })
})

test.describe('in light mode', () => {
  test.use({ colorScheme: 'light' })

  test('the bubble is white', async ({ page }) => {
    await gotoHydrated(page, '/')

    await expect(bubble(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  })
})
