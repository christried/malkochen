import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED, E2E_ORIGIN } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated, reloadHydrated } from './hydration'
import { removeUsers } from './seed'
import { settingsSheet, openUserSettings } from './settings-sheet'

// The Tour (CONTEXT.md, #298, #299): Topfbert's walk through the Board, once
// per person, the first time they open a Board, and again from Your
// Settings. The user adds a real Dish in it.
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
const addStep = (page: Page) => page.getByRole('dialog', { name: 'Dein erstes Gericht' })
const linkStep = (page: Page) => page.getByRole('dialog', { name: 'Hast du einen Link?' })
const newCardStep = (page: Page) => page.getByRole('dialog', { name: 'Da ist es!' })
const columnsStep = (page: Page) => page.getByRole('dialog', { name: 'Deine Spalten' })
const addDish = (page: Page) => page.getByRole('dialog', { name: 'Gericht hinzufügen' })
const switcherStep = (page: Page) => page.getByRole('dialog', { name: 'Kocht zusammen' })
const installStep = (page: Page) => page.getByRole('dialog', { name: 'Hol dir malkochen aufs Handy' })
const shareTipStep = (page: Page) => page.getByRole('dialog', { name: 'Noch ein Trick' })
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

// Whether the spotlight's hole holds every element of `target` on screen
// (the card of the Dish `dishId`; the one of the Column `columnId`), with
// 6px to spare (to the window's edge, where it is cut off there).
async function holeRound(page: Page, target: string, dishId?: string, columnId?: string) {
  const hole = (await page.locator('[data-tour-spot]:visible').boundingBox())!
  const { width } = page.viewportSize()!
  const within = dishId ? `[data-dish-id="${dishId}"] ` : ''
  const ofColumn = columnId ? `[data-tour-column-id="${columnId}"]` : ''
  const boxes = await page.locator(`${within}[data-tour="${target}"]${ofColumn}:visible`).evaluateAll(els => els.map((el) => {
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
  await addStep(page).getByRole('button', { name: 'Ohne Gericht weiter' }).click()

  // The Board's own Columns, in their order.
  await expect(columnsStep(page)).toContainText('Gerichte wandern von „Ideen“ über „Diese Woche“ nach „Gekocht“.')
  // A tap beside the spotlight does nothing: the add button stays shut.
  await page.mouse.click(1240, 680)
  await expect(addDish(page)).toBeHidden()
  await columnsStep(page).getByRole('button', { name: 'Weiter' }).click()

  await expect(switcherStep(page)).toContainText('lädst du andere zu deinem Board ein')
  // Side by side, the Board Switcher is the last step: no share tip, nothing
  // to install.
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

  await addStep(page).getByRole('button', { name: 'Überspringen' }).click()

  await expect(layer(page)).toBeHidden()
  await expect(ended(page)).toBeVisible()
  await expect.poll(() => tourSeen(page)).toBe(1)
  await reloadHydrated(page)
  await notStarted(page)
})

test('a reload halfway through records nothing: the Tour starts over', async ({ page }) => {
  await gotoHydrated(page, '/')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()
  await expect(addStep(page)).toBeVisible()

  await reloadHydrated(page)

  await expect(hello(page)).toBeVisible()
  expect(await tourSeen(page)).toBeNull()
})

test('opened to add something shared, the Board doesn\'t start the Tour; the next plain open does', async ({ page }) => {
  await gotoHydrated(page, `/share?${new URLSearchParams({ text: 'Schau mal' })}`)
  await expect(addDish(page)).toBeVisible()
  await addDish(page).getByRole('button', { name: 'Schließen' }).click()
  await expect(addDish(page)).toBeHidden()

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
  await expect(addStep(page)).toBeVisible()
  await expect(bubble(page)).toBeFocused()
  // A step to do has no Weiter: → doesn't go past it.
  await page.keyboard.press('ArrowRight')
  await expect(addStep(page)).toBeVisible()
  await addStep(page).getByRole('button', { name: 'Ohne Gericht weiter' }).click()
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

test('the butter ring is all that\'s drawn round the hole: no box round it', async ({ page }) => {
  await gotoHydrated(page, '/')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()

  const ring = page.locator('[data-tour-ring="drawn"]:visible')
  await expect(ring).toBeAttached()
  // Not even Tailwind's `ring` utility, a box-shadow round its square box.
  await expect(ring).toHaveCSS('box-shadow', 'none')
})

// Taps the middle of what `locator` finds, as a finger would: whatever is
// on top there gets it.
async function tapOn(page: Page, locator: Locator) {
  const box = (await locator.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
}

// Whether the bubble showing is on top at its own middle.
const bubbleOnTop = (page: Page) => page.locator('[data-tour-step]:visible').evaluate((el) => {
  const { left, top, width, height } = el.getBoundingClientRect()
  return el.contains(document.elementFromPoint(left + width / 2, top + height / 2))
})

// One frame of the Tour, as traceTour records it: the step, the hole where
// it is on that frame (its corners' radius too), whether the ring is drawn,
// and whether Topfbert stands left of the bubble.
interface TourFrame {
  step: string | null
  spot: { left: number, top: number, width: number, height: number, radius: number } | null
  ring: string | null
  topfbertLeft: boolean | null
}

// Records a TourFrame every frame until the returned stop() is awaited,
// which gives them back.
async function traceTour(page: Page) {
  await page.evaluate(() => {
    const frames: unknown[] = []
    const w = window as { tourTrace?: unknown[] | null }
    w.tourTrace = frames
    const shown = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)].find(el => el.checkVisibility())
    const tick = () => {
      if (w.tourTrace !== frames) return
      const spot = shown('[data-tour-spot]')
      const bubble = shown('[data-tour-step]')
      const topfbert = shown('[data-tour-layer] [data-topfbert-idle]')
      const box = spot?.getBoundingClientRect()
      frames.push({
        step: bubble?.dataset.tourStep ?? null,
        spot: spot && box ? { left: box.left, top: box.top, width: box.width, height: box.height, radius: Number.parseFloat(getComputedStyle(spot).borderTopLeftRadius) } : null,
        ring: spot?.querySelector('[data-tour-ring]')?.getAttribute('data-tour-ring') ?? null,
        topfbertLeft: bubble && topfbert ? topfbert.getBoundingClientRect().left < bubble.getBoundingClientRect().left : null,
      })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  return () => page.evaluate(() => {
    const w = window as { tourTrace?: unknown[] | null }
    const frames = w.tourTrace
    w.tourTrace = null
    return frames
  }) as Promise<TourFrame[]>
}

// How often Topfbert changed sides in the frames of `step`, from its second
// on (its first still shows the last step's placement, not measured again
// yet).
function sideFlips(frames: TourFrame[], step: string) {
  const sides = frames.filter(f => f.step === step && f.topfbertLeft !== null).slice(1).map(f => f.topfbertLeft)
  return sides.filter((s, i) => i > 0 && s !== sides[i - 1]).length
}

// Whether, in the frames of `step`, the ring started hidden, then drew, and
// the hole didn't move from the frame it drew on.
function ringDrewOnceSettled(frames: TourFrame[], step: string) {
  const ofStep = frames.filter(f => f.step === step && f.spot)
  const drawn = ofStep.findIndex(f => f.ring === 'drawn')
  if (drawn <= 0 || ofStep[0]!.ring !== 'hidden') return false
  const at = ofStep[drawn]!.spot!
  return ofStep.slice(drawn).every(({ spot }) => ['left', 'top', 'width', 'height'].every(k => Math.abs(spot![k as 'left'] - at[k as 'left']) < 0.5))
}

// The spotlit add button, tapped once the hole sits on it (a frame after
// its step shows, the hole passes taps on).
async function tapAddButton(page: Page) {
  await expect.poll(() => holeRound(page, 'add-button')).toBe(true)
  await tapOn(page, page.locator('[data-tour="add-button"]'))
}

test('the Tour has the user add a Dish: the add button, Add Dish, then the new card spotlit', async ({ page }) => {
  await gotoHydrated(page, '/')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()
  await expect(addStep(page)).toContainText('Tipp aufs Plus.')

  // The spotlit add button takes the tap.
  const stop = await traceTour(page)
  await tapAddButton(page)

  // The bubble follows into Add Dish, above it, onto its link field.
  await expect(addDish(page)).toBeVisible()
  await expect(linkStep(page)).toContainText('TikTok, Instagram')
  await expect(bubble(page)).toBeFocused()
  await expect.poll(() => bubbleOnTop(page)).toBe(true)
  await expect.poll(() => holeRound(page, 'add-dish-link')).toBe(true)
  // The link field is centred in the window: Topfbert keeps his side
  // while the sheet opens, and once the hole has settled the ring draws in.
  await expect(page.locator('[data-tour-ring="drawn"]:visible')).toBeAttached()
  await page.waitForTimeout(300)
  const frames = await stop()
  expect(sideFlips(frames, 'addDishLink')).toBe(0)
  expect(ringDrewOnceSettled(frames, 'addDishLink')).toBe(true)
  // A tap beside the link field does nothing: Add Dish stays open.
  await tapOn(page, addDish(page).getByRole('button', { name: 'Schließen' }))
  await expect(addDish(page)).toBeVisible()

  // Through the hole, "Ohne Link hinzufügen" works; the bubble steps aside.
  await tapOn(page, addDish(page).getByRole('button', { name: 'Ohne Link hinzufügen' }))
  const form = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  await expect(linkStep(page)).toBeHidden()
  await form.getByLabel('Titel').fill('Tour-Linsen')
  const saved = page.waitForRequest(req => req.method() === 'POST' && /\/api\/boards\/[^/]+\/dishes$/.test(req.url()))
  await form.getByRole('button', { name: 'Speichern' }).click()

  // Added during the Tour: it notifies nobody (ADR 0006).
  expect((await saved).postDataJSON()).toMatchObject({ title: 'Tour-Linsen', tour: true })
  await expect(form).toBeHidden()
  await expect(newCardStep(page)).toContainText('Alle auf diesem Board sehen dein Gericht sofort.')
  const dishId = (await page.locator('li[data-dish-id]', { hasText: 'Tour-Linsen' }).getAttribute('data-dish-id'))!
  await expect.poll(() => holeRound(page, 'dish', dishId)).toBe(true)

  await newCardStep(page).getByRole('button', { name: 'Weiter' }).click()
  await expect(moveStep(page)).toBeVisible()
  await moveStep(page).getByRole('button', { name: 'Zurück' }).click()
  await expect(newCardStep(page)).toBeVisible()
})

const moveStep = (page: Page) => page.getByRole('dialog', { name: 'Zieh es auf „Diese Woche“' })
const deleteStep = (page: Page) => page.getByRole('dialog', { name: 'Und wieder weg' })
const dishMenu = (page: Page) => page.getByRole('dialog', { name: 'Tour-Bohnen' })
const inColumn = (page: Page, column: string, dishId: string) => page.locator(`section[aria-label="${column}"] li[data-dish-id="${dishId}"]`)

// The Tour as far as moving its Dish: one added without a link, the new
// card's Weiter tapped. The Dish's id.
async function toMoveStep(page: Page) {
  await gotoHydrated(page, '/')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()
  await tapAddButton(page)
  await expect.poll(() => holeRound(page, 'add-dish-link')).toBe(true)
  await tapOn(page, addDish(page).getByRole('button', { name: 'Ohne Link hinzufügen' }))
  const form = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
  await form.getByLabel('Titel').fill('Tour-Bohnen')
  await form.getByRole('button', { name: 'Speichern' }).click()
  await newCardStep(page).getByRole('button', { name: 'Weiter' }).click()
  await expect(moveStep(page)).toBeVisible()
  return (await page.locator('li[data-dish-id]', { hasText: 'Tour-Bohnen' }).getAttribute('data-dish-id'))!
}

// Whether the Gekocht pill showed: nothing the Tour asks for records a
// Cooking.
const cooked = (page: Page) => page.locator('[data-gekocht-pill]:visible')

test('from 768px, the Tour\'s Dish is dragged across to the next lane; "Behalten" keeps it', async ({ page }) => {
  const dishId = await toMoveStep(page)
  await expect.poll(() => holeRound(page, 'dish', dishId)).toBe(true)
  // A tap on the card doesn't open it while the Tour moves it.
  await tapOn(page, page.locator(`[data-dish-id="${dishId}"] [data-tour="dish"]`))
  await page.waitForTimeout(300)
  await expect(page).toHaveURL(/\/b\/[^/]+$/)

  // Through the hole, the card is picked up and dropped on the lane.
  const card = (await page.locator(`[data-dish-id="${dishId}"] [data-tour="dish"]`).boundingBox())!
  const lane = (await page.locator('section[aria-label="Diese Woche"]').boundingBox())!
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  await page.mouse.down()
  await page.mouse.move(lane.x + lane.width / 2, card.y + card.height / 2, { steps: 12 })
  await page.mouse.up()

  await expect(deleteStep(page)).toContainText('„Rückgängig“')
  await expect(inColumn(page, 'Diese Woche', dishId)).toBeAttached()
  await deleteStep(page).getByRole('button', { name: 'Behalten' }).click()

  await expect(switcherStep(page)).toBeVisible()
  await expect(inColumn(page, 'Diese Woche', dishId)).toBeAttached()
  await expect(cooked(page)).toHaveCount(0)
})

test.describe('on a phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })

  test('the Tour\'s Dish is moved through ⋯ → Verschieben, then deleted through ⋯ → Löschen, and "Rückgängig" brings it back', async ({ page }) => {
    const dishId = await toMoveStep(page)
    await expect.poll(() => holeRound(page, 'dish', dishId)).toBe(true)

    // Its ⋯, through the hole; the bubble follows into the menu.
    await tapOn(page, page.locator(`[data-dish-id="${dishId}"] [data-tour="dish-menu"]`))
    await expect(dishMenu(page)).toBeVisible()
    await expect(moveStep(page)).toContainText('Tipp auf „Verschieben nach…“.')
    await expect.poll(() => holeRound(page, 'menu-move')).toBe(true)
    await tapOn(page, dishMenu(page).getByRole('button', { name: 'Verschieben nach…' }))
    await expect(moveStep(page)).toContainText('Und jetzt auf „Diese Woche“.')
    const woche = (await dishMenu(page).getByRole('button', { name: 'Diese Woche' }).getAttribute('data-tour-column-id'))!
    await expect.poll(() => holeRound(page, 'menu-column', undefined, woche)).toBe(true)
    await tapOn(page, dishMenu(page).getByRole('button', { name: 'Diese Woche' }))

    await expect(dishMenu(page)).toBeHidden()
    await expect(deleteStep(page)).toBeVisible()
    await expect(inColumn(page, 'Diese Woche', dishId)).toBeAttached()

    // The spotlit ⋯ takes the tap; the bubble follows onto Löschen. The
    // hole stays round all the way there (a pill's radius never dips to 0).
    await expect.poll(() => holeRound(page, 'dish-menu', dishId)).toBe(true)
    const stop = await traceTour(page)
    await tapOn(page, page.locator(`[data-dish-id="${dishId}"] [data-tour="dish-menu"]`))
    await expect(deleteStep(page)).toContainText('Tipp auf „Löschen“.')
    await expect.poll(() => holeRound(page, 'menu-delete')).toBe(true)
    await page.waitForTimeout(300)
    const radii = (await stop()).flatMap(f => f.spot ? [f.spot.radius] : [])
    expect(radii.length).toBeGreaterThan(0)
    expect(Math.min(...radii)).toBeGreaterThan(0)
    await tapOn(page, dishMenu(page).getByRole('button', { name: 'Löschen' }))

    await expect(switcherStep(page)).toBeVisible()
    await expect(page.locator(`li[data-dish-id="${dishId}"]`)).toHaveCount(0)
    // Over the Tour, the Toast's "Rückgängig" still works, and the Tour
    // carries on.
    await page.getByRole('button', { name: 'Rückgängig' }).click()
    await expect(inColumn(page, 'Diese Woche', dishId)).toBeAttached()
    await expect(switcherStep(page)).toBeVisible()
    await expect(cooked(page)).toHaveCount(0)
  })

  test('the new card arrives with Topfbert on one side, and the ring draws round it once it has landed', async ({ page }) => {
    await gotoHydrated(page, '/')
    await hello(page).getByRole('button', { name: 'Weiter' }).click()
    await tapAddButton(page)
    await expect.poll(() => holeRound(page, 'add-dish-link')).toBe(true)
    await tapOn(page, addDish(page).getByRole('button', { name: 'Ohne Link hinzufügen' }))
    const form = page.getByRole('dialog', { name: 'Ohne Link hinzufügen' })
    await form.getByLabel('Titel').fill('Tour-Erbsen')
    const stop = await traceTour(page)
    await form.getByRole('button', { name: 'Speichern' }).click()

    await expect(newCardStep(page)).toBeVisible()
    const dishId = (await page.locator('li[data-dish-id]', { hasText: 'Tour-Erbsen' }).getAttribute('data-dish-id'))!
    await expect.poll(() => holeRound(page, 'dish', dishId)).toBe(true)
    const ring = page.locator('[data-tour-ring="drawn"]:visible')
    await expect(ring).toBeAttached()
    // It draws for longer than the hole glides (480ms).
    await expect(ring).toHaveCSS('transition-duration', '0.7s')
    await page.waitForTimeout(300)
    const frames = await stop()
    expect(sideFlips(frames, 'newCard')).toBe(0)
    expect(ringDrewOnceSettled(frames, 'newCard')).toBe(true)
  })

  test('the Tour\'s Dish long-pressed and dragged onto the Column\'s tab counts too', async ({ page }) => {
    const dishId = await toMoveStep(page)
    await expect.poll(() => holeRound(page, 'dish', dishId)).toBe(true)
    const woche = (await page.getByRole('button', { name: /^Diese Woche/ }).getAttribute('data-tour-column-id'))!
    await expect.poll(() => holeRound(page, 'column', undefined, woche)).toBe(true)

    // Through the hole: held, then dragged up onto the tab.
    const card = (await page.locator(`[data-dish-id="${dishId}"] [data-tour="dish"]`).boundingBox())!
    const tab = (await page.getByRole('button', { name: /^Diese Woche/ }).boundingBox())!
    await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(450)
    await page.mouse.move(tab.x + tab.width / 2, tab.y + tab.height / 2, { steps: 12 })
    await page.mouse.up()

    await expect(deleteStep(page)).toBeVisible()
    await expect(inColumn(page, 'Diese Woche', dishId)).toBeAttached()
    await expect.poll(() => holeRound(page, 'dish-menu', dishId)).toBe(true)
  })
})

test('Add Dish closed without saving goes back to the add button; "Ohne Gericht weiter" there closes it and goes on', async ({ page }) => {
  await gotoHydrated(page, '/')
  await hello(page).getByRole('button', { name: 'Weiter' }).click()
  await tapAddButton(page)
  await expect(linkStep(page)).toBeVisible()

  // Esc is Add Dish's own: it closes, and the Tour goes back a step.
  await page.keyboard.press('Escape')
  await expect(addDish(page)).toBeHidden()
  await expect(addStep(page)).toBeVisible()
  await expect(bubble(page)).toBeFocused()

  await tapAddButton(page)
  await linkStep(page).getByRole('button', { name: 'Ohne Gericht weiter' }).click()

  await expect(addDish(page)).toBeHidden()
  await expect(columnsStep(page)).toBeVisible()
})

test.describe('on a 360px phone', () => {
  test.use({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true })

  test('every bubble, and Topfbert on it, is fully on screen, and the spotlight sits on its target', async ({ page }) => {
    await gotoHydrated(page, '/')
    const topfbert = page.locator('[data-tour-layer] [data-topfbert-idle]')

    for (const [step, target] of [[hello(page), null], [addStep(page), 'add-button'], [columnsStep(page), 'columns'], [switcherStep(page), 'board-switcher'], [installStep(page), null]] as const) {
      await expect(step).toBeVisible()
      await expect.poll(() => onScreen(page, bubble(page))).toBe(true)
      await expect.poll(() => onScreen(page, topfbert)).toBe(true)
      // The hole, once it has glided there: round every element of the
      // target, and 6px more.
      if (target) await expect.poll(() => holeRound(page, target)).toBe(true)
      await step.getByRole('button', { name: /^(Weiter|Fertig|Ohne Gericht weiter)$/ }).click()
    }
    await expect(layer(page)).toBeHidden()
  })

  test('the bubble over Add Dish is fully on screen, and above the sheet', async ({ page }) => {
    await gotoHydrated(page, '/')
    await hello(page).getByRole('button', { name: 'Weiter' }).click()
    await tapAddButton(page)

    await expect(linkStep(page)).toBeVisible()
    await expect.poll(() => onScreen(page, page.locator('[data-tour-step]:visible'))).toBe(true)
    await expect.poll(() => onScreen(page, page.locator('[data-tour-layer] [data-topfbert-idle]:visible'))).toBe(true)
    await expect.poll(() => bubbleOnTop(page)).toBe(true)
  })

  // The Tour as far as its last step, past the Dish steps.
  async function toLastStep(page: Page) {
    await hello(page).getByRole('button', { name: 'Weiter' }).click()
    await addStep(page).getByRole('button', { name: 'Ohne Gericht weiter' }).click()
    await columnsStep(page).getByRole('button', { name: 'Weiter' }).click()
    await switcherStep(page).getByRole('button', { name: 'Weiter' }).click()
  }

  test('in a browser tab that offered no install, the last step says where Chrome\'s menu has it', async ({ page }) => {
    await gotoHydrated(page, '/')
    await toLastStep(page)

    await expect(installStep(page)).toContainText('Tipp oben rechts auf ⋮ und dann auf „Zum Startbildschirm hinzufügen“.')
    await expect(installStep(page)).toContainText('TikTok')
    await expect(installStep(page).getByRole('button', { name: 'Installieren' })).toHaveCount(0)
    await expect.poll(() => onScreen(page, bubble(page))).toBe(true)
    await installStep(page).getByRole('button', { name: 'Fertig' }).click()

    await expect(layer(page)).toBeHidden()
    await expect(ended(page)).toBeVisible()
  })

  test('the install offer, kept from the page\'s load, gives the last step "Installieren"; once its dialog is answered the Tour ends', async ({ page }) => {
    // The browser's offer, made as early as Chrome can: once the page is
    // parsed, before the app's own code has run, so only the head's inline
    // script is there to keep it.
    await page.addInitScript(() => {
      document.addEventListener('readystatechange', () => {
        if (document.readyState !== 'interactive') return
        const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
          prompt: async () => {
            (window as { e2eInstallPrompted?: boolean }).e2eInstallPrompted = true
          },
          userChoice: Promise.resolve({ outcome: 'dismissed' }),
        })
        dispatchEvent(offer)
      })
    })
    await gotoHydrated(page, '/')
    await toLastStep(page)

    await expect(installStep(page)).toContainText('Installiert kannst du Links direkt aus TikTok')
    await installStep(page).getByRole('button', { name: 'Installieren' }).click()

    await expect(layer(page)).toBeHidden()
    expect(await page.evaluate(() => (window as { e2eInstallPrompted?: boolean }).e2eInstallPrompted)).toBe(true)
    await expect(ended(page)).toBeVisible()
    await expect.poll(() => tourSeen(page)).toBe(1)
  })

  test('installed, the last step is the share tip', async ({ page }) => {
    // Run as an installed app (display-mode: standalone). Chromium's
    // emulation takes no display-mode, so the query answers so itself.
    await page.addInitScript(() => {
      const matchMedia = window.matchMedia.bind(window)
      window.matchMedia = query => matchMedia(query === '(display-mode: standalone)' ? 'all' : query)
    })
    await gotoHydrated(page, '/')
    await toLastStep(page)

    await expect(shareTipStep(page)).toContainText('Teilen → malkochen')
    await expect(installStep(page)).toBeHidden()
    await shareTipStep(page).getByRole('button', { name: 'Fertig' }).click()
    await expect(layer(page)).toBeHidden()
  })
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('nothing in the Tour moves: no fading, gliding or rising, and Topfbert stands still', async ({ page }) => {
    await gotoHydrated(page, '/')
    await expect(hello(page)).toBeVisible()
    await hello(page).getByRole('button', { name: 'Weiter' }).click()
    await expect(addStep(page)).toBeVisible()

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
