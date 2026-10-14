import { pushSubscriptionBody } from '../../utils/push-input'
import { pushOffered, turnOnPush } from '../../utils/push'

// PUT /api/me/push { endpoint, keys: { p256dh, auth } } — turns push
// notifications on for this device (#219): the subscription its browser made
// with the app's VAPID key. 400 for one that isn't a push service's, 503 when
// the server has no VAPID keys.
export default defineEventHandler(async (event) => {
  const user = requireUser(event)
  if (!pushOffered) throw createError({ statusCode: 503, statusMessage: 'Push notifications are not set up' })
  const parsed = pushSubscriptionBody.safeParse(await readBody(event).catch(() => null))
  if (!parsed.success) throw createError({ statusCode: 400, statusMessage: 'Not a push subscription' })
  const { endpoint, keys } = parsed.data
  await turnOnPush(user.id, { endpoint, ...keys })
  setResponseStatus(event, 204)
  return null
})
