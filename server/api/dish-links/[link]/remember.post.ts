import { dishLinkSecret } from '../../../../shared/dish-link'
import { dishLinkNotFound, liveDishBySecret, rememberDishLink } from '../../../utils/dish-links'
import { lookUpSecret } from '../../../utils/invites'

// POST /api/dish-links/:link/remember (#403): "Auf mein Board kopieren" from a
// signed-out visitor. The link is remembered in a cookie through sign-in and
// sign-up (server/utils/dish-links.ts). Public, as the link itself is; a link
// no live Dish has is 404, and counts as a miss like any other lookup.
export default defineEventHandler(async (event) => {
  const secret = dishLinkSecret(getRouterParam(event, 'link') ?? '')
  const remembered = await lookUpSecret(event, async () => (secret && await liveDishBySecret(secret) ? secret : null), dishLinkNotFound)
  rememberDishLink(event, remembered)
  setResponseStatus(event, 204)
  return null
})
