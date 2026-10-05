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

for (const colorScheme of ['light', 'dark'] as const) {
  test(`the sign-in screen asks "Was willst du malkochen?" with the app's name highlighted (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme })
    await gotoHydrated(page, '/login')

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
          .filter(c => !/,\s*0\)$/.test(c)),
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

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Gleich geht’s los!')
  await expect(page.getByText('Du bist noch nicht für malkochen freigeschaltet.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mit einem anderen Konto anmelden' })).toBeVisible()
  await expect(page.getByText('Allowlist')).toHaveCount(0)
})

test('after signing in the app opens "Meine Küche" with its three Columns', async ({ page }) => {
  await signIn(page, ALLOWLISTED[2])
  await gotoHydrated(page, '/')

  await expect(page).toHaveURL(/\/b\/[0-9a-f-]{36}$/)
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('🍲 Meine Küche')
  const columns = page.getByRole('region')
  await expect(columns.getByRole('heading', { level: 2 })).toHaveText(['Ideen', 'Diese Woche', 'Gekocht'])
})

test('a signed-in user who opens the sign-in screen lands on their Board instead', async ({ page }) => {
  await signIn(page)
  await gotoHydrated(page, '/login')

  await expect(page).toHaveURL(/\/b\//)
})
