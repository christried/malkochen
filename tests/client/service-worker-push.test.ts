import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { expect, test, vi } from 'vitest'

// The service worker's part in push notifications (#219, public/sw.js): it
// shows what the server pushed as the Board's one notification, and a tap
// opens the Dish or Board it is about, in the app window that is open or a
// new one. Run here with the browser's service worker scope faked.

const ORIGIN = 'https://malkochen.example'
const SOURCE = readFileSync('public/sw.js', 'utf8')

interface FakeWindow {
  url: string
  focus: ReturnType<typeof vi.fn>
  postMessage: ReturnType<typeof vi.fn>
}

function serviceWorker({ windows = [] as FakeWindow[] } = {}) {
  const listeners = new Map<string, (event: unknown) => void>()
  const shown: { title: string, options: Record<string, unknown> }[] = []
  const opened: string[] = []
  const self = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener),
    registration: {
      showNotification: async (title: string, options: Record<string, unknown>) => {
        shown.push({ title, options })
      },
    },
    clients: {
      matchAll: async () => windows,
      openWindow: async (url: string) => {
        opened.push(url)
        return null
      },
    },
  }
  runInNewContext(SOURCE, { self, caches: {}, fetch, URL, Response, Promise, console })

  // Dispatches an event the way the browser does, and waits for what it
  // asked to be waited for.
  async function dispatch(type: string, event: Record<string, unknown>) {
    const waits: Promise<unknown>[] = []
    listeners.get(type)!({ ...event, waitUntil: (p: Promise<unknown>) => waits.push(p) })
    await Promise.all(waits)
  }

  return {
    shown,
    opened,
    push: (message: unknown) => dispatch('push', { data: { json: () => message } }),
    tap: (data: unknown) => {
      const close = vi.fn()
      return dispatch('notificationclick', { notification: { data, close } }).then(() => close)
    },
  }
}

const window = (url: string): FakeWindow => ({ url, focus: vi.fn(async () => undefined), postMessage: vi.fn() })

const MESSAGE = {
  title: 'Von Chris in Kochclub',
  body: 'Omas Linsensuppe von Mara auf TikTok',
  tag: 'board-42',
  url: '/b/kochclub/omas-linsensuppe-3f9k',
  image: 'https://images.example/omas-linsensuppe.jpg',
}

test('a push shows the Board\'s notification, replacing the one before it and alerting again', async () => {
  const sw = serviceWorker()

  await sw.push(MESSAGE)

  expect(sw.shown).toEqual([{
    title: MESSAGE.title,
    options: expect.objectContaining({
      body: MESSAGE.body,
      tag: 'board-42',
      renotify: true,
      data: { url: MESSAGE.url },
    }),
  }])
})

test('the Dish\'s image is the icon, and the malkochen mark the badge', async () => {
  const sw = serviceWorker()

  await sw.push(MESSAGE)

  expect(sw.shown[0]!.options).toMatchObject({ icon: MESSAGE.image, badge: '/icons/badge-96.png' })
})

test('without a picture (a Placeholder Image), the app icon shows, with the mark as badge', async () => {
  const sw = serviceWorker()

  const { image: _, ...withoutPicture } = MESSAGE
  await sw.push(withoutPicture)

  expect(sw.shown[0]!.options).toMatchObject({ icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' })
})

test('a push that isn\'t one of the app\'s shows nothing', async () => {
  const sw = serviceWorker()
  await sw.push(null)
  await sw.push({ title: 42 })
  expect(sw.shown).toEqual([])
})

test('without an app window open, a tap opens the Dish or Board in a new one', async () => {
  const sw = serviceWorker()

  const close = await sw.tap({ url: '/b/kochclub/omas-linsensuppe-3f9k' })

  expect(close).toHaveBeenCalled()
  expect(sw.opened).toEqual(['/b/kochclub/omas-linsensuppe-3f9k'])
})

test('with an app window open, a tap focuses it and has it open the Dish or Board', async () => {
  const open = window(`${ORIGIN}/b/anderes-board`)
  const sw = serviceWorker({ windows: [window('https://elsewhere.example/'), open] })

  await sw.tap({ url: '/b/kochclub' })

  expect(open.focus).toHaveBeenCalled()
  expect(open.postMessage).toHaveBeenCalledWith({ type: 'open', url: '/b/kochclub' })
  expect(sw.opened).toEqual([])
})

test('a tap about Comments or Votes opens the Dish at its Verlauf (#352)', async () => {
  const open = window(`${ORIGIN}/b/kochclub`)
  const sw = serviceWorker({ windows: [open] })
  await sw.tap({ url: '/b/kochclub/linsen-dal-3f9k#verlauf' })
  expect(open.postMessage).toHaveBeenCalledWith({ type: 'open', url: '/b/kochclub/linsen-dal-3f9k#verlauf' })

  const closed = serviceWorker()
  await closed.tap({ url: '/b/kochclub/linsen-dal-3f9k#verlauf' })
  expect(closed.opened).toEqual(['/b/kochclub/linsen-dal-3f9k#verlauf'])
})

test('a tap never leaves the app: an address elsewhere opens the app\'s start', async () => {
  const sw = serviceWorker()
  await sw.tap({ url: 'https://evil.example/' })
  await sw.tap({ url: '//evil.example/' })
  await sw.tap(undefined)
  expect(sw.opened).toEqual(['/', '/', '/'])
})
