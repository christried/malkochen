import { landingBoard, landingToAdd } from '../../utils/boards'
import { dishLinkPath } from '../../../shared/dish-link'
import { dishOf, forgetDishLink, rememberedDishLink } from '../../utils/dish-links'

// Where the app opens: the last-used Board, creating "Meine Küche" on a
// first sign-in. Answers its id and the slug of its Address. With
// `?adding`, for something shared to malkochen: the last-used Board the
// user may add Dishes to, and whether there is one (`canAdd`). With
// `?dishLink` (#403, asked only by the app's opening, index.vue), a Dish
// Link remembered on the way in is answered as `dishLink`, its path, while
// the Dish is still there, and the cookie is cleared either way. Without it
// the cookie is left alone, so other callers (the settings page, tests)
// don't use it up.
export default defineEventHandler(async (event): Promise<{ boardId: string, slug: string, dishLink?: string, canAdd?: boolean }> => {
  const user = requireUser(event)
  if (getQuery(event).adding !== undefined) return landingToAdd(user.id, callerLanguage(event))

  const landing = await landingBoard(user.id, callerLanguage(event))
  if (getQuery(event).dishLink === undefined) return landing
  const secret = rememberedDishLink(event)
  if (!secret) return landing
  forgetDishLink(event)
  const found = await dishOf(secret)
  return found ? { ...landing, dishLink: dishLinkPath({ title: found.title, linkSecret: secret }) } : landing
})
