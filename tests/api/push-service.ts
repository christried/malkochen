import { createDecipheriv, createECDH, createHmac, randomBytes } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// A stand-in for a browser's push service (FCM, Mozilla's, …), for the API
// tests of push notifications: devices subscribe with an endpoint on it, and
// it keeps what the app server pushes there, decrypted the way the device
// would (RFC 8291, aes128gcm). An endpoint can be told to answer like an
// expired subscription.

// What a device's push message showed, as the service worker gets it.
export interface PushMessage {
  title: string
  body: string
  tag: string
  url: string
}

export interface Delivery {
  device: string
  headers: Record<string, string | string[] | undefined>
  message: PushMessage
}

// A device's subscription as the browser hands it over
// (PushSubscription.toJSON()), and the keys only the device has.
export interface Device {
  name: string
  subscription: { endpoint: string, keys: { p256dh: string, auth: string } }
}

interface DeviceKeys {
  ecdh: ReturnType<typeof createECDH>
  auth: Buffer
}

export interface PushService {
  // A new device, subscribed on this service.
  device: (name: string) => Device
  // Every message delivered so far, oldest first.
  deliveries: Delivery[]
  // From now on, pushes to the device are refused with this status.
  answer: (device: Device, status: number) => void
  forget: () => void
  close: () => Promise<void>
}

export async function startPushService(): Promise<PushService> {
  const keys = new Map<string, DeviceKeys>()
  const answers = new Map<string, number>()
  const deliveries: Delivery[] = []
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const name = decodeURIComponent((req.url ?? '').replace(/^\/push\//, ''))
      const status = answers.get(name) ?? 201
      const device = keys.get(name)
      if (status === 201 && device) {
        deliveries.push({ device: name, headers: req.headers, message: JSON.parse(decrypt(Buffer.concat(chunks), device)) })
      }
      res.statusCode = device ? status : 404
      res.end()
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    device: (name) => {
      const ecdh = createECDH('prime256v1')
      ecdh.generateKeys()
      const auth = randomBytes(16)
      keys.set(name, { ecdh, auth })
      return {
        name,
        subscription: {
          endpoint: `http://127.0.0.1:${port}/push/${encodeURIComponent(name)}`,
          keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
        },
      }
    },
    deliveries,
    answer: (device, status) => answers.set(device.name, status),
    forget: () => deliveries.splice(0),
    close: () => new Promise(resolve => server.close(() => resolve())),
  }
}

const hmac = (key: Buffer, data: Buffer) => createHmac('sha256', key).update(data).digest()

// RFC 8188 / 8291: a header (salt, record size, the server's public key),
// then one record encrypted with a key both sides derive.
function decrypt(body: Buffer, { ecdh, auth }: DeviceKeys): string {
  const salt = body.subarray(0, 16)
  const idLength = body.readUInt8(20)
  const serverKey = body.subarray(21, 21 + idLength)
  const record = body.subarray(21 + idLength)

  const shared = ecdh.computeSecret(serverKey)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), serverKey, Buffer.from([1])])
  const ikm = hmac(hmac(auth, shared), keyInfo)
  const prk = hmac(salt, ikm)
  const contentKey = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)

  const decipher = createDecipheriv('aes-128-gcm', contentKey, nonce)
  decipher.setAuthTag(record.subarray(record.length - 16))
  const padded = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()])
  // The last record ends in a 2, then zero padding.
  return padded.subarray(0, padded.lastIndexOf(2)).toString('utf8')
}
