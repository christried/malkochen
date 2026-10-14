import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '../db'
import { board, dish, membership, user } from '../db/schema'
import { isMember } from './boards'
import { pictureOf, usernameOf } from './people'

// What the user popover (#213) shows about someone, seen from one of the
// viewer's Boards: their Username and Profile Picture (never their Google
// name), when their account was made ("dabei seit März 2026"), how many of
// the Dishes on this Board they added, and the Boards the viewer and they
// both belong to. No cooking numbers.
export interface PersonCard {
  id: string
  name: string
  image: string | null
  memberSince: string
  dishesAdded: number
  sharedBoards: { id: string, name: string, emoji: string }[]
  // One's own popover: its Boards are simply one's own.
  isYou: boolean
}

// The popover's card of `personId`, for `viewerId` on their Board `boardId`.
// 'not-member' if the viewer isn't on the Board; null if the two share no
// Board (or there is nobody by that id), so nobody learns anything about
// people outside their Boards. Someone who left this Board but still shares
// another one is shown, as the Dishes they added here still show them.
export async function personCard(boardId: string, viewerId: string, personId: string): Promise<PersonCard | 'not-member' | null> {
  if (!await isMember(boardId, viewerId)) return 'not-member'

  const theirs = alias(membership, 'theirs')
  const sharedBoards = await db
    .select({ id: board.id, name: board.name, emoji: board.emoji })
    .from(membership)
    .innerJoin(theirs, and(eq(theirs.boardId, membership.boardId), eq(theirs.userId, personId)))
    .innerJoin(board, eq(board.id, membership.boardId))
    // In the viewer's order of their Boards (the switcher's).
    .where(eq(membership.userId, viewerId))
    .orderBy(asc(membership.joinedAt), asc(board.createdAt), asc(board.id))
  if (sharedBoards.length === 0) return null

  const [[person], [added]] = await Promise.all([
    db
      .select({ id: user.id, name: usernameOf, image: pictureOf, createdAt: user.createdAt })
      .from(user)
      .where(eq(user.id, personId)),
    db
      .select({ count: count() })
      .from(dish)
      .where(and(eq(dish.boardId, boardId), eq(dish.addedBy, personId), isNull(dish.deletedAt))),
  ])
  if (!person) return null
  const { createdAt, ...shown } = person
  return { ...shown, memberSince: createdAt.toISOString(), dishesAdded: added?.count ?? 0, sharedBoards, isYou: person.id === viewerId }
}
