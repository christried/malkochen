import { and, asc, eq, exists, inArray, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { cooking, dish, user, vote } from '../db/schema'
import { onMembersBoard, type DishAdder } from './dishes'
import { insertEvents, voteEvent, withEvents } from './events'
import { pictureOf } from './people'

// Votes (CONTEXT.md: Vote): a Member's thumbs up or down on a Cooked Dish.
// Any Member gives one, one per Dish; giving it again changes it, and they
// take it back. It stays when the Dish moves out of the Gekocht Column. The
// Board shows each Dish's Votes, and its Dish History each one at the time
// it was last set (dish-history.ts). Every write records its event.

export interface VoteView {
  voter: DishAdder
  // Thumbs up; false is thumbs down.
  up: boolean
  // When it was last set.
  votedAt: string
}

// What giving one accepts.
export const voteBody = z.object({ up: z.boolean() })

// Why a Member may not vote on a Dish they can see: it isn't Cooked (no
// Cooking recorded, or every one deleted).
export type VoteRefusal = 'uncooked'

// The Dish is Cooked: it has a Cooking that isn't deleted.
const isCooked = exists(db.select({ id: cooking.id }).from(cooking).where(and(eq(cooking.dishId, dish.id), isNull(cooking.deletedAt))))

function selectVotes() {
  return db
    .select({
      dishId: vote.dishId,
      up: vote.up,
      votedAt: vote.votedAt,
      voterId: user.id,
      // Voting takes a Username (server/middleware/auth.ts).
      voterName: user.username,
      voterImage: pictureOf,
    })
    .from(vote)
    .innerJoin(user, eq(user.id, vote.userId))
    .$dynamic()
}

type VoteRow = Awaited<ReturnType<typeof selectVotes>>[number]

function toView({ dishId: _, voterId, voterName, voterImage, ...row }: VoteRow): VoteView {
  return { ...row, voter: { id: voterId, name: voterName ?? '', image: voterImage }, votedAt: row.votedAt.toISOString() }
}

// The Votes of each of the given Dishes, in the order they were last set.
export async function votesByDish(dishIds: string[]): Promise<Map<string, VoteView[]>> {
  const byDish = new Map<string, VoteView[]>(dishIds.map(id => [id, []]))
  if (dishIds.length === 0) return byDish

  const rows = await selectVotes().where(inArray(vote.dishId, dishIds)).orderBy(asc(vote.votedAt), asc(vote.userId))
  for (const row of rows) byDish.get(row.dishId)?.push(toView(row))
  return byDish
}

// Whether the user may see the Dish (a Member of its Board, not archived),
// and whether it is Cooked; null if they can't see it.
async function cookedFor(dishId: string, userId: string): Promise<boolean | null> {
  const [found] = await db.select({ cooked: sql<boolean>`${isCooked}` }).from(dish).where(onMembersBoard(dishId, userId))
  return found ? found.cooked : null
}

// Gives the user's Vote on a Dish, or changes the one they gave; the same
// thumb again changes nothing, not even when it was set. Null unless the
// Dish is on a Board they are a Member of and not archived.
export async function setVote(dishId: string, userId: string, up: boolean): Promise<VoteView | VoteRefusal | null> {
  const cooked = await cookedFor(dishId, userId)
  if (cooked === null) return null
  if (!cooked) return 'uncooked'
  const theirs = and(eq(vote.dishId, dishId), eq(vote.userId, userId))
  await db.execute(sql`
    with earlier as (select from ${vote} where ${theirs}),
    changed as (
      insert into ${vote} (dish_id, user_id, up)
      select ${dish.id}, ${userId}::text, ${up}::boolean from ${dish} where ${and(onMembersBoard(dishId, userId), isCooked)}
      on conflict (dish_id, user_id) do update set up = excluded.up, voted_at = now() where ${vote.up} <> excluded.up
      returning dish_id, up
    ),
    given as (${insertEvents(voteEvent('vote_set', userId), sql`from changed where not exists (select from earlier)`)}),
    switched as (${insertEvents(voteEvent('vote_changed', userId), sql`from changed where exists (select from earlier)`)})
    select from changed
  `)
  const [row] = await selectVotes().where(theirs)
  return row ? toView(row) : null
}

// Takes the user's Vote on a Dish back; with none, nothing changes. False
// unless the Dish is on a Board they are a Member of and not archived.
export async function takeBackVote(dishId: string, userId: string): Promise<boolean> {
  if (await cookedFor(dishId, userId) === null) return false
  await withEvents(
    db,
    db.delete(vote).where(and(eq(vote.dishId, dishId), eq(vote.userId, userId))).returning({ dishId: vote.dishId, up: vote.up }),
    voteEvent('vote_taken_back', userId),
  )
  return true
}
