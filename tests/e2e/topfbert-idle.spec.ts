import type { Browser, Locator } from '@playwright/test'
import { expect, newTab, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { playing } from './clips'
import { gotoHydrated } from './hydration'
import { seedDish } from './seed'
import { stubSourceLookup } from './source-lookup-stub'

// Topfbert idles wherever he stands about (handoff topfbert/layers.json →
// idle): every one on screen on the page's clock, paused off-screen and
// under another modal, still with reduced motion. The Gekocht pill's is in
// cooking.spec.ts, offline.html's in offline.spec.ts.

// A link to a Board that doesn't exist, from a client of its own, so no other
// test shares its misses (invite-links.spec.ts).
async function goneInvite(browser: Browser, options: Parameters<typeof newTab>[1] = {}) {
  const page = await newTab(browser, { extraHTTPHeaders: { 'x-forwarded-for': '2001:db8::e2e:135' }, ...options })
  await gotoHydrated(page, '/invite/gibtsnicht-23456789abcdefghj')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Dieser Link geht nicht mehr.')
  return page
}

// How far into their rounds his layers are, less the page's clock: all 0
// while he keeps it.
function offClock(topfbert: Locator) {
  return topfbert.locator('[data-loop-svg]').evaluate(el => el.getAnimations({ subtree: true })
    .map(a => Math.round(Number(a.currentTime) - Number(document.timeline.currentTime))))
}

test('a link that no longer works: Topfbert oops idles on the page\'s clock, and pauses once scrolled away', async ({ browser }) => {
  const page = await goneInvite(browser)
  const topfbert = page.locator('[data-topfbert-idle]')

  await expect.poll(() => playing(topfbert)).toEqual(['/clips/topfbert-idle-oops.svg'])
  expect(new Set(await offClock(topfbert))).toEqual(new Set([0]))

  // Less than half of him on screen (two thirds above the top): he pauses.
  await topfbert.evaluate((el: HTMLElement) => {
    const { top, height } = el.getBoundingClientRect()
    el.style.translate = `0 ${-(top + height * 2 / 3)}px`
  })
  await expect.poll(() => playing(topfbert)).toEqual([])
  // Back: on the page's clock again, where he would have been.
  await topfbert.evaluate((el: HTMLElement) => (el.style.translate = ''))
  await expect.poll(() => playing(topfbert)).toEqual(['/clips/topfbert-idle-oops.svg'])
  await expect.poll(async () => new Set(await offClock(topfbert))).toEqual(new Set([0]))
})

test('with reduced motion, Topfbert stands still', async ({ browser }) => {
  const page = await goneInvite(browser, { reducedMotion: 'reduce' })
  const topfbert = page.locator('[data-topfbert-idle]')

  await expect(topfbert.locator('img[src="/illustrations/topfbert-oops.svg"]')).toBeVisible()
  await page.waitForTimeout(500)
  expect(await topfbert.locator('[data-loop-svg]').count()).toBe(0)
})

test('a link already on the Board: Topfbert wow idles beside the warning, and stands still under the picker, whose Topfbert idles', async ({ page }) => {
  const short = 'https://www.youtube.com/shorts/idleTopfbert1'
  await signIn(page, ALLOWLISTED[2])
  await seedDish(page, { title: 'Idle-Tofu', sourceLink: short, sourceKind: 'youtube-short' })
  await stubSourceLookup(page, { kind: 'youtube-short', canonicalLink: short, suggestedTitle: 'Idle-Tofu', imageUrl: null, imageTicket: null })
  await gotoHydrated(page, '/')
  await page.getByRole('button', { name: 'Gericht hinzufügen' }).click()
  const sheet = page.getByRole('dialog', { name: 'Gericht hinzufügen' })
  await sheet.getByLabel('Link').fill(short)

  const wow = sheet.locator('[data-duplicate] [data-topfbert-idle]')
  await expect.poll(() => playing(wow)).toEqual(['/clips/topfbert-idle-wow.svg'])

  await sheet.getByRole('button', { name: 'Bild wählen' }).click()
  const picker = page.getByRole('dialog', { name: 'Bild wählen' })
  const happy = picker.locator('[data-topfbert-idle]')
  await expect.poll(() => playing(happy)).toEqual(['/clips/topfbert-idle-happy.svg'])
  expect(new Set(await offClock(happy))).toEqual(new Set([0]))
  // Under it, he's his still: his drawing leaves (off-screen, it would only
  // pause).
  await expect(wow.locator('[data-loop-svg]')).toHaveCount(0)
  await expect(wow.locator('img[src="/illustrations/topfbert-wow.svg"]')).toBeVisible()

  // The picker closed, and he's back in view: he idles again, in step.
  await picker.getByRole('button', { name: 'Schließen' }).click()
  await wow.scrollIntoViewIfNeeded()
  await expect.poll(() => playing(wow)).toEqual(['/clips/topfbert-idle-wow.svg'])
  await expect.poll(async () => new Set(await offClock(wow))).toEqual(new Set([0]))
})
