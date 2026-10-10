import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest, column, titles } from './board'
import { ANY_CHEER, CHEERS, cheer, confetti, confettiOrigin, gekochtPill, topfbert } from './celebration'
import { playing } from './clips'
import { gotoHydrated, reloadHydrated } from './hydration'
import { clickAndExpectSaving, holdRequests } from './loading'
import { resetBoard, seedCookings, seedDish } from './seed'

// Cooking (PRD stories 35, 48–55): "Gekocht ✓" on a card, the Gekocht toast
// with "Notiz hinzufügen" and "Rückgängig", and the Cooking History in the
// Dish detail. All Columns side by side (desktop), unless a test says
// otherwise. Hedy's Board is used by this file only.
test.describe.configure({ mode: 'serial' })
test.use({ viewport: { width: 1280, height: 800 } })

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

function gekochtToast(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Gekocht ✓' })
}

test('"Gekocht ✓", then undo: the Dish goes back where it was, without a Cooking', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  // CI's retry runs the whole file again, on the same database: from an
  // empty Board, not one with the Dishes of the try before.
  await resetBoard(page)
  for (const title of ['Linsensuppe', 'Chana Masala', 'Pad Thai']) {
    await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  }
  await gotoHydrated(page, '/')
  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])

  await page.getByRole('button', { name: 'Gekocht ✓: „Chana Masala“' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Linsensuppe'])
  await expect(titles(page, 'Gekocht')).toHaveText(['Chana Masala'])
  await expect(column(page, 'Gekocht').getByText('1× gekocht')).toBeVisible()
  const toast = gekochtToast(page)
  await expect(toast.getByRole('button', { name: 'Notiz hinzufügen' })).toBeVisible()

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])
  await expect(titles(page, 'Gekocht')).toHaveText([])
  await expect(page.getByText('1× gekocht')).toBeHidden()
  await expect(page.getByRole('link', { name: 'Chana Masala' })).toBeFocused()
  await reloadHydrated(page)
  await expect(titles(page, 'Ideen')).toHaveText(['Pad Thai', 'Chana Masala', 'Linsensuppe'])
  await expect(page.getByText('1× gekocht')).toBeHidden()
})

test('a note from the toast shows in the Cooking History; cooking again counts', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await gotoHydrated(page, '/')

  await page.getByRole('button', { name: 'Gekocht ✓: „Pad Thai“' }).click()
  await gekochtToast(page).getByRole('button', { name: 'Notiz hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Notiz zum Kochen' })
  await expect(sheet.getByLabel('Notiz')).toBeFocused()
  await sheet.getByLabel('Notiz').fill('mit Räuchertofu besser')
  const release = await holdRequests(page, 'PATCH', /\/api\/cookings\/[^/]+$/)
  await clickAndExpectSaving(sheet.locator('button[type="submit"]'), 'Speichert …')
  release()
  await expect(sheet).toBeHidden()

  // Out of Gekocht and back in, from the menu: the history stays and grows.
  await page.getByRole('button', { name: 'Mehr zu „Pad Thai“' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Diese Woche' }).click()
  await expect(column(page, 'Diese Woche').getByText('1× gekocht')).toBeVisible()
  await expect(titles(page, 'Gekocht')).toHaveText([])
  await page.getByRole('button', { name: 'Mehr zu „Pad Thai“' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Pad Thai' }).getByRole('button', { name: 'Gekocht' }).click()
  await expect(gekochtToast(page)).toBeVisible()
  await expect(column(page, 'Gekocht').getByText('2× gekocht')).toBeVisible()

  await reloadHydrated(page)
  await page.getByRole('link', { name: 'Pad Thai' }).click()
  const detail = page.getByRole('dialog', { name: 'Pad Thai' })
  await expect(detail.locator('[data-cooking-summary]')).toContainText('2× gekocht · zuletzt')
  const entries = detail.locator('[data-cooking]')
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(1)).toContainText('mit Räuchertofu besser')
})

test('in the detail: add a note later, delete a Cooking with undo, and cook again', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Pad Thai' }).click()
  const detail = page.getByRole('dialog', { name: 'Pad Thai' })
  const entries = detail.locator('[data-cooking]')
  await expect(entries).toHaveCount(2)

  // The newest Cooking has no note yet.
  await entries.first().getByRole('button', { name: /^Notiz zum Kochen am .* hinzufügen$/ }).click()
  const sheet = page.getByRole('dialog', { name: 'Notiz zum Kochen' })
  await sheet.getByLabel('Notiz').fill('doppelt Knoblauch')
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  await expect(entries.first()).toContainText('doppelt Knoblauch')

  await entries.nth(1).getByRole('button', { name: /^Kochen am .* löschen$/ }).click()
  await expect(entries).toHaveCount(1)
  await expect(detail.locator('[data-cooking-summary]')).toContainText('1× gekocht')
  await page.getByRole('status').getByRole('button', { name: 'Rückgängig' }).click()
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(1)).toContainText('mit Räuchertofu besser')

  await entries.first().getByRole('button', { name: /^Kochen am .* löschen$/ }).click()
  await expect(entries).toHaveCount(1)
  // Without undo, it stays deleted.
  await expect(page.getByRole('status').getByRole('button', { name: 'Rückgängig' })).toBeHidden({ timeout: 8000 })

  // Already in Gekocht, "Gekocht ✓" records another Cooking.
  await detail.getByRole('button', { name: 'Gekocht ✓' }).click()
  await expect(entries).toHaveCount(2)
  await expect(gekochtToast(page)).toBeVisible()

  await reloadHydrated(page)
  await expect(entries).toHaveCount(2)
  await expect(entries.nth(1)).toContainText('mit Räuchertofu besser')
  await expect(detail).not.toContainText('doppelt Knoblauch')
})

// As decided on #105: the celebration at the top, the actions at the bottom.
test('"Gekocht ✓" celebrates: veggie confetti, Topfbert in a pill at the top until it goes by itself, and the Gekocht toast at the bottom', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await seedDish(page, { title: 'Ramen', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')
  await expect(confetti(page)).toHaveCount(0)
  await expect(topfbert(page)).toHaveCount(0)
  const cook = page.getByRole('button', { name: 'Gekocht ✓: „Ramen“' })
  // The button's middle as it is clicked: the cards may still be rising in
  // (card-rise), a few pixels lower when measured before the click.
  type Pressed = { pressedAt?: { x: number, y: number } }
  await cook.evaluate((el) => {
    el.addEventListener('click', () => {
      const box = el.getBoundingClientRect()
      const w = window as unknown as Pressed
      w.pressedAt = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }, { once: true, capture: true })
  })

  await cook.click()

  // 14 pieces fly up from the button and fall off the screen, once.
  await expect(confetti(page)).toHaveCount(14)
  const origin = await confettiOrigin(page)
  const button = await page.evaluate(() => (window as unknown as Pressed).pressedAt)
  expect(button, 'the click reached the button').toBeDefined()
  expect(Math.abs(origin.x - button!.x)).toBeLessThan(2)
  expect(Math.abs(origin.y - button!.y)).toBeLessThan(2)
  // The pill: Topfbert with his cheer, and "Gekocht ✓", at the top; no
  // second line on its own Board.
  const pill = gekochtPill(page)
  await expect(pill.locator('p')).toHaveText('Gekocht ✓')
  await expect(topfbert(pill)).toBeVisible()
  await expect(cheer(pill)).toHaveText(ANY_CHEER)
  await expect(topfbert(page)).toHaveCount(1)
  // He idles there (TopfbertIdle).
  await expect.poll(() => playing(topfbert(pill))).toEqual(['/clips/topfbert-idle-happy.svg'])
  // The toast at the bottom, with its actions.
  const toast = gekochtToast(page)
  await expect(toast.getByRole('button', { name: 'Notiz hinzufügen' })).toBeVisible()
  const { height } = page.viewportSize()!
  const pillBox = (await pill.boundingBox())!
  expect(pillBox.y + pillBox.height).toBeLessThan(height / 4)
  const toastBox = (await page.locator('[data-toast]').boundingBox())!
  expect(toastBox.y).toBeGreaterThan(height * 3 / 4)
  await expect(confetti(page)).toHaveCount(0)
  // The pill goes by itself; the toast stays, with its undo.
  await expect(pill).toHaveCount(0)
  await expect(topfbert(page)).toHaveCount(0)
  await toast.getByRole('button', { name: 'Rückgängig' }).click()
  await expect(titles(page, 'Ideen')).toContainText(['Ramen'])
})

test('"Gekocht ✓" in the Dish detail celebrates there, at the top, with the toast at the bottom', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await gotoHydrated(page, '/')
  await page.getByRole('link', { name: 'Ramen' }).click()
  const detail = page.getByRole('dialog', { name: 'Ramen' })

  await detail.getByRole('button', { name: 'Gekocht ✓' }).click()

  await expect(confetti(detail)).toHaveCount(14)
  const pill = gekochtPill(detail)
  await expect(pill).toContainText('Gekocht ✓')
  await expect(cheer(pill)).toHaveText(ANY_CHEER)
  await expect(gekochtToast(page).getByRole('button', { name: 'Rückgängig' })).toBeVisible()
  const { height } = page.viewportSize()!
  expect((await pill.boundingBox())!.y).toBeLessThan(height / 4)
  expect((await detail.locator('[data-toast]').boundingBox())!.y).toBeGreaterThan(height * 3 / 4)
})

// The note sheet opened from the Gekocht toast makes the Dish detail step back (scale
// .96). The toast, on its way out, stays where it was meanwhile: it doesn't
// jump into the side panel (desktop) or shrink with the screen (phone). Its
// way out only moves it down, so its left edge and width stay; they're
// sampled every frame until it's gone.
test('"Notiz hinzufügen" in the Gekocht toast in the Dish detail leaves the toast where it was', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  // A Dish for each screen size: cooked, it leaves Ideen.
  const runs = [{ viewport: { width: 1280, height: 800 }, title: 'Bibimbap' }, { viewport: { width: 360, height: 740 }, title: 'Gyoza' }]
  for (const { title } of runs) await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })

  for (const { viewport, title } of runs) {
    await page.setViewportSize(viewport)
    await gotoHydrated(page, '/')
    await page.getByRole('link', { name: title }).click()
    const detail = page.getByRole('dialog', { name: title })
    await detail.getByRole('button', { name: 'Gekocht ✓' }).click()
    const pill = detail.locator('[data-toast]')
    await expect(pill).toBeVisible()
    await pill.evaluate(el => Promise.all(el.parentElement!.getAnimations().map(a => a.finished)))

    const frames = pill.evaluate(el => new Promise<{ x: number, width: number }[]>((resolve) => {
      const seen: { x: number, width: number }[] = []
      const sample = () => {
        if (!el.isConnected) return resolve(seen)
        const { x, width } = el.getBoundingClientRect()
        seen.push({ x, width })
        requestAnimationFrame(sample)
      }
      sample()
    }))
    await gekochtToast(page).getByRole('button', { name: 'Notiz hinzufügen' }).click()
    const sheet = page.getByRole('dialog', { name: 'Notiz zum Kochen' })
    await expect(sheet).toBeVisible()
    await expect(detail).toHaveAttribute('data-covered')

    const [first, ...rest] = await frames
    expect(rest.length, 'sampled until it left').toBeGreaterThan(3)
    for (const frame of rest) {
      expect(Math.abs(frame.x - first!.x), `moved sideways at ${viewport.width}px`).toBeLessThan(1)
      expect(Math.abs(frame.width - first!.width), `changed width at ${viewport.width}px`).toBeLessThan(1)
    }
    await page.keyboard.press('Escape')
    await expect(sheet).toBeHidden()
    await page.keyboard.press('Escape')
    await expect(detail).toBeHidden()
  }
})

// PRD story 30. Text that is cut keeps all of it in the DOM, so only its
// widths tell whether "99× gekocht" shows in full. It shares its line with a
// long Creator (#118), which gives way with "…". The desktop Column is the
// narrowest side by side (tablet's is 340px), and a 360px phone is about as
// narrow as a card gets.
test('"99× gekocht" shows in full beside a long Creator, an avatar and a note, side by side and on a phone', async ({ page }) => {
  const title = 'Ofengemüse mit Räuchertofu und Zitronen-Tahini'
  const creator = 'Die vegane Familienküche von Oma Hildegard und ihren Enkeln'
  await signIn(page, ALLOWLISTED[6])
  await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok', note: 'Mit Tofu geht auch.', addedBy: ALLOWLISTED[6], creator })
  await seedCookings(page, title, 99)

  for (const viewport of [{ width: 1280, height: 800 }, { width: 768, height: 900 }, { width: 360, height: 740 }]) {
    await page.setViewportSize(viewport)
    await gotoHydrated(page, '/')
    const card = page.getByRole('article', { name: title })
    const count = card.locator('[data-cooked-count]')
    await expect(count).toHaveText('99× gekocht')
    await cardAtRest(card)

    expect(await count.evaluate(el => el.scrollWidth <= el.clientWidth), `cut at ${viewport.width}px`).toBe(true)
    // The Creator: one line, ending in "…".
    const shownCreator = card.locator('[data-creator]')
    await expect(shownCreator).toHaveText(`Veröffentlicht von ${creator}`)
    expect(await shownCreator.evaluate(el => ({
      cut: el.scrollWidth > el.clientWidth,
      ellipsis: getComputedStyle(el).textOverflow,
      lines: Math.round(el.getBoundingClientRect().height / Number.parseFloat(getComputedStyle(el).lineHeight)),
    })), `Creator at ${viewport.width}px`).toEqual({ cut: true, ellipsis: 'ellipsis', lines: 1 })
    const parts: Record<string, Locator> = {
      title: card.getByRole('heading', { name: title }),
      creator: shownCreator,
      avatar: card.getByTitle(/^Hinzugefügt von /),
      note: card.getByTitle('Mit Notiz'),
      count,
      cook: page.getByRole('button', { name: `Gekocht ✓: „${title}“` }),
    }
    const boxes = await Promise.all(Object.entries(parts).map(async ([name, part]) => ({ name, box: (await part.boundingBox())! })))
    for (const [i, a] of boxes.entries()) {
      for (const b of boxes.slice(i + 1)) {
        const apart = a.box.x + a.box.width <= b.box.x || b.box.x + b.box.width <= a.box.x
          || a.box.y + a.box.height <= b.box.y || b.box.y + b.box.height <= a.box.y
        expect(apart, `${a.name} overlaps ${b.name} at ${viewport.width}px`).toBe(true)
      }
    }
    // All of it within the card.
    const cardBox = (await card.boundingBox())!
    for (const { name, box } of boxes) {
      expect(box.y + box.height, `${name} below the card at ${viewport.width}px`).toBeLessThanOrEqual(cardBox.y + cardBox.height)
    }
  }
})

// #114: Topfbert says a different cheer each time he pops up, and every one
// of them fits his bubble on one line, beside him in the Gekocht pill (#129)
// without covering "Gekocht ✓", on a 360px phone (the narrowest the screen
// gets): the pill makes room for it. Each cheer is put in his bubble in turn
// and measured, while the pill is still there.
test('Topfbert says something else the next time, and every cheer fits beside him in the pill on a phone', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  await seedDish(page, { title: 'Dal', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await page.setViewportSize({ width: 360, height: 740 })
  await gotoHydrated(page, '/')
  // On a phone, Ideen shows; "Gekocht ✓" on its card cooks it.
  const cook = page.getByRole('button', { name: 'Gekocht ✓: „Dal“' })

  await cook.click()
  await expect(cheer(page)).toHaveText(ANY_CHEER)
  const first = await cheer(page).textContent()
  await gekochtToast(page).getByRole('button', { name: 'Rückgängig' }).click()
  await expect(cook).toBeVisible()
  await expect(topfbert(page)).toHaveCount(0)
  await cook.click()
  await expect(cheer(page)).toHaveText(ANY_CHEER)
  expect(await cheer(page).textContent(), 'the same cheer twice in a row').not.toBe(first)

  // Once the pill is in and he and his bubble have popped up (the idle
  // loops go on).
  const fits = await cheer(page).evaluate(async (el, cheers) => {
    const him = el.previousElementSibling!
    const pill = el.closest('[data-gekocht-pill]')!
    await Promise.all([el, him, pill].flatMap(e => e.getAnimations()).map(a => a.finished))
    const cook = pill.querySelector('p')!
    return cheers.map((text) => {
      el.textContent = text
      const lines = document.createRange()
      lines.selectNodeContents(el)
      const bubble = el.getBoundingClientRect()
      const box = pill.getBoundingClientRect()
      return {
        text,
        lines: new Set([...lines.getClientRects()].map(r => Math.round(r.top))).size,
        inPill: bubble.left >= box.left && bubble.right <= box.right,
        besideText: bubble.right <= cook.getBoundingClientRect().left,
        onScreen: box.left >= 0 && box.right <= innerWidth,
      }
    })
  }, CHEERS)
  for (const fit of fits) expect(fit, `"${fit.text}"`).toEqual({ text: fit.text, lines: 1, inPill: true, besideText: true, onScreen: true })
})

// #170: how the Gekocht toast's text and actions sit at `width`, for a Dish
// of its own (an undo isn't settled before a reload). `needed` is what one
// row takes, wrapped or not, and `parts` the widths it's made of, so a
// failure says how much is missing (fonts differ between systems: the "✓"
// comes from a fallback font, and Linux sets text about 5% wider).
async function gekochtToastFit(page: Page, width: number, title: string) {
  await signIn(page, ALLOWLISTED[6])
  await seedDish(page, { title, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await page.setViewportSize({ width, height: 740 })
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: `Gekocht ✓: „${title}“` }).click()
  const toast = gekochtToast(page).locator('[data-toast]')
  await expect(toast.getByRole('button', { name: 'Rückgängig' })).toBeVisible()
  return toast.evaluate(async (el) => {
    // Once it has moved in (not the bar's countdown, a Web Animation).
    const region = el.closest('[role="status"]')!
    await Promise.all(region.getAnimations({ subtree: true }).filter(a => a instanceof CSSTransition).map(a => a.finished))
    const box = el.getBoundingClientRect()
    const buttons = [...el.querySelectorAll('button')]
    const text = el.querySelector('p')!
    const actions = buttons[0]!.parentElement!
    const middle = (r: DOMRect) => r.top + r.height / 2
    const level = (a: Element, b: Element) => Math.abs(middle(a.getBoundingClientRect()) - middle(b.getBoundingClientRect())) <= 2
    const style = getComputedStyle(el)
    const w = (e: Element) => e.getBoundingClientRect().width
    const needed = [style.paddingLeft, style.columnGap, style.paddingRight].map(parseFloat).reduce((a, b) => a + b) + w(text) + w(actions)
    return {
      fit: {
        onScreen: box.left >= 0 && box.right <= innerWidth,
        overflowing: el.scrollWidth > el.clientWidth,
        cut: buttons.filter(b => b.getBoundingClientRect().right > box.right || b.scrollWidth > b.clientWidth).map(b => b.textContent!.trim()),
        actionsInOneRow: buttons.every(b => level(b, buttons[0]!)),
        oneRow: buttons.every(b => level(b, text)),
      },
      spare: Math.round((w(region) - needed) * 10) / 10,
      parts: [text, ...buttons].map(e => `${e.textContent!.trim()}: ${Math.round(w(e) * 10) / 10}`).join(', '),
    }
  })
}

// #170: on a 360px phone the Gekocht toast's actions fit it in one row,
// "Rückgängig" not cut off, with room to spare.
test('the Gekocht toast\'s actions fit it in one row on a 360px phone', async ({ page }) => {
  const { fit, spare, parts } = await gekochtToastFit(page, 360, 'Kichererbsencurry')
  expect(fit, parts).toEqual({ onScreen: true, overflowing: false, cut: [], actionsInOneRow: true, oneRow: true })
  expect(spare, `room to spare at 360px (${parts})`).toBeGreaterThanOrEqual(8)
})

// #170: narrower than that, the actions go below the text rather than being
// cut off.
test('on a 320px phone the Gekocht toast\'s actions go below its text, not cut off', async ({ page }) => {
  const { fit, parts } = await gekochtToastFit(page, 320, 'Linsencurry')
  expect(fit, parts).toEqual({ onScreen: true, overflowing: false, cut: [], actionsInOneRow: true, oneRow: false })
})

// #170 (option B, 2026-10-06): on a phone the Gekocht pill sits just below
// the sticky Column tabs, so they and the Gekocht tab's bump stay in sight;
// it's in the same place whether the tabs are stuck or not.
test('on a phone the Gekocht pill sits below the sticky Column tabs, scrolled down or not', async ({ page }) => {
  await signIn(page, ALLOWLISTED[6])
  for (let i = 1; i <= 8; i++) await seedDish(page, { title: `Bowl ${i}`, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await page.setViewportSize({ width: 390, height: 740 })
  await gotoHydrated(page, '/')
  const tabs = page.getByRole('navigation', { name: 'Spalten' })
  const places: number[] = []
  for (const scrolled of [false, true]) {
    const title = scrolled ? 'Bowl 1' : 'Bowl 8'
    if (scrolled) {
      await page.getByRole('article', { name: title }).scrollIntoViewIfNeeded()
      await page.mouse.wheel(0, 400)
      await expect.poll(async () => (await tabs.boundingBox())!.y).toBeLessThanOrEqual(0.5)
    }
    await page.getByRole('button', { name: `Gekocht ✓: „${title}“` }).click()
    await expect(gekochtPill(page)).toBeVisible()
    await expect(topfbert(page)).toBeVisible()
    const looks = await gekochtPill(page).evaluate(async (pill) => {
      await Promise.all(pill.getAnimations().map(a => a.finished))
      const nav = document.querySelector('nav[aria-label="Spalten"]')!.getBoundingClientRect()
      const him = pill.querySelector('[data-topfbert]')!.getBoundingClientRect()
      const box = pill.getBoundingClientRect()
      return { top: Math.min(box.top, him.top), tabsBottom: nav.bottom, stuck: nav.top <= 0.5 }
    })
    expect(looks.stuck).toBe(scrolled)
    if (scrolled) expect(looks.top).toBeGreaterThanOrEqual(looks.tabsBottom)
    places.push(looks.top)
    await gekochtToast(page).getByRole('button', { name: 'Rückgängig' }).click()
    await expect(gekochtPill(page)).toHaveCount(0)
  }
  // The same place either way: it doesn't jump with the tabs.
  expect(Math.abs(places[0]! - places[1]!)).toBeLessThanOrEqual(1)
})
