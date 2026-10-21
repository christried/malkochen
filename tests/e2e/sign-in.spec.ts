import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { gotoHydrated } from './hydration'

test('a signed-out visitor is sent to the sign-in screen', async ({ page }) => {
  await gotoHydrated(page, '/')

  await expect(page).toHaveURL('/login')
  await expect(page.getByRole('button', { name: 'Mit Google anmelden' })).toBeVisible()
})

// WCAG relative luminance and contrast ratio of two opaque rgb() colours.
function contrast(a: string, b: string): number {
  const luminance = (rgb: string) => {
    const [r, g, bl] = rgb.match(/\d+(\.\d+)?/g)!.slice(0, 3).map((v) => {
      const c = Number(v) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    }) as [number, number, number]
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

// Each theme by the phone's setting, and each chosen against it (Darstellung
// sets <html data-theme>).
const THEMES = [
  { label: 'light', device: 'light', chosen: null, dark: false },
  { label: 'dark', device: 'dark', chosen: null, dark: true },
  { label: 'Dunkel chosen on a light phone', device: 'light', chosen: 'dark', dark: true },
  { label: 'Hell chosen on a dark phone', device: 'dark', chosen: 'light', dark: false },
] as const

for (const { label, device, chosen, dark } of THEMES) {
  test(`the sign-in screen asks "Was willst du malkochen?" with the app's name highlighted (${label})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: device })
    await gotoHydrated(page, '/login')
    if (chosen)
      await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), chosen)
    await expect(page.locator('main')).toHaveCSS('background-color', dark ? 'rgb(19, 18, 17)' : 'rgb(247, 246, 242)')

    const headline = page.getByRole('heading', { level: 1 })
    await expect(headline).toHaveText('Was willst du malkochen?')
    await expect(page.getByText('Sammle Essen, das du online findest, und plane, was du als Nächstes kochst.')).toBeVisible()
    // The app's name shows once, in the headline: no small wordmark above it.
    const name = page.getByText('malkochen', { exact: true })
    await expect(name).toHaveCount(1)
    await expect(headline.getByText('malkochen', { exact: true })).toBeVisible()

    // The name is coloured and sits on a highlight, and stays readable
    // (WCAG AA, 4.5:1) on the page and on its highlight.
    const look = await name.evaluate((el) => {
      const style = getComputedStyle(el)
      return {
        color: style.color,
        headlineColor: getComputedStyle(el.closest('h1')!).color,
        page: getComputedStyle(el.closest('main')!).backgroundColor,
        highlights: (style.backgroundImage.match(/rgba?\([^)]*\)/g) ?? [])
          .filter(c => !/^rgba\(.*,\s*0\)$/.test(c)),
      }
    })
    expect(look.color).not.toBe(look.headlineColor)
    expect(look.highlights.length).toBeGreaterThan(0)
    for (const background of [look.page, ...look.highlights])
      expect(contrast(look.color, background), `${look.color} on ${background}`).toBeGreaterThanOrEqual(4.5)
  })
}

test('a refused sign-in shows the friendly "Not unlocked" screen', async ({ page }) => {
  await gotoHydrated(page, '/login?error=not_allowed&error_description=Not%20on%20the%20Allowlist')

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bald geht’s los!')
  // Whom to ask is named.
  await expect(page.getByText('Du bist noch nicht für malkochen freigeschaltet. Sag Chris Bescheid, dann kannst du loslegen.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mit einem anderen Konto anmelden' })).toBeVisible()
  await expect(page.getByText('Allowlist')).toHaveCount(0)
})

// The legal pages are on christried.me, outside the app, so anyone can read
// them without signing in.
for (const [screen, path] of [['the sign-in screen', '/login'], ['the "Not unlocked" screen', '/login?error=not_allowed']] as const) {
  test(`${screen} links to Impressum and Datenschutz in its footer, signed out`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await gotoHydrated(page, path)

    const links = page.getByRole('contentinfo').getByRole('link')
    await expect(links).toHaveText(['Impressum', 'Datenschutz'])
    await expect(links.nth(0)).toHaveAttribute('href', 'https://christried.me/imprint.html')
    await expect(links.nth(1)).toHaveAttribute('href', 'https://christried.me/privacy-malkochen.html')
    // Under the screen's last button, and big enough to tap.
    const button = (await page.getByRole('main').getByRole('button').last().boundingBox())!
    for (const link of await links.all()) {
      const box = (await link.boundingBox())!
      expect(box.y).toBeGreaterThanOrEqual(button.y + button.height)
      expect(box.height).toBeGreaterThanOrEqual(44)
    }
  })
}

test('after signing in the app opens "Meine Küche" with its three Columns', async ({ page }) => {
  await signIn(page, ALLOWLISTED[2])
  await gotoHydrated(page, '/')

  await expect(page).toHaveURL(/\/b\/meine-kueche(-\d+)?$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🍲 Meine Küche')
  const columns = page.getByRole('region')
  await expect(columns.getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
})

test('a signed-in user who opens the sign-in screen lands on their Board instead', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/login')

  await expect(page).toHaveURL(/\/b\//)
})
