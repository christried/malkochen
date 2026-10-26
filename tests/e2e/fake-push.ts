import { createECDH, randomBytes } from 'node:crypto'
import type { Page } from '@playwright/test'

// The browser asks once and then answers `answer`; a subscription the page
// makes lives in localStorage, so it is still there after a reload, like
// the browser's own.
export async function fakePushBrowser(page: Page, answer: NotificationPermission) {
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
