import { expect, test } from 'vitest'
import { createPushSwitch, type DeviceSubscription, type PushApi, type PushDevice } from '../../app/utils/push-switch'

// The push notifications switch in your settings (#219): on for a device
// once you turned it on there, off by default, blocked when the browser
// refuses notifications. Here with the browser and the server faked.

const KEY = 'app-key'

interface FakeDevice extends PushDevice {
  answer: NotificationPermission
  current: (DeviceSubscription & { unsubscribed: boolean }) | null
  subscribed: number
}

function fakeDevice(permission: NotificationPermission | null = 'default', answer: NotificationPermission = 'granted'): FakeDevice {
  let shown = permission
  const device: FakeDevice = {
    answer,
    current: null,
    subscribed: 0,
    permission: () => shown,
    requestPermission: async () => (shown = device.answer),
    subscription: async () => device.current,
    subscribe: async (key) => {
      device.subscribed++
      const sub = {
        endpoint: `https://push.example/${device.subscribed}`,
        key,
        unsubscribed: false,
        toJSON: () => ({ endpoint: sub.endpoint, keys: { p256dh: 'p', auth: 'a' } }),
        unsubscribe: async () => {
          sub.unsubscribed = true
          device.current = null
          return true
        },
      }
      device.current = sub
      return sub
    },
  }
  return device
}

function fakeApi(): PushApi & { stored: Set<string> } {
  const stored = new Set<string>()
  return {
    stored,
    isOn: async endpoint => stored.has(endpoint),
    turnOn: async (subscription) => {
      stored.add((subscription as { endpoint: string }).endpoint)
    },
    turnOff: async (endpoint) => {
      stored.delete(endpoint)
    },
  }
}

test('off until it is turned on', async () => {
  expect(await createPushSwitch(fakeDevice(), fakeApi(), KEY).state()).toBe('off')
  expect(await createPushSwitch(fakeDevice('granted'), fakeApi(), KEY).state()).toBe('off')
})

test('turned on, the browser is asked, the device subscribes with the app\'s key, and the server keeps it', async () => {
  const device = fakeDevice()
  const api = fakeApi()
  const push = createPushSwitch(device, api, KEY)

  expect(await push.turnOn()).toBe('on')

  expect(device.current).toMatchObject({ key: KEY })
  expect([...api.stored]).toEqual([device.current!.endpoint])
  expect(await push.state()).toBe('on')
})

test('turned off, the server forgets the device and it unsubscribes', async () => {
  const device = fakeDevice()
  const api = fakeApi()
  const push = createPushSwitch(device, api, KEY)
  await push.turnOn()
  const subscription = device.current!

  expect(await push.turnOff()).toBe('off')

  expect(api.stored.size).toBe(0)
  expect(subscription.unsubscribed).toBe(true)
  expect(await push.state()).toBe('off')
})

test('a device that is subscribed but not on for this user (someone else turned it on, or it expired) shows off, and turning it on keeps its subscription', async () => {
  const device = fakeDevice()
  await createPushSwitch(device, fakeApi(), KEY).turnOn()
  const api = fakeApi()
  const push = createPushSwitch(device, api, KEY)

  expect(await push.state()).toBe('off')
  expect(await push.turnOn()).toBe('on')

  expect(device.subscribed).toBe(1)
  expect([...api.stored]).toEqual([device.current!.endpoint])
})

test('a subscription made with another key (the app\'s keys changed) is replaced', async () => {
  const device = fakeDevice()
  await createPushSwitch(device, fakeApi(), 'old-key').turnOn()
  const old = device.current!

  expect(await createPushSwitch(device, fakeApi(), KEY).turnOn()).toBe('on')

  expect(old.unsubscribed).toBe(true)
  expect(device.current).toMatchObject({ key: KEY })
})

test('the browser blocking notifications keeps it off, and says so', async () => {
  const device = fakeDevice('default', 'denied')
  const api = fakeApi()
  const push = createPushSwitch(device, api, KEY)

  expect(await push.turnOn()).toBe('blocked')

  expect(device.subscribed).toBe(0)
  expect(api.stored.size).toBe(0)
  expect(await push.state()).toBe('blocked')
})

test('the browser\'s question dismissed, it stays off', async () => {
  const device = fakeDevice('default', 'default')
  expect(await createPushSwitch(device, fakeApi(), KEY).turnOn()).toBe('off')
  expect(device.subscribed).toBe(0)
})

test('a browser without push notifications can\'t turn them on', async () => {
  expect(await createPushSwitch(fakeDevice(null), fakeApi(), KEY).state()).toBe('unsupported')
})

test('the server failing to keep it leaves the device unsubscribed and the error to the caller', async () => {
  const device = fakeDevice()
  const api = { ...fakeApi(), turnOn: () => Promise.reject(new Error('offline')) }

  await expect(createPushSwitch(device, api, KEY).turnOn()).rejects.toThrow('offline')

  expect(device.current).toBeNull()
})
