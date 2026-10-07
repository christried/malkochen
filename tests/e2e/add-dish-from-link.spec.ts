import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { cardAtRest } from './board'
import { expectCardShape } from './card-shape'
import { gotoHydrated } from './hydration'
import { clickAndExpectSaving, dotsMoving, holdRequests, linkField, linkFound, loadingDots, SAGE } from './loading'
import { removeStoredImages, seedDish, storedImage } from './seed'
import { stubImage, stubSourceLookup } from './source-lookup-stub'

// Linus's Board is used by this file only. Source Lookup is stubbed with
// fixtures (tests/e2e/source-lookup-stub.ts).
test.describe.configure({ mode: 'serial' })
test.use({ colorScheme: 'light' })

const TIKTOK = 'https://www.tiktok.com/@veganfood/video/7301234567890123456'
const PORTRAIT = 'https://images.invalid/tiktok-cover.png'
const LANDSCAPE = 'https://images.invalid/pin-736.png'

async function openAddDish(page: Page) {
  await signIn(page, ALLOWLISTED[2])
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  return page.getByRole('dialog', { name: 'Gericht hinzufügen' })
}

function savedBody(page: Page) {
  return page.waitForRequest(r => r.method() === 'POST' && /\/api\/boards\/[^/]+\/dishes$/.test(r.url()))
    .then(r => r.postDataJSON() as Record<string, unknown>)
}

test('a pasted link shows a loading state, then a preview with image, editable title and Creator', async ({ page }) => {
  let answer!: () => void
  await stubSourceLookup(page, {
    kind: 'tiktok',
    canonicalLink: TIKTOK,
    suggestedTitle: 'Crispy Tofu Bowl',
    creator: 'Vegan Food Club',
    imageUrl: PORTRAIT,
    imageTicket: 'fixture-ticket',
  }, new Promise(r => answer = r))
  await stubImage(page, PORTRAIT, 90, 160)
  const sheet = await openAddDish(page)

  await sheet.getByLabel('Link').fill(`${TIKTOK}?is_from_webapp=1`)

  await expect(sheet.getByRole('status')).toHaveText('Ich schau mal nach …')
  await expectCardShape(sheet.locator('[data-lookup="looking"]'))
  await expect(sheet.getByRole('button', { name: 'Speichern' })).toHaveCount(0)
  // The link field shows the lookup under way: loading dots, no check yet.
  const field = linkField(sheet)
  await expect(loadingDots(field)).toBeVisible()
  await expect(linkFound(sheet)).toHaveCount(0)
  answer()

  // Found: a sage border and a check, in place of the dots. The field
  // still shows when it has focus: its border goes to the text colour, the
  // check stays.
  await expect(linkFound(sheet)).toBeVisible()
  await expect(loadingDots(field)).toHaveCount(0)
  const border = field.locator('xpath=../fieldset')
  await sheet.getByLabel('Link').blur()
  await expect(border).toHaveCSS('border-top-color', SAGE)
  await sheet.getByLabel('Link').focus()
  await expect(border).not.toHaveCSS('border-top-color', SAGE)
  await expect(linkFound(sheet)).toBeVisible()
  const preview = sheet.getByRole('img', { name: 'Bild vom Link' })
  await expect(preview).toBeVisible()
  await expect(preview).toHaveAttribute('src', PORTRAIT)
  await expect(sheet.getByLabel('Titel')).toHaveValue('Crispy Tofu Bowl')
  await expect(sheet.locator('[data-creator]')).toHaveText('Veröffentlicht von Vegan Food Club')
  // With an image found, the Placeholder picker stays closed.
  await expect(sheet.getByRole('radiogroup', { name: 'Bild' })).toHaveCount(0)
  await expect(sheet.getByLabel('Board')).toContainText('Meine Küche')

  await sheet.getByLabel('Titel').fill('Knusprige Tofu-Bowl')
  await sheet.getByLabel('Notiz').fill('mit Erdnusssoße')
  const body = savedBody(page)
  const release = await holdRequests(page, 'POST', /\/api\/boards\/[^/]+\/dishes$/)
  const save = sheet.locator('button[type="submit"]')

  // While it saves: the three dots, moving, in place of "Speichern".
  await clickAndExpectSaving(save, 'Speichert …')
  expect(await dotsMoving(save)).toBe(true)
  release()
  expect(await body).toMatchObject({
    title: 'Knusprige Tofu-Bowl',
    note: 'mit Erdnusssoße',
    source: { link: TIKTOK, kind: 'tiktok' },
    creator: 'Vegan Food Club',
    imageUrl: PORTRAIT,
    imageTicket: 'fixture-ticket',
  })
  await expect(sheet).toBeHidden()
  const card = page.getByRole('region', { name: 'Ideen' }).getByRole('article').first()
  await expect(card).toHaveAccessibleName('Knusprige Tofu-Bowl')
  await expect(card.locator('[data-creator]')).toHaveText('Veröffentlicht von Vegan Food Club')
  await expect(card.getByText('TikTok')).toBeVisible()
  // The image wasn't stored (the fixture ticket isn't valid, and the fixture
  // host can't be downloaded from anyway), so the Dish shows its Placeholder,
  // never the third-party link, and the Member is told.
  await expect(card.locator('img[src="/placeholders/bowl-light.svg"]')).toBeVisible()
  await expect(card.locator(`img[src="${PORTRAIT}"]`)).toHaveCount(0)
  await expect(page.locator('[data-toast]')).toHaveText('Das Bild vom Link ließ sich nicht speichern. „Knusprige Tofu-Bowl“ hat jetzt ein Platzhalterbild.')
})

// Long enough to still be typing in (several characters a frame, half a
// second in all) when the test looks.
const LONG_TITLE = 'Ofengemüse mit Kichererbsen, Tahini-Zitronen-Dressing und Granatapfel'

async function findLongTitle(page: Page) {
  await stubSourceLookup(page, { kind: 'tiktok', canonicalLink: TIKTOK, suggestedTitle: LONG_TITLE, imageUrl: PORTRAIT, imageTicket: 'fixture-ticket' })
  await stubImage(page, PORTRAIT, 90, 160)
  const sheet = await openAddDish(page)
  await sheet.getByLabel('Link').fill(TIKTOK)
  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toBeVisible()
  return sheet
}

test('a found title types in after the image blooms', async ({ page }) => {
  const sheet = await findLongTitle(page)
  const title = sheet.getByLabel('Titel')

  // Empty while the image blooms, then a growing start of the title.
  expect(await title.inputValue()).toBe('')
  await expect.poll(async () => {
    const shown = await title.inputValue()
    return shown !== '' && shown !== LONG_TITLE && LONG_TITLE.startsWith(shown)
  }, { intervals: [20] }).toBe(true)
  await expect(title).toHaveValue(LONG_TITLE)
})

test('typing into the title while it types in shows all of it, and keeps what was typed', async ({ page }) => {
  const sheet = await findLongTitle(page)
  const title = sheet.getByLabel('Titel')
  expect(await title.inputValue()).not.toBe(LONG_TITLE)

  await title.pressSequentially(' – lecker')

  expect(await title.inputValue()).toBe(`${LONG_TITLE} – lecker`)
  const body = savedBody(page)
  await sheet.getByRole('button', { name: 'Speichern' }).click()
  expect(await body).toMatchObject({ title: `${LONG_TITLE} – lecker` })
})

test('saving while the title types in saves all of it', async ({ page }) => {
  const sheet = await findLongTitle(page)
  expect(await sheet.getByLabel('Titel').inputValue()).not.toBe(LONG_TITLE)

  const body = savedBody(page)
  await sheet.getByRole('button', { name: 'Speichern' }).click()

  expect(await body).toMatchObject({ title: LONG_TITLE })
  await expect(page.getByRole('region', { name: 'Ideen' }).getByRole('article').first()).toHaveAccessibleName(LONG_TITLE)
})

test('image only (a Pin whose page failed): a friendly prompt asks for the title, which is required', async ({ page }) => {
  const pin = 'https://www.pinterest.com/pin/123456789/'
  await stubSourceLookup(page, { kind: 'pinterest-pin', canonicalLink: pin, suggestedTitle: '', imageUrl: LANDSCAPE, imageTicket: 'fixture-ticket' })
  await stubImage(page, LANDSCAPE, 160, 90)
  const sheet = await openAddDish(page)

  await sheet.getByLabel('Link').fill(pin)

  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toBeVisible()
  const title = sheet.getByLabel('Titel')
  await expect(title).toHaveValue('')
  await expect(title).toHaveAttribute('placeholder', 'Titel eingeben')
  await expect(title).toHaveAccessibleDescription('Zu diesem Link gibt es keinen Titel. Wie heißt das Gericht?')
  // No Creator found: no empty line for one.
  await expect(sheet.locator('[data-creator]')).toHaveCount(0)
  const save = sheet.getByRole('button', { name: 'Speichern' })
  await expect(save).toBeDisabled()
  await title.fill('Zucchini-Lasagne')
  await expect(save).toBeEnabled()

  // Changing the image opens the Placeholder picker; the pick replaces it.
  await sheet.getByRole('button', { name: 'Bild ändern' }).click()
  await page.getByRole('dialog', { name: 'Bild wählen' }).getByRole('radio', { name: 'Pasta' }).click()
  await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toHaveCount(0)
  await expect(sheet.getByRole('radiogroup', { name: 'Bild' }).getByRole('radio', { name: 'Pasta' })).toHaveAttribute('aria-checked', 'true')
  await expect(sheet.getByRole('button', { name: 'Bild vom Link nehmen' })).toBeVisible()

  const body = savedBody(page)
  await save.click()
  expect(await body).toMatchObject({ placeholder: 'pasta', imageUrl: null, imageTicket: null, source: { link: pin, kind: 'pinterest-pin' } })
  const card = page.getByRole('article', { name: 'Zucchini-Lasagne' })
  // A Placeholder the Member chose is no failure: no notice.
  await expect(card).toBeVisible()
  await expect(page.locator('[data-toast]')).toHaveCount(0)
  await expect(card.getByText('Pinterest')).toBeVisible()
  await expect(card.locator('img[src="/placeholders/pasta-light.svg"]')).toBeVisible()
  expect((await body).creator).toBeNull()
  await expect(card.locator('[data-creator]')).toHaveCount(0)
})

for (const [name, kind, link, suggestedTitle, creator] of [
  ['Instagram with a caption', 'instagram-reel', 'https://www.instagram.com/reel/C0WUh-tqkxU/', 'Easy Overnight Bread Rolls', 'vegan_govegan'],
  ['A Pin with a title on its page', 'pinterest-pin', 'https://www.pinterest.com/pin/85779567902561995/', 'Crispy Baked Tofu with Italian Herbs', 'Minimalist Baker'],
] as const) {
  test(`${name}: its title and Creator fill in, and no title is asked for`, async ({ page }) => {
    await stubSourceLookup(page, { kind, canonicalLink: link, suggestedTitle, creator, imageUrl: PORTRAIT, imageTicket: 'fixture-ticket' })
    await stubImage(page, PORTRAIT, 90, 160)
    const sheet = await openAddDish(page)

    await sheet.getByLabel('Link').fill(link)

    await expect(sheet.getByRole('img', { name: 'Bild vom Link' })).toBeVisible()
    const title = sheet.getByLabel('Titel')
    await expect(title).toHaveValue(suggestedTitle)
    await expect(title).not.toHaveAttribute('placeholder', 'Titel eingeben')
    await expect(title).not.toHaveAttribute('aria-describedby')
    await expect(sheet.getByText('Zu diesem Link gibt es keinen Titel. Wie heißt das Gericht?')).toHaveCount(0)
    await expect(sheet.locator('[data-creator]')).toHaveText(`Veröffentlicht von ${creator}`)
    await expect(sheet.getByRole('button', { name: 'Speichern' })).toBeEnabled()
  })
}

test('nothing found: the Placeholder picker opens by itself and the title is required', async ({ page }) => {
  const blog = 'https://kochblog.example/rezept/rote-linsen-suppe'
  await stubSourceLookup(page, { kind: 'other', canonicalLink: blog, suggestedTitle: '', imageUrl: null, imageTicket: null })
  const sheet = await openAddDish(page)

  await sheet.getByLabel('Link').fill(blog)

  await expect(sheet.getByText('Kein Bild gefunden. Such dir eins aus!')).toBeVisible()
  const picker = sheet.getByRole('radiogroup', { name: 'Bild' })
  await expect(picker.getByRole('radio')).toHaveCount(8)
  // Without a title yet, the link's words name the dish.
  await expect(picker.getByRole('radio', { name: 'Eintopf' })).toHaveAttribute('aria-checked', 'true')
  const save = sheet.getByRole('button', { name: 'Speichern' })
  await expect(save).toBeDisabled()

  await picker.getByRole('radio', { name: 'Ramen' }).click()
  await sheet.getByLabel('Titel').fill('Linsen-Dal')
  const body = savedBody(page)
  await save.click()

  expect(await body).toMatchObject({ placeholder: 'ramen', imageUrl: null, source: { link: blog, kind: 'other' } })
  const card = page.getByRole('article', { name: 'Linsen-Dal' })
  await expect(card.getByText('Web')).toBeVisible()
  await expect(card.locator('img[src="/placeholders/ramen-light.svg"]')).toBeVisible()
})

test('lookup failed: the Dish can still be saved with a Placeholder and a typed title', async ({ page }) => {
  const short = 'https://www.youtube.com/shorts/aBcDeFgHiJk'
  await stubSourceLookup(page, 'fail')
  const sheet = await openAddDish(page)

  await sheet.getByLabel('Link').fill(short)

  await expect(sheet.getByRole('status')).toContainText('Das Nachschauen hat nicht geklappt')
  await expectCardShape(sheet.locator('[data-lookup="failed"]'))
  // Nothing recognised: neither dots nor the check stay in the link field.
  await expect(loadingDots(linkField(sheet))).toHaveCount(0)
  await expect(linkFound(sheet)).toHaveCount(0)
  await expect(sheet.getByRole('radiogroup', { name: 'Bild' })).toBeVisible()
  await sheet.getByLabel('Titel').fill('Gochujang-Nudeln')
  await sheet.getByRole('radiogroup', { name: 'Bild' }).getByRole('radio', { name: 'Ramen' }).click()
  await sheet.getByRole('button', { name: 'Speichern' }).click()

  // The server still reads the Source kind from the link.
  const card = page.getByRole('article', { name: 'Gochujang-Nudeln' })
  await expect(card.getByText('YouTube')).toBeVisible()
  await expect(card.locator('img[src="/placeholders/ramen-light.svg"]')).toBeVisible()
})

test('a link already on the Board warns, naming the Dish and its Column; "Trotzdem speichern" adds it again', async ({ page }) => {
  const short = 'https://www.youtube.com/shorts/dupWarnTofu1'
  await signIn(page, ALLOWLISTED[2])
  await seedDish(page, { title: 'Crispy Tofu', sourceLink: short, sourceKind: 'youtube-short' })
  await stubSourceLookup(page, { kind: 'youtube-short', canonicalLink: short, suggestedTitle: 'Crispy Tofu', imageUrl: null, imageTicket: null })
  const sheet = await openAddDish(page)

  // Another form of the same link.
  await sheet.getByLabel('Link').fill(`${short}?feature=share`)

  await expect(sheet.getByRole('alert')).toContainText('Schon auf dem Board: „Crispy Tofu“ in Ideen')
  await expectCardShape(sheet.locator('[data-duplicate]'))
  await expect(sheet.getByRole('button', { name: 'Speichern', exact: true })).toHaveCount(0)
  const body = savedBody(page)
  await sheet.getByRole('button', { name: 'Trotzdem speichern' }).click()

  expect(await body).toMatchObject({ title: 'Crispy Tofu', source: { link: short } })
  await expect(sheet).toBeHidden()
  await expect(page.getByRole('region', { name: 'Ideen' }).getByRole('article', { name: 'Crispy Tofu' })).toHaveCount(2)
})

test('"Öffnen" opens the detail of the Dish already on the Board', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const blog = 'https://kochblog.example/rezept/tofu-scramble'
  await signIn(page, ALLOWLISTED[2])
  await seedDish(page, { title: 'Tofu-Scramble', sourceLink: blog, sourceKind: 'blog', column: 1 })
  await stubSourceLookup(page, { kind: 'blog', canonicalLink: blog, suggestedTitle: 'Tofu Scramble', imageUrl: null, imageTicket: null })
  const sheet = await openAddDish(page)

  await sheet.getByLabel('Link').fill(`${blog}?utm_source=pinterest`)
  await expect(sheet.getByRole('alert')).toContainText('Schon auf dem Board: „Tofu-Scramble“ in Diese Woche')
  await sheet.getByRole('button', { name: 'Öffnen' }).click()

  await expect(sheet).toBeHidden()
  const detail = page.getByRole('dialog', { name: 'Tofu-Scramble' })
  await expect(detail).toBeVisible()
  await expect(detail.getByText('Diese Woche')).toBeVisible()
  // Closing it leaves the Board on the Dish's Column (phones show one at a time).
  await detail.getByRole('button', { name: 'Schließen' }).click()
  await expect(detail).toBeHidden()
  await expect(page.getByRole('button', { name: /^Diese Woche/ })).toHaveAttribute('aria-pressed', 'true')
  // Nothing was saved.
  await expect(page.getByRole('article', { name: 'Tofu Scramble' })).toHaveCount(0)
})

test.afterAll(removeStoredImages)

test('portrait and landscape images both fill the card\'s image', async ({ page }) => {
  await signIn(page, ALLOWLISTED[2])
  const portrait = await storedImage(90, 160)
  const landscape = await storedImage(160, 90)
  await seedDish(page, { title: 'Hochkant', imageUrl: portrait, sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await seedDish(page, { title: 'Querformat', imageUrl: landscape, sourceLink: 'https://kochblog.example/a', sourceKind: 'blog' })
  await gotoHydrated(page, '/')

  for (const [name, src, badge] of [['Hochkant', portrait, 'TikTok'], ['Querformat', landscape, 'Web']] as const) {
    const card = page.getByRole('article', { name })
    const image = card.locator('[data-dish-image]')
    await expect(image).toHaveAttribute('src', src)
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0)
    await cardAtRest(card)
    const [box, frame] = [await image.boundingBox(), await image.locator('..').boundingBox()]
    expect(box).toEqual(frame)
    expect(await image.evaluate(img => getComputedStyle(img).objectFit)).toBe('cover')
    await expect(card.getByText(badge)).toBeVisible()
  }
})

test('a stored image that fails to load falls back to the Placeholder', async ({ page }) => {
  await signIn(page, ALLOWLISTED[2])
  await seedDish(page, { title: 'Verschwunden', imageUrl: '/images/dishes/00000000-0000-4000-8000-000000000000.png', sourceLink: TIKTOK, sourceKind: 'tiktok' })
  await gotoHydrated(page, '/')

  const card = page.getByRole('article', { name: 'Verschwunden' })
  await expect(card.locator('img[src="/placeholders/bowl-light.svg"]')).toBeVisible()
  await expect(card.locator('[data-dish-image]')).toHaveCount(0)
})

test('every Source kind gets its badge', async ({ page }) => {
  await signIn(page, ALLOWLISTED[2])
  const badges = [
    ['Reel', 'instagram-reel', 'https://www.instagram.com/reel/C1a2b3c4d5e/', 'Instagram'],
    ['Post', 'instagram-post', 'https://www.instagram.com/p/C1a2b3c4d5e/', 'Instagram'],
    ['Short', 'youtube-short', 'https://www.youtube.com/shorts/aBcDeFgHiJk', 'YouTube'],
    ['Pin', 'pinterest-pin', 'https://www.pinterest.com/pin/123/', 'Pinterest'],
    ['Video', 'tiktok', TIKTOK, 'TikTok'],
    ['Blog', 'blog', 'https://kochblog.example/b', 'Web'],
    ['Seite', 'other', 'https://example.org/c', 'Web'],
  ] as const
  for (const [title, sourceKind, sourceLink] of badges) {
    await seedDish(page, { title: `Badge ${title}`, sourceLink, sourceKind })
  }
  await gotoHydrated(page, '/')

  for (const [title, , , badge] of badges) {
    await expect(page.getByRole('article', { name: `Badge ${title}` }).locator('[data-source-badge]')).toHaveText(badge)
  }
})

// Where each card's badge sits against its thumbnail, and how wide its
// Source's name shows.
async function badgesOnCards(page: Page) {
  return page.locator('article[aria-label^="Badge "]').evaluateAll(cards => cards.map((card) => {
    const badge = card.querySelector('[data-source-badge]')!
    const thumb = badge.parentElement!.getBoundingClientRect()
    const box = badge.getBoundingClientRect()
    const name = badge.querySelector('[data-source-name]')!.getBoundingClientRect()
    return {
      title: card.getAttribute('aria-label'),
      name: badge.textContent?.trim(),
      inside: box.left >= thumb.left && box.right <= thumb.right && box.top >= thumb.top && box.bottom <= thumb.bottom,
      nameWidth: name.width,
    }
  }))
}

test('desktop cards show only the badge\'s dot, inside the thumbnail; tablet cards the whole badge', async ({ page }) => {
  await signIn(page, ALLOWLISTED[2])
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoHydrated(page, '/')
  await expect(page.getByRole('article', { name: 'Badge Reel' })).toBeVisible()
  const desktop = await badgesOnCards(page)
  expect(desktop).toHaveLength(7)
  for (const badge of desktop) {
    // The name stays there for screen readers, out of sight.
    expect(badge, badge.title!).toMatchObject({ inside: true })
    expect(badge.name, badge.title!).toMatch(/^(Instagram|YouTube|Pinterest|TikTok|Web)$/)
    expect(badge.nameWidth, badge.title!).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 1000, height: 900 })
  const tablet = await badgesOnCards(page)
  expect(tablet).toHaveLength(7)
  for (const badge of tablet) {
    expect(badge.nameWidth, badge.title!).toBeGreaterThan(10)
  }
})
