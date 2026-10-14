import { z } from 'zod'
import { isAcceptedPushEndpoint } from './push'

// A key in base64url (with or without padding) that decodes to `bytes` bytes.
const base64urlKey = (bytes: number) => z.string().max(200).regex(/^[\w-]+={0,2}$/).refine(key => Buffer.from(key, 'base64url').length === bytes)

// A device's push service address, where the server posts its pushes.
export const pushEndpoint = z.string().max(2048).refine(isAcceptedPushEndpoint)

// A browser's push subscription, as PushSubscription.toJSON() hands it over:
// the endpoint, the device's P-256 public key (65 bytes, uncompressed) and
// its 16-byte auth secret.
export const pushSubscriptionBody = z.object({
  endpoint: pushEndpoint,
  keys: z.object({ p256dh: base64urlKey(65), auth: base64urlKey(16) }),
})
