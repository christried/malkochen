import { test as base, type Browser, type BrowserContext, type BrowserContextOptions, type Page } from '@playwright/test'
import { SPLASH_SEEN_KEY } from '../../shared/splash'

// What every browser test imports `test` from, in place of Playwright's own.

// Every page in `context` starts as if its tab had seen the splash already,
// so the splash never covers what a test is after (splash.spec.ts is the one
// file without it).
async function skipSplash(context: BrowserContext) {
  await context.addInitScript(key => sessionStorage.setItem(key, '1'), SPLASH_SEEN_KEY)
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await skipSplash(context)
    await use(context)
  },
})

// A second person's tab: a fresh context on the test server, past the splash.
export async function newTab(browser: Browser, options: BrowserContextOptions = {}): Promise<Page> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, ...options })
  await skipSplash(context)
  return context.newPage()
}

export { expect } from '@playwright/test'
