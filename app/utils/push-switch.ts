// The push notifications switch in your settings (#219): one global switch,
// per device. Off until you turn it on on that device; turning it on asks
// the browser for permission, subscribes the device with the app's VAPID
// public key and has the server keep the subscription; turning it off has
// the server forget it and unsubscribes. The browser and the server are
// passed in (composables/usePushNotifications.ts gives the real ones).

// 'blocked': the browser refuses notifications for the app, so it can only
// be turned on in the browser's own settings. 'unsupported': this browser
// gets no push notifications at all.
export type PushState = 'on' | 'off' | 'blocked' | 'unsupported'

// A device's push subscription, as the browser keeps it.
export interface DeviceSubscription {
  endpoint: string
  // The app key it was made with (base64url), if the browser tells.
  key: string | null
  // What the server keeps (PUT /api/me/push).
  toJSON: () => unknown
  unsubscribe: () => Promise<boolean>
}

export interface PushDevice {
  // Null when the browser has no push notifications.
  permission: () => NotificationPermission | null
  requestPermission: () => Promise<NotificationPermission>
  subscription: () => Promise<DeviceSubscription | null>
  subscribe: (key: string) => Promise<DeviceSubscription>
}

export interface PushApi {
  isOn: (endpoint: string) => Promise<boolean>
  turnOn: (subscription: unknown) => Promise<void>
  turnOff: (endpoint: string) => Promise<void>
}

export interface PushSwitch {
  state: () => Promise<PushState>
  // Each answers the state it left the switch in; rejects if the device or
  // the server failed.
  turnOn: () => Promise<PushState>
  turnOff: () => Promise<PushState>
}

export function createPushSwitch(device: PushDevice, api: PushApi, key: string): PushSwitch {
  // The device's subscription with the app's key: the one it has, or a new
  // one (one made with a key the app no longer has is useless).
  async function subscription(): Promise<{ subscription: DeviceSubscription, isNew: boolean }> {
    const existing = await device.subscription()
    if (existing && (existing.key === null || existing.key === key)) return { subscription: existing, isNew: false }
    await existing?.unsubscribe()
    return { subscription: await device.subscribe(key), isNew: true }
  }

  return {
    async state() {
      const permission = device.permission()
      if (permission === null) return 'unsupported'
      if (permission === 'denied') return 'blocked'
      if (permission !== 'granted') return 'off'
      const existing = await device.subscription()
      return existing && await api.isOn(existing.endpoint) ? 'on' : 'off'
    },

    async turnOn() {
      if (device.permission() === null) return 'unsupported'
      const permission = await device.requestPermission()
      if (permission === 'denied') return 'blocked'
      if (permission !== 'granted') return 'off'
      const { subscription: made, isNew } = await subscription()
      try {
        await api.turnOn(made.toJSON())
      }
      catch (err) {
        if (isNew) await made.unsubscribe().catch(() => false)
        throw err
      }
      return 'on'
    },

    async turnOff() {
      const existing = await device.subscription()
      if (existing) {
        await api.turnOff(existing.endpoint)
        await existing.unsubscribe()
      }
      return 'off'
    },
  }
}
