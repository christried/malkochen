import type { DishView } from '../../server/utils/dishes'

// A Member's Vote on a Dish (CONTEXT.md: Vote), as "Wie war's?" shows it:
// thumbs up (true), down (false), or none (null).
export function voteOf(dish: Pick<DishView, 'votes'>, userId: string | undefined): boolean | null {
  return dish.votes.find(v => v.voter?.id === userId)?.up ?? null
}
