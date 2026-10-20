import { historyEntries } from '../../app/utils/history-entries'
import { commentsOfDish, type CommentView } from './comments'
import type { CookingView } from './cookings'
import { membersDish, type DishAdder } from './dishes'
import type { VoteView } from './votes'

// The Dish History (CONTEXT.md: Dish History, "Verlauf"): everything that
// happened to a Dish, oldest first, as its detail shows it at the bottom:
// when it was added and by whom, its Cookings, Votes and Comments. Moves aren't
// part of it, nor anything deleted. Built here, in the order
// historyEntries tells it; the detail loads it as it opens (GET
// /api/dishes/:id/history).

export type DishHistoryEntry =
  | { kind: 'added', at: string, by: DishAdder | null }
  | { kind: 'cooking', at: string, cooking: CookingView }
  | { kind: 'vote', at: string, vote: VoteView }
  | { kind: 'comment', at: string, comment: CommentView }

export interface DishHistory {
  dishId: string
  entries: DishHistoryEntry[]
}

// The Dish's history, if it is on a Board the user is a Member of and not
// archived.
export async function dishHistory(dishId: string, userId: string): Promise<DishHistory | null> {
  const dish = await membersDish(dishId, userId)
  if (!dish) return null
  return { dishId, entries: historyEntries(dish, await commentsOfDish(dishId)) }
}
