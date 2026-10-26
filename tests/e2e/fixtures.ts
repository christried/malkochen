import { test as base, expect, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test'
import { SPLASH_SEEN_KEY } from '../../shared/splash'

// What every browser test imports `test` from, in place of Playwright's own.

// Every page in `context` starts as if its tab had seen the splash already,
// so the splash never covers what a test is after (splash.spec.ts is the one
// file without it: testWithSplash).
async function skipSplash(context: BrowserContext) {
  await context.addInitScript(key => sessionStorage.setItem(key, '1'), SPLASH_SEEN_KEY)
}

// What the running test's pages did against the Content Security Policy
// (#192). The policy is enforced (#344): the browser blocks it and logs it.
// A test that causes any fails, which is how the policy is known to fit the
// app, the Offline page's own policy included.
let policyViolations: string[] = []

function watchPolicy(context: BrowserContext) {
  context.on('console', (message) => {
    if (message.text().includes('Content Security Policy')) policyViolations.push(message.text())
  })
}

// For splash.spec.ts: tabs that start with the splash still to come.
export const testWithSplash = base.extend({
  context: async ({ context }, use) => {
    policyViolations = []
    watchPolicy(context)
    await use(context)
    expect(policyViolations, 'Content Security Policy violations').toEqual([])
  },
})

export const test = testWithSplash.extend({
  context: async ({ context }, use) => {
    await skipSplash(context)
    await use(context)
  },
})

// A second person's tab: a fresh context on the test server, past the splash.
export async function newTab(browser: Browser, options: BrowserContextOptions = {}): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, ...options })
  watchPolicy(context)
  await skipSplash(context)
  return context.newPage()
}

export { expect }
