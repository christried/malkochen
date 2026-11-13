import { and, asc, eq, inArray, isNotNull, isNull, sql, type SQL } from 'drizzle-orm'
import { SHOPPING_LIMITS, type ShoppingItemView, type WeekPutOn } from '../../shared/shopping-list'
import { db, runAtomic } from '../db'
import { dish, plannedDish, shoppingItem } from '../db/schema'
import { shoppingEvent, withEvents } from './events'
import { madeAtOrNow, writeOnce, type DeviceIdStanding } from './late-changes'

// The Shopping List (CONTEXT.md: Shopping List, Shopping Item; ADR 0015): a
// Board's list of what to buy, one for every Member. Its items are copies:
// once on the list they follow neither the Recipe nor the Week Plan, and
// archiving, moving, deleting or copying their Dish never touches them. Every
// write is one small atomic statement with its Event Log event, open to every
// Member, the Owner and the Operator, with no Permission (the caller checks
// they may see the Board). None writes to the Dish History or notifies
// anyone. Deleting and "Erledigte entfernen" only mark items deleted, so
// "Rückgängig" brings them back as they were; the daily cleanup purges them
// (cleanup.ts).
//
// Writes sent late (ADR 0012) apply to the list as it is when they arrive: a
// text change or a tick wins over what others did meanwhile, and one about an
// item that has gone since finds nothing (null), which the app drops without
// telling the Member.

export type { ShoppingItemView, WeekPutOn }

// Its items are on the list while not deleted.
const live = (boardId: string) => and(eq(shoppingItem.boardId, boardId), isNull(shoppingItem.deletedAt))

// The group's Dish while it is on the item's Board and not archived.
const groupDish = and(eq(dish.id, shoppingItem.dishId), eq(dish.boardId, shoppingItem.boardId), isNull(dish.deletedAt))

const VIEW = {
  id: shoppingItem.id,
  text: shoppingItem.text,
  ticked: shoppingItem.ticked,
  dishId: shoppingItem.dishId,
  dishTitle: sql<string | null>`coalesce(${dish.title}, ${shoppingItem.dishTitle})`,
  dishOnBoard: sql<boolean>`${dish.id} is not null`,
}

// The list's order: "Sonstiges" first, then the groups in the order their
// Dishes were first put on, each item at its place in its group.
const ORDER = [sql`${shoppingItem.groupAt} asc nulls first`, asc(shoppingItem.dishId), asc(shoppingItem.position), asc(shoppingItem.addedAt), asc(shoppingItem.id)]

// The Board's Shopping List, in order.
export async function shoppingItemsOf(boardId: string): Promise<ShoppingItemView[]> {
  return db.select(VIEW).from(shoppingItem).leftJoin(dish, groupDish).where(live(boardId)).orderBy(...ORDER)
}

// The items `ids` as the Board shows them, in the list's order; those
// deleted too when `deleted` is set.
async function viewsOf(boardId: string, ids: string[], { deleted = false } = {}): Promise<ShoppingItemView[]> {
  if (ids.length === 0) return []
  return db
    .select(VIEW)
    .from(shoppingItem)
    .leftJoin(dish, groupDish)
    .where(and(eq(shoppingItem.boardId, boardId), inArray(shoppingItem.id, ids), deleted ? undefined : isNull(shoppingItem.deletedAt)))
    .orderBy(...ORDER)
}

// The Board of the item, unless it is deleted or gone.
export async function shoppingItemBoard(id: string): Promise<{ boardId: string } | null> {
  const [found] = await db.select({ boardId: shoppingItem.boardId }).from(shoppingItem).where(and(eq(shoppingItem.id, id), isNull(shoppingItem.deletedAt)))
  return found ?? null
}

// How many items the Board's list holds.
const liveCount = (boardId: string) => sql`(select count(*) from ${shoppingItem} s where s.board_id = ${boardId} and s.deleted_at is null)`

// Whether `adding` more items keep the list within its limit, as SQL.
const roomFor = (boardId: string, adding: SQL | number) => sql`${liveCount(boardId)} + ${adding} <= ${SHOPPING_LIMITS.items}`

// How the id a device made for a new item stands (late-changes.ts): a repeat
// if it is an item of this Board and group the user added (deleted since or
// not), taken if it is any other's.
async function itemIdStanding(id: string, boardId: string, dishId: string | null, userId: string): Promise<DeviceIdStanding> {
  const [found] = await db.select({ boardId: shoppingItem.boardId, dishId: shoppingItem.dishId, addedBy: shoppingItem.addedBy }).from(shoppingItem).where(eq(shoppingItem.id, id))
  if (!found) return 'free'
  return found.boardId === boardId && found.dishId === dishId && found.addedBy === userId ? 'repeat' : 'taken'
}

// Adds an item to "Sonstiges", at its end, dated `madeAt` if made offline.
// 'full' if the list holds its limit already; 'taken' if `id` (made on the
// device) is another item's. A repeat (the same id, Board and user) adds
// nothing again and answers the item as it is now.
export async function addShoppingItem(
  boardId: string,
  userId: string,
  { id, text, madeAt }: { id: string, text: string, madeAt?: string },
): Promise<ShoppingItemView | 'full' | 'taken'> {
  let added = true
  const standing = await writeOnce(() => itemIdStanding(id, boardId, null, userId), async () => {
    const [inserted] = await runAtomic(d => [
      withEvents(
        d,
        sql`insert into ${shoppingItem} (id, board_id, text, position, added_by, added_at)
          select ${id}, ${boardId}, ${text},
            coalesce((select max(s.position) + 1 from ${shoppingItem} s where s.board_id = ${boardId} and s.dish_id is null and s.deleted_at is null), 0),
            ${userId}, ${madeAtOrNow(madeAt)}
          where ${roomFor(boardId, 1)}
          returning id, board_id`,
        shoppingEvent('shopping_item_added', userId),
      ),
    ])
    added = (inserted?.rows.length ?? 0) > 0
  })
  if (standing === 'taken') return 'taken'
  if (!added) return 'full'
  const [view] = await viewsOf(boardId, [id], { deleted: true })
  return view!
}

// Changes the item's text, or ticks or unticks it: whichever is given. The
// same text or tick it has already changes nothing (no Board Version move,
// no event). Null unless the item is on the Board's list.
export async function changeShoppingItem(
  boardId: string,
  userId: string,
  id: string,
  change: { text: string } | { ticked: boolean },
): Promise<ShoppingItemView | null> {
  const where = and(eq(shoppingItem.id, id), live(boardId))
  await runAtomic(d => [
    'text' in change
      ? withEvents(
          d,
          sql`update ${shoppingItem} set text = ${change.text}
            where ${where} and ${shoppingItem.text} is distinct from ${change.text}
            returning id, board_id`,
          shoppingEvent('shopping_item_changed', userId),
        )
      : withEvents(
          d,
          sql`update ${shoppingItem} set ticked = ${change.ticked}
            where ${where} and ${shoppingItem.ticked} <> ${change.ticked}
            returning id, board_id`,
          shoppingEvent(change.ticked ? 'shopping_item_ticked' : 'shopping_item_unticked', userId),
        ),
  ])
  const [view] = await viewsOf(boardId, [id])
  return view ?? null
}

// Deletes the item from the list ("Rückgängig" restores it). False unless
// this deleted it: it was on the Board's list.
export async function deleteShoppingItem(boardId: string, userId: string, id: string): Promise<boolean> {
  const [deleted] = await runAtomic(d => [
    withEvents(
      d,
      sql`update ${shoppingItem} set deleted_at = now() where ${and(eq(shoppingItem.id, id), live(boardId))} returning id, board_id`,
      shoppingEvent('shopping_item_deleted', userId),
    ),
  ])
  return (deleted?.rows.length ?? 0) > 0
}

// "Erledigte entfernen": deletes every ticked item on the Board's list, for
// everyone, as they are when it arrives. Answers the ids it deleted, for
// "Rückgängig". One event, however many it deleted; none for none.
export async function clearTickedItems(boardId: string, userId: string): Promise<string[]> {
  const [cleared] = await runAtomic(d => [
    withEvents(
      d,
      sql`update ${shoppingItem} set deleted_at = now()
        where ${and(live(boardId), eq(shoppingItem.ticked, true))}
        returning id, board_id`,
      shoppingEvent('shopping_items_cleared', userId),
      { once: true },
    ),
  ])
  return (cleared?.rows ?? []).map(row => row.id as string)
}

// "Rückgängig" after a delete or a clear: brings the deleted items `ids` of
// the Board back as they were, with their ids, ticks, groups and places.
// Those not deleted (or purged since) are left out. 'full' if they wouldn't
// fit on the list, and then none comes back. Answers those it brought back,
// in the list's order.
export async function restoreShoppingItems(boardId: string, userId: string, ids: string[]): Promise<ShoppingItemView[] | 'full'> {
  const deleted = and(eq(shoppingItem.boardId, boardId), inArray(shoppingItem.id, ids), isNotNull(shoppingItem.deletedAt))
  const [restored] = await runAtomic(d => [
    withEvents(
      d,
      sql`update ${shoppingItem} set deleted_at = null
        where ${deleted} and ${roomFor(boardId, sql`(select count(*) from ${shoppingItem} where ${deleted})`)}
        returning id, board_id`,
      shoppingEvent('shopping_items_restored', userId),
      { once: true },
    ),
  ])
  const back = (restored?.rows ?? []).map(row => row.id as string)
  if (back.length === 0) {
    const [waiting] = await db.select({ n: sql<number>`count(*)::int` }).from(shoppingItem).where(deleted)
    if ((waiting?.n ?? 0) > 0) return 'full'
  }
  return viewsOf(boardId, back)
}

// The Dish as putting it on sees it: on the Board, not archived.
const dishOn = (boardId: string, dishId: string) => and(eq(dish.id, dishId), eq(dish.boardId, boardId), isNull(dish.deletedAt))

// Why a Dish can't be put on: not on the Board (gone, archived, another
// Board's), or without Ingredients.
export type PutOnRefusal = 'no-dish' | 'no-ingredients'

async function dishRefusal(boardId: string, dishId: string): Promise<PutOnRefusal | null> {
  const [found] = await db.select({ lines: sql<number>`cardinality(${dish.recipeIngredients})` }).from(dish).where(dishOn(boardId, dishId))
  if (!found) return 'no-dish'
  return found.lines > 0 ? null : 'no-ingredients'
}

// "Auf die Einkaufsliste": puts the Dish on the list with the lines the
// Member chose from its Ingredients (`items`, each with the id the device
// made), at the end of the Dish's group in the order sent. The group is new,
// after every other, if the Dish has none on the list; and takes the Dish's
// title as it is now either way. A refusal if the Dish isn't on the Board
// (archived, gone, another Board's) or has no Ingredients; 'full' if the
// lines wouldn't fit, and then none goes on; 'taken' if an id is another
// item's. A repeat (its first id is an item of this Dish the user added)
// puts nothing on again and answers its items as they are now.
export async function putDishOn(
  boardId: string,
  userId: string,
  { dishId, items, madeAt }: { dishId: string, items: { id: string, text: string }[], madeAt?: string },
): Promise<ShoppingItemView[] | PutOnRefusal | 'full' | 'taken'> {
  const ids = items.map(item => item.id)
  const lines = sql.join(items.map((item, i) => sql`(${item.id}::uuid, ${item.text}::text, ${i}::int)`), sql`, `)
  let refusal: PutOnRefusal | 'full' | null = null
  const standing = await writeOnce(() => itemIdStanding(ids[0]!, boardId, dishId, userId), async () => {
    const before = await dishRefusal(boardId, dishId)
    if (before) {
      refusal = before
      return
    }
    const [, inserted] = await runAtomic(d => [
      // The group's title, as the Dish has it now.
      d.update(shoppingItem)
        .set({ dishTitle: sql`(select ${dish.title} from ${dish} where ${dishOn(boardId, dishId)})` })
        .where(and(eq(shoppingItem.boardId, boardId), eq(shoppingItem.dishId, dishId), sql`exists (select 1 from ${dish} where ${dishOn(boardId, dishId)})`)),
      withEvents(
        d,
        sql`insert into ${shoppingItem} (id, board_id, text, dish_id, dish_title, group_at, position, added_by, added_at)
          select v.id, ${boardId}, v.text, d.id, d.title,
            coalesce(g.at, now()), g.next + v.ord, ${userId}, ${madeAtOrNow(madeAt)}
          from (select ${dish.id} as id, ${dish.title} as title from ${dish}
              where ${dishOn(boardId, dishId)} and cardinality(${dish.recipeIngredients}) > 0) d,
            (select min(s.group_at) as at, coalesce(max(s.position) + 1, 0) as next from ${shoppingItem} s
              where s.board_id = ${boardId} and s.dish_id = ${dishId} and s.deleted_at is null) g,
            (values ${lines}) v(id, text, ord)
          where ${roomFor(boardId, items.length)}
          returning id, board_id, dish_id`,
        shoppingEvent('dish_put_on_shopping_list', userId),
        { once: true },
      ),
    ])
    if ((inserted?.rows.length ?? 0) === 0) refusal = await dishRefusal(boardId, dishId) ?? 'full'
  })
  if (standing === 'taken') return 'taken'
  if (refusal) return refusal
  return viewsOf(boardId, ids, { deleted: standing === 'repeat' })
}

// Whether `day` ('YYYY-MM-DD') is a Monday.
export function isMonday(day: string): boolean {
  return new Date(`${day}T00:00:00Z`).getUTCDay() === 1
}

// "Woche auf die Einkaufsliste": puts every Dish planned on the Week Plan
// from today, or the week's Monday if that is later, to that week's Sunday
// on the list, each once with all its Ingredients in their order, however
// many of those days it is planned on; in the order of their first day there.
// Today is the day it was made (`madeAt`, a Berlin date), and the Dishes are
// collected as the Board is when it arrives. Dishes that have a group on the
// list already, have no Ingredients or are archived are skipped. 'past' for
// a week that is over; 'full' if their lines wouldn't fit, and then none
// goes on. Answers how many Dishes went on, and their items.
export async function putWeekOn(
  boardId: string,
  userId: string,
  { week, madeAt }: { week: string, madeAt?: string },
): Promise<WeekPutOn | 'past' | 'full'> {
  const today = sql`(${madeAtOrNow(madeAt)} at time zone 'Europe/Berlin')::date`
  const monday = sql`${week}::date`
  const [{ over } = { over: true }] = await db.execute<{ over: boolean }>(sql`select ${monday} + 6 < ${today} as over`).then(r => r.rows)
  if (over) return 'past'
  // The Dishes to put on, numbered in the order of their first day.
  const dishes = sql`select ${dish.id} as id, ${dish.title} as title, ${dish.recipeIngredients} as lines,
      row_number() over (order by min(${plannedDish.day}), min(${plannedDish.position}), ${dish.id}) as rank,
      sum(cardinality(${dish.recipeIngredients})) over () as total
    from ${plannedDish} join ${dish} on ${dish.id} = ${plannedDish.dishId}
    where ${and(eq(dish.boardId, boardId), isNull(dish.deletedAt))}
      and ${plannedDish.day} between greatest(${today}, ${monday}) and ${monday} + 6
      and cardinality(${dish.recipeIngredients}) > 0
      and not exists (select 1 from ${shoppingItem} s where s.board_id = ${boardId} and s.dish_id = ${dish.id} and s.deleted_at is null)
    group by ${dish.id}`
  const [inserted] = await runAtomic(d => [
    withEvents(
      d,
      sql`insert into ${shoppingItem} (id, board_id, text, dish_id, dish_title, group_at, position, added_by, added_at)
        select gen_random_uuid(), ${boardId}, line.text, p.id, p.title,
          now() + p.rank * interval '1 microsecond', line.ord - 1, ${userId}, ${madeAtOrNow(madeAt)}
        from (${dishes}) p, unnest(p.lines) with ordinality as line(text, ord)
        where ${roomFor(boardId, sql`p.total`)}
        returning id, board_id, dish_id`,
      shoppingEvent('week_put_on_shopping_list', userId, week),
      { once: true },
    ),
  ])
  const rows = inserted?.rows ?? []
  if (rows.length === 0) {
    const [{ waiting } = { waiting: 0 }] = await db.execute<{ waiting: number }>(sql`select count(*)::int as waiting from (${dishes}) p`).then(r => r.rows)
    if (waiting > 0) return 'full'
  }
  return {
    dishes: new Set(rows.map(row => row.dish_id)).size,
    items: await viewsOf(boardId, rows.map(row => row.id as string)),
  }
}

// The deleted items purged for good by the daily cleanup: those deleted a
// day ago or longer, past any "Rückgängig".
export async function purgeDeletedShoppingItems(): Promise<number> {
  const purged = await db.delete(shoppingItem).where(sql`${shoppingItem.deletedAt} < now() - interval '1 day'`).returning({ id: shoppingItem.id })
  return purged.length
}
