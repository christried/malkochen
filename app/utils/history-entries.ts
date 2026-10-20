import type { CommentView } from '../../server/utils/comments'
import type { DishHistoryEntry } from '../../server/utils/dish-history'
import type { DishView } from '../../server/utils/dishes'

// The Dish History's entries in the order it tells them (CONTEXT.md: Dish
// History): "added" always first, then the Cookings, Votes and Comments by
// time, of the same moment a Cooking first, then a Vote, then a Comment. A
// Vote is each Member's current one, at the time it was last set. The
// server builds the history with it (server/utils/dish-history.ts), and the
// Board module shows it the same way (app/board/dish-histories.ts). In
// app/, as comment-text.ts.
export function historyEntries(dish: Pick<DishView, 'createdAt' | 'addedBy' | 'cookings' | 'votes'>, comments: CommentView[]): DishHistoryEntry[] {
  const rest: DishHistoryEntry[] = [
    // A Dish's Cookings are newest first.
    ...dish.cookings.toReversed().map(cooking => ({ kind: 'cooking' as const, at: cooking.cookedAt, cooking })),
    ...dish.votes.map(vote => ({ kind: 'vote' as const, at: vote.votedAt, vote })),
    ...comments.map(comment => ({ kind: 'comment' as const, at: comment.createdAt, comment })),
  ]
  return [
    { kind: 'added', at: dish.createdAt, by: dish.addedBy },
    // A stable sort: same-moment entries keep the order above.
    ...rest.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
  ]
}
