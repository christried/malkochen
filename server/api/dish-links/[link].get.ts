import { openDishLink, type DishLinkView } from '../../utils/dish-links'

// GET /api/dish-links/:link — the Dish Link page's data: the Dish's image,
// title, Creator and Source, and nothing of its Board, but for its Board's id
// when the viewer is a Member of it (`ownBoard`). `:link` is what
// follows /d/ in the link (its secret, after the Dish's title). Public:
// whoever has the link sees this much, signed in or not.
export default defineEventHandler((event): Promise<DishLinkView> => {
  return openDishLink(event, getRouterParam(event, 'link') ?? '')
})
