import { createECDH, randomBytes } from 'node:crypto'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { ALLOWLISTED } from '../support/test-auth-env'
import { signIn } from './auth'
import { openUserSettings } from './settings-sheet'

// Push notifications in your settings (#219): one switch per device, off
// until you turn it on there. The browser's side is faked: Playwright's
// browser has no push service, and the tests block service workers. What is
// pushed, to whom, and what a tap opens is covered by tests/api/push.test.ts
// and tests/client/service-worker-push.test.ts. Chien is used by this file
// only.
const CHIEN = ALLOWLISTED[47]

// The browser asks once and then answers `answer`; a subscription the page
// makes lives in localStorage, so it is still there after a reload, like
// the browser's own.
async function fakePushBrowser(page: Page, answer: NotificationPermission) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const subscription = {
    endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${randomBytes(8).toString('hex')}`,
    expirationTime: null,
    keys: { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') },
  }
  await page.addInitScript(({ answer, subscription }) => {
    const SUBSCRIPTION = 'fake-push-subscription'
    const PERMISSION = 'fake-push-permission'
    Object.defineProperty(Notification, 'permission', { configurable: true, get: () => localStorage.getItem(PERMISSION) ?? 'default' })
    Notification.requestPermission = async () => {
      localStorage.setItem(PERMISSION, answer)
      return answer
    }
    const asSubscription = (stored: typeof subscription) => ({
      endpoint: stored.endpoint,
      options: { applicationServerKey: null, userVisibleOnly: true },
      toJSON: () => stored,
      unsubscribe: async () => {
        localStorage.removeItem(SUBSCRIPTION)
        return true
      },
    })
    const pushManager = {
      getSubscription: async () => {
        const stored = localStorage.getItem(SUBSCRIPTION)
        return stored ? asSubscription(JSON.parse(stored)) : null
      },
      subscribe: async () => {
        localStorage.setItem(SUBSCRIPTION, JSON.stringify(subscription))
        return asSubscription(subscription)
      },
    }
    navigator.serviceWorker.getRegistration = async () => ({ pushManager }) as unknown as ServiceWorkerRegistration
  }, { answer, subscription })
  return subscription
}

async function isOnAtServer(page: Page, endpoint: string): Promise<boolean> {
  const res = await page.request.get(`/api/me/push?endpoint=${encodeURIComponent(endpoint)}`)
  return (await res.json() as { on: boolean }).on
}

test.beforeEach(async ({ page }) => {
  await signIn(page, CHIEN)
})

for (const [device, viewport] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 900 }]] as const) {
  test(`on the ${device}, push notifications are off until turned on, and stay on for this device`, async ({ page }) => {
    await page.setViewportSize(viewport)
    const { endpoint } = await fakePushBrowser(page, 'granted')

    let sheet = await openUserSettings(page)
    const push = sheet.getByRole('region', { name: 'Benachrichtigungen' })
    const toggle = push.getByRole('switch', { name: 'Push-Benachrichtigungen' })
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect(toggle).toBeEnabled()

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(await isOnAtServer(page, endpoint)).toBe(true)

    // Back later: still on.
    sheet = await openUserSettings(page)
    await expect(sheet.getByRole('switch', { name: 'Push-Benachrichtigungen' })).toHaveAttribute('aria-checked', 'true')

    await sheet.getByRole('switch', { name: 'Push-Benachrichtigungen' }).click()
    await expect(sheet.getByRole('switch', { name: 'Push-Benachrichtigungen' })).toHaveAttribute('aria-checked', 'false')
    expect(await isOnAtServer(page, endpoint)).toBe(false)
  })
}

test('when the browser blocks notifications, the switch stays off and the sheet says why', async ({ page }) => {
  await fakePushBrowser(page, 'denied')
  const sheet = await openUserSettings(page)
  const toggle = sheet.getByRole('switch', { name: 'Push-Benachrichtigungen' })

  await toggle.click()

  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(toggle).toBeDisabled()
  await expect(sheet.getByText('Dein Browser blockiert Benachrichtigungen von malkochen.', { exact: false })).toBeVisible()
})
