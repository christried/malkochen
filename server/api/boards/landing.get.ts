import { landingBoard, landingToAdd } from '../../utils/boards'
import { dishLinkPath } from '../../../shared/dish-link'
import { dishOf, forgetDishLink, rememberedDishLink } from '../../utils/dish-links'

// Where the app opens: the last-used Board, creating "Meine Küche" on a
// first sign-in. Answers its id and the slug of its Address. With
// `?adding`, for something shared to malkochen: the last-used Board the
// user may add Dishes to, and whether there is one (`canAdd`). A Dish Link
// remembered on the way in (#403, the Copy from it) is answered as
// `dishLink`, its path, while the Dish is still there; the cookie is cleared
// either way.
export default defineEventHandler(async (event): Promise<{ boardId: string, slug: string, dishLink?: string, canAdd?: boolean }> => {
  const user = requireUser(event)
  if (getQuery(event).adding !== undefined) return landingToAdd(user.id, callerLanguage(event))

  const landing = await landingBoard(user.id, callerLanguage(event))
  const secret = rememberedDishLink(event)
  if (!secret) return landing
  forgetDishLink(event)
  const found = await dishOf(secret)
  return found ? { ...landing, dishLink: dishLinkPath({ title: found.title, linkSecret: secret }) } : landing
})
