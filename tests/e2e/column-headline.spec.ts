import type { Locator, Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { column, swipe, tab } from './board'
import { gotoHydrated } from './hydration'
import { landingBoardId, resetBoard } from './seed'

// The phone Board's headline (handoff mockup, "Headline parallax"): the
// active Column's name large, with its Column Subtitle in italic below it,
// above the tabs, changing as the Board moves to another Column. Katalin's
// Board is used by this file only.
test.describe.configure({ mode: 'serial' })

const KATALIN = ALLOWLISTED[24]
// A small Android phone.
const PHONE = { width: 360, height: 740 }

function headline(page: Page) {
  return page.locator('[data-column-headline]')
}

// Each Column's title in the headline, as it shows right now: its name,
// subtitle, opacity and sideways drift.
function headlineTitles(page: Page) {
  return headline(page).locator('hgroup').evaluateAll(groups => groups.map((el) => {
    const style = getComputedStyle(el)
    return {
      name: el.querySelector('h2')!.textContent!.trim(),
      subtitle: el.querySelector('p')!.textContent!.trim(),
      opacity: Number(style.opacity),
      translate: style.translate,
      transition: style.transitionDuration,
    }
  }))
}

// Once the headline has come to rest: only this Column's title shows, fully.
async function expectShown(page: Page, name: string, subtitle?: string) {
  await expect.poll(async () => (await headlineTitles(page)).filter(t => t.opacity > 0).map(t => [t.name, t.opacity])).toEqual([[name, 1]])
  if (subtitle !== undefined) expect((await headlineTitles(page)).find(t => t.name === name)!.subtitle).toBe(subtitle)
}

async function renameColumns(page: Page, columns: { name: string, subtitle?: string | null }[]) {
  const board = await (await page.request.get(`/api/boards/${await landingBoardId(page)}`)).json() as { columns: { id: string }[] }
  for (const [index, change] of columns.entries()) {
    const res = await page.request.patch(`/api/columns/${board.columns[index]!.id}`, { data: change })
    expect(res.ok()).toBe(true)
  }
}

// How many lines a heading's or paragraph's text takes.
function lines(element: Locator) {
  return element.evaluate(el => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)))
}

test('a phone shows the active Column’s name large, with its subtitle in italic below, above the tabs', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, KATALIN)
  await resetBoard(page)
  await gotoHydrated(page, '/')

  // One Column title on the page: the active Column's, in the headline.
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Ideen'])
  const title = headline(page).getByRole('heading', { level: 2, name: 'Ideen' })
  const subtitle = headline(page).getByText('Worauf hast du Lust?')
  await expect(title).toHaveCSS('font-size', '54px')
  await expect(title).toHaveCSS('font-family', /Newsreader/)
  await expect(subtitle).toHaveCSS('font-style', 'italic')
  await expectShown(page, 'Ideen', 'Worauf hast du Lust?')

  const [name, sub, tabs] = await Promise.all([title, subtitle, page.getByRole('navigation', { name: 'Spalten' })].map(l => l.boundingBox()))
  expect(name!.y + name!.height).toBeLessThanOrEqual(sub!.y + 1)
  expect(sub!.y + sub!.height).toBeLessThanOrEqual(tabs!.y)
})

test('the title and subtitle change with the Column, drifting across as the Board is swiped', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, KATALIN)
  await resetBoard(page)
  await gotoHydrated(page, '/')

  await tab(page, 'Diese Woche 0').click()
  await expectShown(page, 'Diese Woche', 'Das steht an.')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Diese Woche'])
  // Smoothly: the titles ease into place rather than cut.
  for (const { transition } of await headlineTitles(page)) expect(transition).not.toMatch(/^0s(, 0s)*$/)

  // Halfway across, the title leaving drifts and fades as the next one comes in.
  const board = page.getByTestId('columns')
  const release = await swipe(board, -160, { hold: true })
  const [, leaving, coming] = await headlineTitles(page)
  expect(leaving!.opacity).toBeGreaterThan(0)
  expect(leaving!.opacity).toBeLessThan(1)
  expect(coming!.opacity).toBeGreaterThan(0)
  expect(coming!.opacity).toBeLessThan(1)
  expect(parseFloat(leaving!.translate)).toBeLessThan(0)
  expect(parseFloat(coming!.translate)).toBeGreaterThan(0)
  await release()

  await expectShown(page, 'Gekocht', 'Schon geschafft!')
  await swipe(board, 160)
  await expectShown(page, 'Diese Woche', 'Das steht an.')
})

test('on a 360px phone long names and subtitles shrink and wrap inside the screen', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await signIn(page, KATALIN)
  await renameColumns(page, [
    { name: 'Sonntagsfrühstücksbrunchvorbereitungen', subtitle: 'Für alle, die sonntags lange schlafen.' },
    { name: 'Was wir am Wochenende für Gäste kochen', subtitle: 'Wenn Freunde und Familie vorbeikommen!' },
  ])
  await gotoHydrated(page, '/')

  for (const name of ['Sonntagsfrühstücksbrunchvorbereitungen', 'Was wir am Wochenende für Gäste kochen', 'Gekocht']) {
    await tab(page, name).click()
    await expectShown(page, name)
    const title = headline(page).getByRole('heading', { level: 2, name })
    const subtitle = title.locator('xpath=following-sibling::p')
    for (const part of [title, subtitle]) {
      const box = (await part.boundingBox())!
      expect(box.x, `${name} starts on the screen`).toBeGreaterThanOrEqual(16)
      expect(box.x + box.width, `${name} ends on the screen`).toBeLessThanOrEqual(PHONE.width - 16 + 1)
      expect(await part.evaluate(el => el.scrollWidth <= el.clientWidth), `${name} isn't cut`).toBe(true)
      expect(await lines(part), `${name} takes at most two lines`).toBeLessThanOrEqual(2)
    }
    const size = parseFloat(await title.evaluate(el => getComputedStyle(el).fontSize))
    if (name === 'Gekocht') expect(size).toBe(54)
    else expect(size).toBeGreaterThanOrEqual(32)
  }
  // Nothing makes the page wider than the phone.
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(PHONE.width)
})

test('from 768px there is no headline: each lane has its own title', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 })
  await signIn(page, KATALIN)
  await resetBoard(page)
  await gotoHydrated(page, '/')

  await expect(headline(page)).toBeHidden()
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
  for (const name of ['Ideen', 'Diese Woche', 'Gekocht']) await expect(column(page, name).getByRole('heading', { level: 2 })).toHaveText(name)
})

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('the title cuts to the next Column’s, without drifting', async ({ page }) => {
    await page.setViewportSize(PHONE)
    await signIn(page, KATALIN)
    await resetBoard(page)
    await gotoHydrated(page, '/')

    await tab(page, 'Diese Woche 0').click()
    const titles = await headlineTitles(page)
    expect(titles.map(t => [t.name, t.opacity, t.translate, t.transition])).toEqual([
      ['Ideen', 0, 'none', expect.stringMatching(/^0s(, 0s)*$/)],
      ['Diese Woche', 1, 'none', expect.stringMatching(/^0s(, 0s)*$/)],
      ['Gekocht', 0, 'none', expect.stringMatching(/^0s(, 0s)*$/)],
    ])

    // Mid-swipe, the title stays as it is until the Board moves on.
    const release = await swipe(page.getByTestId('columns'), -160, { hold: true })
    expect((await headlineTitles(page)).map(t => t.opacity)).toEqual([0, 1, 0])
    await release()
    await expectShown(page, 'Gekocht', 'Schon geschafft!')
  })
})
