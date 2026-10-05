import { and, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import { dishRef, dishSegment, isUuid, slugify } from '../../shared/address'
import { db, type Db } from '../db'
import { board, boardSlug, dish, membership } from '../db/schema'

// Readable addresses (CONTEXT.md: Address; shared/address.ts builds them).
// The server picks a Board's slug, keeps every slug it ever had, and finds
// a Board and a Dish from any address they had.

// Where an address leads, as it is now: the Board's id and current slug
// (for a Dish's address, of the Board the Dish is on now), and the Dish
// part of the address (null for the Board itself). A Dish part that matches
// no Dish on the user's Boards comes back as it was asked.
export interface BoardAddress {
  boardId: string
  slug: string
  dish: string | null
}

// A Board's current slug. A Board created while the deployment before
// readable addresses still ran has none: its id stands in for it.
export const slugOf = sql<string>`coalesce(${board.slug}, ${board.id}::text)`

// The slug for a Board of this name: its name's slug, or the first of
// "-2", "-3", ... after it that no other Board has (had). One the Board had
// itself, it takes again. Run it after lockSlugs, in the same transaction.
export function freeSlug(boardId: string, name: string): SQL<string> {
  const base = slugify(name) || 'board'
  return sql<string>`(
    select candidate from (
      select n, case when n = 1 then ${base}::text else ${base}::text || '-' || n end as candidate
      -- One more than there are slugs: at least one of them is free.
      from generate_series(1, (select count(*) from ${boardSlug})::int + 1) as n
    ) as candidates
    where not exists (
      select 1 from ${boardSlug}
      where ${boardSlug.slug} = candidates.candidate and ${boardSlug.boardId} <> ${boardId}
    )
    order by n
    limit 1
  )`
}

// Serialises picking slugs until the transaction ends, so two Boards named
// alike at the same moment don't both pick the same free one.
export function lockSlugs(d: Db) {
  return d.execute(sql`select pg_advisory_xact_lock(hashtextextended('board-slugs', 0))`)
}

// Keeps the Board's current slug among its slugs (once).
export function recordSlug(d: Db, boardId: string) {
  return d.execute(sql`
    insert into ${boardSlug} (slug, board_id)
    select ${board.slug}, ${board.id} from ${board} where ${board.id} = ${boardId} and ${board.slug} is not null
    on conflict (slug) do nothing
  `)
}

// Where an address leads (`ref` a Board's slug, current or former, or its
// id; `dishPart` what follows it), for one of the Board's Members; null for
// anyone else, as for an address no Board has.
export async function boardAddress(ref: string, userId: string, dishPart?: string): Promise<BoardAddress | null> {
  const bySlug = inArray(board.id, db.select({ id: boardSlug.boardId }).from(boardSlug).where(eq(boardSlug.slug, ref.toLowerCase())))
  const [found] = await db
    .select({ boardId: board.id, slug: slugOf })
    .from(board)
    .innerJoin(membership, and(eq(membership.boardId, board.id), eq(membership.userId, userId)))
    .where(isUuid(ref) ? or(eq(board.id, ref), bySlug) : bySlug)
  if (!found) return null
  if (dishPart === undefined) return { ...found, dish: null }

  // The Dish wherever it is now: its code (or id) is unique across all
  // Boards, so one moved to another of the user's Boards is found there,
  // and its address forwards to that Board.
  const wanted = dishRef(dishPart.toLowerCase())
  const [shown] = await db
    .select({ boardId: dish.boardId, slug: slugOf, title: dish.title, code: dish.code })
    .from(dish)
    .innerJoin(board, eq(board.id, dish.boardId))
    .innerJoin(membership, and(eq(membership.boardId, dish.boardId), eq(membership.userId, userId)))
    .where(and(
      isNull(dish.deletedAt),
      'id' in wanted ? eq(dish.id, wanted.id) : eq(dish.code, wanted.code),
    ))
  if (!shown) return { ...found, dish: dishPart }
  return { boardId: shown.boardId, slug: shown.slug, dish: dishSegment(shown) }
}
