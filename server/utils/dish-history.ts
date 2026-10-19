import { commentsOfDish, type CommentView } from './comments'
import type { CookingView } from './cookings'
import { membersDish, type DishAdder } from './dishes'

// The Dish History (CONTEXT.md: Dish History, "Verlauf"): everything that
// happened to a Dish, oldest first, as its detail shows it at the bottom:
// when it was added and by whom, its Cookings and its Comments. Moves aren't
// part of it, nor anything deleted. Built here, so every client tells the
// same story; the detail loads it as it opens (GET /api/dishes/:id/history).

export type DishHistoryEntry =
  | { kind: 'added', at: string, by: DishAdder | null }
  | { kind: 'cooking', at: string, cooking: CookingView }
  | { kind: 'comment', at: string, comment: CommentView }

export interface DishHistory {
  dishId: string
  entries: DishHistoryEntry[]
}

// The Dish's history, if it is on a Board the user is a Member of and not
// archived. "Added" always comes first; the rest by time, a Cooking before a
// Comment of the same moment.
export async function dishHistory(dishId: string, userId: string): Promise<DishHistory | null> {
  const dish = await membersDish(dishId, userId)
  if (!dish) return null
  const comments = await commentsOfDish(dishId)
  const rest: DishHistoryEntry[] = [
    // The Cooking History is newest first.
    ...dish.cookings.toReversed().map(cooking => ({ kind: 'cooking' as const, at: cooking.cookedAt, cooking })),
    ...comments.map(comment => ({ kind: 'comment' as const, at: comment.createdAt, comment })),
  ]
  return {
    dishId,
    entries: [
      { kind: 'added', at: dish.createdAt, by: dish.addedBy },
      // A stable sort: same-moment entries keep the order above.
      ...rest.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    ],
  }
}
