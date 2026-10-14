import { createPushSwitch, type DeviceSubscription, type PushApi, type PushDevice, type PushState, type PushSwitch } from '~/utils/push-switch'

// Typed as plain strings: Nitro's route typing runs too deep here.
const PUSH: string = '/api/me/push'

// This browser, for the switch: its notification permission and the push
// subscription of the app's service worker (public/sw.js), which shows the
// notifications. Without a service worker registered yet, there is nothing
// to subscribe.
function browserDevice(): PushDevice {
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  const registration = () => navigator.serviceWorker.getRegistration()
  const asDevice = (subscription: PushSubscription): DeviceSubscription => {
    const key = subscription.options.applicationServerKey
    return {
      endpoint: subscription.endpoint,
      key: key ? base64url(key) : null,
      toJSON: () => subscription.toJSON(),
      unsubscribe: () => subscription.unsubscribe(),
    }
  }
  return {
    permission: () => supported ? Notification.permission : null,
    requestPermission: () => Notification.requestPermission(),
    subscription: async () => {
      const subscription = await (await registration())?.pushManager.getSubscription()
      return subscription ? asDevice(subscription) : null
    },
    subscribe: async (key) => {
      const found = await registration()
      if (!found) throw new Error('No service worker registered')
      return asDevice(await found.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }))
    },
  }
}

function base64url(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}

const serverApi: PushApi = {
  isOn: async endpoint => (await $fetch<{ on: boolean }>(PUSH, { query: { endpoint } })).on,
  turnOn: async (subscription) => {
    await $fetch(PUSH, { method: 'PUT', body: subscription as Record<string, unknown> })
  },
  turnOff: async (endpoint) => {
    await $fetch(PUSH, { method: 'DELETE', body: { endpoint } })
  },
}

let shared: PushSwitch | null = null

// The switch for this device, or null when the server sends no push
// notifications (no VAPID keys) or during server rendering.
function pushSwitch(key: string): PushSwitch | null {
  if (!key || import.meta.server) return null
  return shared ??= createPushSwitch(browserDevice(), serverApi, key)
}

// Push notifications in your settings (#219): whether they are offered at
// all, this device's state (null until known), and turning them on or off.
// `failed`: the last turn didn't work out.
export function usePushNotifications() {
  const key = useRuntimeConfig().public.vapidPublicKey
  const offered = Boolean(key)
  const state = ref<PushState | null>(null)
  const busy = ref(false)
  const failed = ref(false)

  async function refresh() {
    const device = pushSwitch(key)
    if (!device) return
    failed.value = false
    state.value = await device.state().catch(() => 'off' as const)
  }

  async function turn(on: boolean) {
    const device = pushSwitch(key)
    if (!device || busy.value) return
    busy.value = true
    failed.value = false
    try {
      state.value = await (on ? device.turnOn() : device.turnOff())
    }
    catch {
      failed.value = true
    }
    finally {
      busy.value = false
    }
  }

  return { offered, state, busy, failed, refresh, turn }
}

// Signing out turns them off for this device, so it gets nothing of the
// user's any more. Never rejects, and never waits long: signing out goes on.
export async function turnOffPushOnSignOut(key: string): Promise<void> {
  const device = pushSwitch(key)
  if (!device) return
  await Promise.race([device.turnOff().catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))])
}
