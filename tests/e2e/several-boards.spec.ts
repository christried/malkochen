import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, tab, titles } from './board'
import { expectCardShape } from './card-shape'
import { ANY_CHEER, cheer, confetti, confettiOrigin, gekochtPill } from './celebration'
import { auraAngle, auraColours, backgroundOf, colourOf, colours, contrast, rgb, tintedWith } from './colour'
import { gotoHydrated } from './hydration'
import { clickAndExpectSaving, holdRequests } from './loading'
import { removeUsers } from './seed'

// Several Boards (PRD stories 12, 39, 46, 61): the Board switcher, "Neues
// Board", and moving a Dish to another Board. Annie is used by this file
// only; each test makes the Boards it needs, from none: CI's retry of a
// test runs it again on the same database, where Boards of the same name
// from the try before would be there twice.
test.beforeEach(() => removeUsers(ALLOWLISTED[9]))

// The switcher: the Board's name at the top, which opens the list.
function switcher(page: Page) {
  return page.getByRole('heading', { level: 1 }).getByRole('button')
}
function boardList(page: Page) {
  return page.getByRole('navigation', { name: 'Deine Boards' })
}

// A Board made through the API, as another visit would have.
async function createBoard(page: Page, name: string, emoji: string): Promise<string> {
  const res = await page.request.post('/api/boards', { data: { name, emoji } })
  expect(res.status()).toBe(201)
  return (await res.json()).id
}

test('a Member creates a Board from the switcher, switches between Boards, and the app reopens the last one', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[9])
  const home = await createBoard(page, 'Daheim', '🌱')
  await gotoHydrated(page, `/b/${home}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')

  await switcher(page).click()
  await boardList(page).getByRole('button', { name: 'Neues Board' }).click()
  const sheet = page.getByRole('dialog', { name: 'Neues Board' })
  await expect(sheet.getByLabel('Name')).toHaveAttribute('placeholder', /^z\. B\. „.+“$/)
  await sheet.getByLabel('Name').fill('Kochclub')
  await sheet.getByRole('radio', { name: '🥟' }).click()
  const release = await holdRequests(page, 'POST', /\/api\/boards$/)
  await clickAndExpectSaving(sheet.locator('button[type="submit"]'), 'Erstellt …')
  release()

  // The new Board celebrates first (achievements.spec.ts).
  await page.getByRole('dialog', { name: '🥟 Kochclub ist bereit' }).getByRole('button', { name: 'Los geht’s' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🥟 Kochclub')
  await expect(page.getByRole('navigation', { name: 'Spalten' }).getByRole('button')).toHaveText([/Ideen/, /Diese Woche/, /Gekocht/])

  await switcher(page).click()
  const links = boardList(page).getByRole('link')
  await expect(links.filter({ hasText: 'Kochclub' })).toHaveAttribute('aria-current', 'page')
  await links.filter({ hasText: 'Daheim' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')
  await expect(boardList(page)).toHaveCount(0)
  // The skeleton already names the Board; it's opened once the skeleton has
  // gone. A visit before that races the open (#243).
  await expect(page.locator('[data-board-skeleton]')).toHaveCount(0)

  // A new visit opens the Board used last.
  await gotoHydrated(page, '/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')
})

test('each row of the switcher has a Board Settings button for its Board: it opens that Board\'s Board Settings without switching to it, and the row still switches', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[9])
  const home = await createBoard(page, 'Daheim', '🌱')
  await createBoard(page, 'Kochclub', '🥟')
  await gotoHydrated(page, `/b/${home}`)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')

  await switcher(page).click()
  const buttons = boardList(page).getByRole('link', { name: /^Board-Einstellungen: / })
  // One per Board, named after it.
  await expect(buttons).toHaveCount(2)
  expect((await buttons.evaluateAll(els => els.map(el => el.getAttribute('aria-label')))).sort()).toEqual(['Board-Einstellungen: Daheim', 'Board-Einstellungen: Kochclub'])
  // A comfortable tap target on a phone, beside the row's own: measured once
  // the panel has popped in (the emojis hop for ever).
  await boardList(page).evaluate(el => Promise.all(el.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished)))
  for (const button of await buttons.all()) {
    const box = (await button.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
  }
  const kochclubSettings = boardList(page).getByRole('link', { name: 'Board-Einstellungen: Kochclub' })
  await expect(kochclubSettings).toHaveAttribute('data-tooltip', 'Board-Einstellungen: Kochclub')

  // Kochclub's Board Settings, straight from Daheim.
  await kochclubSettings.click()
  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Kochclub')
  // Daheim is still the Board you were on: back is Daheim.
  await page.goBack()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')
  // The skeleton names the Board already, and its switcher opens nothing:
  // the Board is back once the skeleton has gone (as after #243).
  await expect(page.locator('[data-board-skeleton]')).toHaveCount(0)

  // Leaving Board Settings lands on the Board they were for.
  await switcher(page).click()
  await boardList(page).getByRole('link', { name: 'Board-Einstellungen: Kochclub' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Board-Einstellungen' })).toBeVisible()
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Kochclub')
  await page.getByRole('link', { name: 'Zurück zum Board' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🥟 Kochclub')

  // The row itself switches, as before.
  await expect(page.locator('[data-board-skeleton]')).toHaveCount(0)
  await switcher(page).click()
  await boardList(page).getByRole('link').filter({ hasText: 'Daheim' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌱 Daheim')
  await expect(page).not.toHaveURL(/\/settings$/)
})

// How the header's switcher and round buttons look, next to the theme's
// tokens.
async function headerLooks(page: Page) {
  return page.locator('header').first().evaluate((header) => {
    const token = (property: 'color' | 'boxShadow', value: string) => {
      const probe = document.createElement('span')
      probe.style[property] = value
      document.body.append(probe)
      const resolved = getComputedStyle(probe)[property]
      probe.remove()
      return resolved
    }
    const pill = header.querySelector('h1 button')!
    const pebble = pill.querySelector('[data-emoji-pebble]')!
    const emoji = pebble.firstElementChild ?? pebble
    const inside = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5
    const range = document.createRange()
    range.selectNodeContents(emoji)
    const style = getComputedStyle(pill)
    const pebbleStyle = getComputedStyle(pebble)
    const pebbleBox = pebble.getBoundingClientRect()
    return {
      pill: { shadow: style.boxShadow, family: style.fontFamily, size: style.fontSize, weight: style.fontWeight },
      pebble: { background: pebbleStyle.backgroundColor, round: Number.parseFloat(pebbleStyle.borderTopLeftRadius) >= pebbleBox.height / 2, emojiInside: inside(range.getBoundingClientRect(), pebbleBox), inPill: inside(pebbleBox, pill.getBoundingClientRect()) },
      chevron: pill.querySelectorAll('svg').length,
      buttons: [...header.querySelectorAll('[aria-label="Gerichte suchen"], [aria-label="Einstellungen"]')].map(b => getComputedStyle(b).backgroundColor),
      surface: token('color', 'var(--color-surface)'),
      surfaceMuted: token('color', 'var(--color-surface-muted)'),
      cardShadow: token('boxShadow', 'var(--shadow-card)'),
    }
  })
}

for (const scheme of ['light', 'dark'] as const) {
  test(`the switcher is a pill: the emoji in a round pebble, the name in the button type, a chevron (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme })
    await signIn(page, ALLOWLISTED[9])
    const name = scheme === 'light' ? 'Keksdose' : 'Keksglas'
    const board = await createBoard(page, name, '🍪')
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await gotoHydrated(page, `/b/${board}`)
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`🍪 ${name}`)
      const looks = await headerLooks(page)
      // Phones: Tailwind puts its (empty) ring shadows before the card's.
      // From 768px the pill sits in its aura, with no shadow (#285).
      const phone = width < 768
      expect(looks.pill).toEqual({ shadow: phone ? expect.stringContaining(looks.cardShadow) : 'none', family: expect.stringMatching(/^Figtree/), size: '15px', weight: '600' })
      // The pebble is on surface where the pill around it is filled (#206),
      // on surface-muted where it is white (#285).
      expect(looks.pebble).toEqual({ background: phone ? looks.surface : looks.surfaceMuted, round: true, emojiInside: true, inPill: true })
      expect(looks.chevron).toBe(1)
      expect(looks.buttons).toEqual([looks.surface, looks.surface])
    }
    // It still opens the list.
    await switcher(page).click()
    await expect(boardList(page).getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute('aria-current', 'page')
  })
}

// #206: on phones the pill is filled in the Board's tint, so it reads as a
// button and doesn't blend into the page: they show one Column at a time and
// the page wears that Column's accent, so the pill does too, fuller. With
// every Column showing (#285), the pill is white in an aura of the Board's
// Column accents. Its name stays readable on it (WCAG AA).
async function deleteColumn(page: Page, boardId: string, name: string) {
  const board = await (await page.request.get(`/api/boards/${boardId}`)).json() as { columns: { id: string, name: string }[] }
  const res = await page.request.delete(`/api/columns/${board.columns.find(c => c.name === name)!.id}`)
  expect(res.ok()).toBe(true)
}

for (const scheme of ['light', 'dark'] as const) {
  test(`on a phone the switcher pill is filled in the Column's tint the page wears, and follows it (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.emulateMedia({ colorScheme: scheme })
    await signIn(page, ALLOWLISTED[9])
    const board = await createBoard(page, 'Keksdose', '🍪')
    await gotoHydrated(page, `/b/${board}`)
    const pill = switcher(page)
    const known = await colours(page, 'surface')
    const fill = async () => (await rgb(page, [await backgroundOf(pill)]))[0]!
    const atRest = () => pill.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))

    expect(tintedWith(await fill(), known)).toBe('butter')
    // Filled: neither plain surface nor the page behind it.
    const [behind, ink] = await rgb(page, [await backgroundOf(page.locator('main.board')), await colourOf(pill)])
    expect(contrast(await fill(), known.background)).toBeGreaterThan(1.15)
    expect(contrast(await fill(), behind!)).toBeGreaterThan(1.15)
    expect(contrast(ink!, await fill())).toBeGreaterThanOrEqual(4.5)

    for (const [name, accent] of [['Diese Woche', 'orchid'], ['Gekocht', 'sage']] as const) {
      await tab(page, name).click()
      await expect.poll(async () => tintedWith(await fill(), known)).toBe(accent)
      await atRest()
      await page.locator('main.board').evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
      const [behindNow] = await rgb(page, [await backgroundOf(page.locator('main.board'))])
      expect(contrast(await fill(), behindNow!)).toBeGreaterThan(1.15)
      expect(contrast(ink!, await fill())).toBeGreaterThanOrEqual(4.5)
    }
  })

  test(`on a computer the switcher pill is white in the Board's aura, and another Board's changes it (${scheme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ colorScheme: scheme })
    await signIn(page, ALLOWLISTED[9])
    const three = await createBoard(page, 'Keksdose', '🍪')
    const two = await createBoard(page, 'Brotkasten', '🥖')
    await deleteColumn(page, two, 'Diese Woche')
    await gotoHydrated(page, `/b/${three}`)
    const pill = switcher(page)
    const aura = page.getByRole('heading', { level: 1 })
    const known = await colours(page, 'surface')
    const auraOf = async () => (await rgb(page, await auraColours(aura))).map(colour => tintedWith(colour, known))

    // White, its name in the text colour (AA), no shadow; its pebble on
    // surface-muted.
    const [fill, ink, surface, pebble, muted] = await rgb(page, [
      await backgroundOf(pill),
      await colourOf(pill),
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-surface')),
      await backgroundOf(pill.locator('[data-emoji-pebble]')),
      await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-surface-muted')),
    ])
    expect(fill).toEqual(surface)
    expect(contrast(ink!, fill!)).toBeGreaterThanOrEqual(4.5)
    expect(pebble).toEqual(muted)
    await expect(pill).toHaveCSS('box-shadow', 'none')

    // A 1.5px rim of the Board's Column accents, turning.
    expect(await auraOf()).toEqual(['butter', 'orchid', 'sage'])
    const [rim, inner] = await Promise.all([aura.boundingBox(), pill.boundingBox()])
    expect(inner!.x - rim!.x).toBeCloseTo(1.5, 0)
    const angle = await auraAngle(aura)
    await expect.poll(() => auraAngle(aura)).not.toBe(angle)

    await pill.click()
    await boardList(page).getByRole('link').filter({ hasText: 'Brotkasten' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('🥖 Brotkasten')
    // Not yet while the Board opens: its skeleton takes the pill along.
    await expect.poll(async () => auraOf().catch(() => [])).toEqual(['butter', 'orchid'])
  })
}

// #285: the add button wears the Board's aura at every width, a 3px rim
// just outside it; reduced motion stands every aura still.
for (const [device, width] of [['phone', 390], ['computer', 1440]] as const) {
  test(`on a ${device} the add button has the Board's 3px aura, and the pill ${device === 'phone' ? 'none' : 'its own'}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page, ALLOWLISTED[9])
    const board = await createBoard(page, 'Keksdose', '🍪')
    await gotoHydrated(page, `/b/${board}`)
    const add = page.getByRole('button', { name: 'Gericht hinzufügen' })
    const aura = add.locator('.aura')
    const known = await colours(page, 'surface')

    expect((await rgb(page, await auraColours(aura))).map(colour => tintedWith(colour, known))).toEqual(['butter', 'orchid', 'sage'])
    const [rim, button] = await Promise.all([aura.boundingBox(), add.boundingBox()])
    expect(button!.x - rim!.x).toBeCloseTo(3, 0)
    expect(rim!.width - button!.width).toBeCloseTo(6, 0)
    const angle = await auraAngle(aura)
    await expect.poll(() => auraAngle(aura)).not.toBe(angle)

    const heading = page.getByRole('heading', { level: 1 })
    if (device === 'phone') await expect(heading).toHaveCSS('background-image', 'none')
    else expect(await auraColours(heading)).toHaveLength(3)
  })
}

test('with reduced motion neither aura turns', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page, ALLOWLISTED[9])
  const board = await createBoard(page, 'Keksdose', '🍪')
  await gotoHydrated(page, `/b/${board}`)

  for (const aura of [page.getByRole('heading', { level: 1 }), page.getByRole('button', { name: 'Gericht hinzufügen' }).locator('.aura')]) {
    expect(await auraColours(aura)).toHaveLength(3)
    const angle = await auraAngle(aura)
    await page.waitForTimeout(500)
    expect(await auraAngle(aura)).toBe(angle)
  }
})

// The pixels of a part of the page that aren't its background (taken from
// `backgroundAt`, a point in it), as a box: where something is drawn.
// `within`: only pixels this near the part's centre count (a round pebble's
// corners show what is behind it).
async function inkBox(page: Page, clip: { x: number, y: number, width: number, height: number }, backgroundAt: { x: number, y: number }, within = Infinity) {
  const png = await page.screenshot({ clip })
  return page.evaluate(async ({ base64, backgroundAt, within }) => {
    const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(base64), char => char.charCodeAt(0))], { type: 'image/png' }))
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0)
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height)
    const at = (x: number, y: number) => [0, 1, 2].map(channel => data[(y * width + x) * 4 + channel]!)
    const background = at(Math.round(backgroundAt.x), Math.round(backgroundAt.y))
    const box = { left: width, top: height, right: -1, bottom: -1 }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2) > within) continue
        if (!at(x, y).some((value, channel) => Math.abs(value - background[channel]!) > 24)) continue
        box.left = Math.min(box.left, x)
        box.top = Math.min(box.top, y)
        box.right = Math.max(box.right, x)
        box.bottom = Math.max(box.bottom, y)
      }
    }
    return { ...box, width: box.right - box.left + 1, height: box.bottom - box.top + 1 }
  }, { base64: png.toString('base64'), backgroundAt, within })
}

// Nothing of the app's cuts the emoji: it is drawn exactly as large as the
// same emoji with nothing around it. What the device's own emoji font cuts
// off a glyph (Windows 11's does, of 🍪 and 🥟) shows the same in both, so
// this can't see it; no layout of ours changes it either.
for (const [device, width] of [['phone', 390], ['computer', 1440]] as const) {
  test(`on a ${device} the switcher's emoji is drawn in full, as large as with nothing around it`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await signIn(page, ALLOWLISTED[9])
    const board = await createBoard(page, 'Keksdose', '🍪')
    await gotoHydrated(page, `/b/${board}`)
    const pebble = switcher(page).locator('[data-emoji-pebble]')
    await expect(pebble).toHaveText('🍪')
    const box = (await pebble.boundingBox())!

    // The same emoji in the same type, with nothing near that could cut it.
    const reference = await pebble.evaluate((el) => {
      const emoji = el.firstElementChild!
      const style = getComputedStyle(emoji)
      const probe = document.body.appendChild(document.createElement('div'))
      Object.assign(probe.style, { position: 'fixed', left: '120px', top: '320px', width: '96px', height: '96px', display: 'grid', placeItems: 'center', zIndex: '9999', background: getComputedStyle(el).backgroundColor, fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, lineHeight: '96px' })
      probe.textContent = emoji.textContent
      const { x, y, width, height } = probe.getBoundingClientRect()
      return { x, y, width, height }
    })
    const drawn = await inkBox(page, box, { x: box.width / 2, y: 2 }, box.width / 2 - 1.5)
    const free = await inkBox(page, reference, { x: 2, y: 2 })

    expect(free.width).toBeGreaterThan(12)
    expect(Math.abs(drawn.width - free.width)).toBeLessThanOrEqual(1)
    expect(Math.abs(drawn.height - free.height)).toBeLessThanOrEqual(1)
    // With room to spare inside the pebble on every side.
    for (const gap of [drawn.left, drawn.top, box.width - 1 - drawn.right, box.height - 1 - drawn.bottom]) expect(gap).toBeGreaterThanOrEqual(3)
  })
}

test('on a computer the switcher pill lifts under the mouse; with reduced motion only its shadow deepens', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await signIn(page, ALLOWLISTED[9])
  const board = await createBoard(page, 'Keksdose', '🍪')
  const atRest = (pill: Locator) => pill.evaluate(el => Promise.all(el.getAnimations().map(a => a.finished)))
  const lift = (pill: Locator) => pill.evaluate((el) => {
    const style = getComputedStyle(el)
    return { up: style.translate === 'none' ? 0 : -Number.parseFloat(style.translate.split(' ')[1] ?? '0'), shadow: style.boxShadow, cursor: style.cursor }
  })

  for (const reducedMotion of ['no-preference', 'reduce'] as const) {
    await page.emulateMedia({ reducedMotion })
    await gotoHydrated(page, `/b/${board}`)
    const pill = switcher(page)
    await page.mouse.move(0, 0)
    const resting = await lift(pill)
    expect(resting.up).toBe(0)
    expect(resting.cursor).toBe('pointer')

    await pill.hover()
    await atRest(pill)
    const hovered = await lift(pill)
    expect(hovered.shadow).not.toBe(resting.shadow)
    if (reducedMotion === 'reduce') expect(hovered.up).toBe(0)
    else expect(hovered.up).toBeGreaterThanOrEqual(2)
  }
})

// The two ways to another Board: the card's menu and the detail's
// "Verschieben nach…".
test('a Dish moved to another Board, from the card’s menu or from its detail, leaves this one and keeps its Cooking History', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, ALLOWLISTED[9])
  const from = await createBoard(page, 'Zuhause', '🏡')
  const to = await createBoard(page, 'WG-Küche', '🍲')
  await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Focaccia', placeholder: 'bread' } })
  const res = await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Linsen-Dal', placeholder: 'bowl' } })
  const { id: dishId } = await res.json()
  await page.request.post(`/api/dishes/${dishId}/cook`)
  await gotoHydrated(page, `/b/${from}`)

  await page.getByRole('button', { name: 'Mehr zu „Focaccia“' }).click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  const menu = page.getByRole('dialog', { name: 'Focaccia' })
  // This Board's other Columns first, then the other Boards.
  await expect(menu.getByText('Dieses Board')).toBeVisible()
  await menu.getByRole('region', { name: 'WG-Küche' }).getByRole('button', { name: 'Ideen' }).click()
  await expect(page.getByRole('link', { name: 'Focaccia' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Linsen-Dal' }).click()
  const detail = page.getByRole('dialog', { name: 'Linsen-Dal' })
  await detail.getByRole('button', { name: 'Verschieben nach…' }).click()
  const picker = page.getByRole('dialog', { name: 'Verschieben nach…' })
  await picker.getByRole('region', { name: 'WG-Küche' }).getByRole('button', { name: 'Diese Woche' }).click()

  await expect(detail).toHaveCount(0)
  await expect(page.getByText('„Linsen-Dal“ ist jetzt in 🍲 WG-Küche · Diese Woche')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Linsen-Dal' })).toHaveCount(0)

  await gotoHydrated(page, `/b/${to}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Focaccia'])
  await expect(titles(page, 'Diese Woche')).toHaveText(['Linsen-Dal'])
  await expect(column(page, 'Diese Woche')).toContainText('1× gekocht')
})

// #129: "Verschieben nach…" into another Board's Gekocht Column records a
// Cooking there, and celebrates as cooking here does (#105): the pill at
// the top names that Board, the confetti bursts from it, and the Gekocht
// toast at the bottom offers "Kommentieren" and "Rückgängig".
function gekochtToast(page: Page) {
  return page.getByRole('status').filter({ hasText: 'Gekocht ✓' })
}

test('a Dish moved into another Board’s Gekocht Column celebrates, naming that Board; undo brings it back where it was', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await signIn(page, ALLOWLISTED[9])
  const from = await createBoard(page, 'Wohnung', '🏠')
  const to = await createBoard(page, 'Familie', '🍲')
  for (const title of ['Gnocchi', 'Shakshuka', 'Pho']) {
    await page.request.post(`/api/boards/${from}/dishes`, { data: { title, placeholder: 'bowl' } })
  }
  await gotoHydrated(page, `/b/${from}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Shakshuka', 'Gnocchi'])

  await page.getByRole('button', { name: 'Mehr zu „Shakshuka“' }).click()
  await page.getByRole('button', { name: 'Verschieben nach…' }).click()
  await page.getByRole('dialog', { name: 'Shakshuka' }).getByRole('region', { name: 'Familie' }).getByRole('button', { name: 'Gekocht' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Gnocchi'])
  await expect(confetti(page)).toHaveCount(14)
  const pill = gekochtPill(page)
  await expect(pill.locator('p')).toHaveText('Gekocht ✓in 🍲 Familie')
  await expect(cheer(pill)).toHaveText(ANY_CHEER)
  // The confetti bursts from the pill's place, at the top in the middle.
  const { width, height } = page.viewportSize()!
  const origin = await confettiOrigin(page)
  expect(Math.abs(origin.x - width / 2)).toBeLessThan(2)
  expect(origin.y).toBeLessThan(height / 8)
  expect((await pill.boundingBox())!.y).toBeLessThan(height / 8)
  const toast = gekochtToast(page)
  await expect(toast.getByRole('button', { name: 'Kommentieren' })).toBeVisible()
  // Screen readers hear the Board from the toast: the pill is decoration.
  await expect(toast).toContainText('Gekocht ✓ in 🍲 Familie')
  await expect(page.getByText(/ist jetzt in/)).toHaveCount(0)

  await toast.getByRole('button', { name: 'Rückgängig' }).click()

  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Shakshuka', 'Gnocchi'])
  await expect(page.getByRole('link', { name: 'Shakshuka' })).toBeFocused()
  await expect(page.getByText('1× gekocht')).toHaveCount(0)
  await gotoHydrated(page, `/b/${from}`)
  await expect(titles(page, 'Ideen')).toHaveText(['Pho', 'Shakshuka', 'Gnocchi'])
  await expect(page.getByText('1× gekocht')).toHaveCount(0)
  await gotoHydrated(page, `/b/${to}`)
  await expect(page.getByRole('link', { name: 'Shakshuka' })).toHaveCount(0)
})

test('a Dish moved into another Board’s Gekocht Column from its detail celebrates over the Board once the detail has closed; "Kommentieren" in the toast opens it on that Board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signIn(page, ALLOWLISTED[9])
  const from = await createBoard(page, 'Studio', '🎨')
  const to = await createBoard(page, 'Oma', '🍰')
  const res = await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Kaiserschmarrn', placeholder: 'bowl' } })
  const { id: dishId } = await res.json()
  await gotoHydrated(page, `/b/${from}/d/${dishId}`)

  const detail = page.getByRole('dialog', { name: 'Kaiserschmarrn' })
  await detail.getByRole('button', { name: 'Verschieben nach…' }).click()
  const picker = page.getByRole('dialog', { name: 'Verschieben nach…' })
  await picker.getByRole('region', { name: 'Oma' }).getByRole('button', { name: 'Gekocht' }).click()

  await expect(detail).toHaveCount(0)
  const pill = gekochtPill(page)
  await expect(pill.locator('p')).toHaveText('Gekocht ✓in 🍰 Oma')
  await expect(confetti(page)).toHaveCount(14)
  // Over the Board: the detail's own pill and toast went with it.
  await expect(pill).toHaveCount(1)
  await expect(page.getByRole('link', { name: 'Kaiserschmarrn' })).toHaveCount(0)

  // The Dish's detail, on the Board it is on now, in its comment field.
  await gekochtToast(page).getByRole('button', { name: 'Kommentieren' }).click()
  const moved = page.getByRole('dialog', { name: 'Kaiserschmarrn' })
  const field = moved.getByRole('textbox', { name: 'Kommentar' })
  await expect(field).toBeFocused()
  await expect(page.locator('h1', { hasText: 'Oma' })).toBeAttached()
  await page.keyboard.type('mit Apfelmus')
  await moved.getByRole('button', { name: 'Senden' }).click()
  await expect(moved.locator('[data-comment]')).toContainText('mit Apfelmus')

  await gotoHydrated(page, `/b/${to}/d/${dishId}`)
  await expect(moved.locator('[data-cooking]')).toHaveCount(1)
  await expect(moved.locator('[data-comment]')).toContainText('mit Apfelmus')
})

// Opening another Board (handoff "Skeleton shimmer"): its chrome shows at
// once, with skeleton cards in its Columns while its Dishes load.
function skeleton(page: Page) {
  return page.locator('[data-board-skeleton]')
}
// Where an element sits in the page's layout and how high it is, leaving out
// transforms such as the cards' rise.
function layoutBox(element: Locator) {
  return element.evaluate((el) => {
    let top = 0
    for (let at = el as HTMLElement | null; at; at = at.offsetParent as HTMLElement | null) top += at.offsetTop
    return { top, height: (el as HTMLElement).offsetHeight }
  })
}
// The animations running in an element and its pseudo-elements, by their
// timing.
function animations(element: Locator) {
  return element.evaluate(el => el.getAnimations({ subtree: true }).map((a) => {
    const timing = a.effect!.getComputedTiming()
    return { duration: timing.duration, iterations: timing.iterations, easing: (a.effect as KeyframeEffect).getKeyframes()[0]?.easing }
  }))
}
// Two Boards with a Dish each, named `fromName` and `toName`: the first one
// open, then switching to the second one, whose request is held until
// `release`.
async function switchingBoards(page: Page, fromName: string, toName: string) {
  const from = await createBoard(page, fromName, '🥗')
  const to = await createBoard(page, toName, '🌙')
  await page.request.post(`/api/boards/${from}/dishes`, { data: { title: 'Bowl', placeholder: 'bowl' } })
  await page.request.post(`/api/boards/${to}/dishes`, { data: { title: 'Ramen', placeholder: 'ramen' } })
  await gotoHydrated(page, `/b/${from}`)
  const release = await holdRequests(page, 'GET', new RegExp(`/api/boards/${to}$`))
  await switcher(page).click()
  await boardList(page).getByRole('link').filter({ hasText: toName }).click()
  return release
}

test('switching Boards shows the new Board’s skeleton at once, shimmering, and its Dishes take the skeleton cards’ place', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await signIn(page, ALLOWLISTED[9])
  const release = await switchingBoards(page, 'Mittags', 'Abends')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌙 Abends')
  await expect(page.getByRole('link', { name: 'Bowl' })).toHaveCount(0)
  await expect(skeleton(page)).toHaveAttribute('aria-busy', 'true')
  // Phones: the first Column's headline, the tabs, and that Column only.
  await expect(page.getByRole('navigation', { name: 'Spalten' }).getByRole('button')).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
  await expect(skeleton(page).getByRole('heading', { level: 2 })).toHaveText(['Ideen'])
  await expect(skeleton(page).getByRole('region')).toHaveCount(1)
  await expectCardShape(skeleton(page).getByRole('region'))
  const card = skeleton(page).locator('[data-skeleton-card]').first()
  await expect(card).toBeVisible()
  expect(await animations(card)).toEqual([{ duration: 1400, iterations: Infinity, easing: 'ease-in-out' }])
  // A DishCard's size: 128px high, an 86px thumb.
  const placeholder = await layoutBox(card)
  expect(placeholder.height).toBe(128)
  expect(await card.locator('[data-thumb]').evaluate(el => (el as HTMLElement).offsetWidth)).toBe(86)

  release()
  const dish = column(page, 'Ideen').locator('li', { has: page.getByRole('link', { name: 'Ramen' }) })
  await expect(dish).toBeVisible()
  await expect(skeleton(page)).toHaveCount(0)
  expect(await layoutBox(dish)).toEqual(placeholder)
})

test('with reduced motion the skeleton is still, at 60% opacity, in every Column side by side', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await signIn(page, ALLOWLISTED[9])
  const release = await switchingBoards(page, 'Brunch', 'Picknick')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🌙 Picknick')
  await expect(skeleton(page).getByRole('region').getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
  await expect(skeleton(page).getByRole('region').locator('[data-column-subtitle]')).toHaveText(['Worauf hast du Lust?', 'Das steht an.', 'Schon geschafft!'])
  await expect(skeleton(page).locator('[data-skeleton-cards]')).toHaveCount(3)
  await expect(skeleton(page).locator('[data-skeleton-cards]').first()).toHaveCSS('opacity', '0.6')
  expect(await animations(skeleton(page))).toEqual([])
  // The lane headers are the Board's, so its Dishes take the cards' place.
  const placeholder = await layoutBox(skeleton(page).locator('[data-skeleton-card]').first())

  release()
  const dish = column(page, 'Ideen').locator('li', { has: page.getByRole('link', { name: 'Ramen' }) })
  await expect(dish).toBeVisible()
  await expect(skeleton(page)).toHaveCount(0)
  expect(await layoutBox(dish)).toEqual(placeholder)
})
