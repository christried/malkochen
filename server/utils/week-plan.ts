import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db, runAtomic } from '../db'
import { dish, plannedDish } from '../db/schema'
import { plannedDishEvent, withEvents } from './events'
import { isUniqueViolation } from './late-changes'

// The Week Plan (CONTEXT.md: Week Plan, Planned Dish; ADR 0014): the Dishes
// a Board's Members put on days. Planning, moving and unplanning are three
// small writes, each one atomic with its Event Log event and each checking
// what it needs in the same statement, so nothing races between check and
// write. They write nothing to the Dish History and notify nobody. The
// Permission to move Dishes is checked by the caller (permission-checks.ts).

// A Planned Dish as the Board load carries it: its Dish and its day, a
// calendar date in Europe/Berlin as 'YYYY-MM-DD'.
export interface PlannedDishView {
  id: string
  dishId: string
  day: string
}

// A Planned Dish is on a Board through its Dish, and counts only while that
// Dish isn't archived (archiving hides the row and keeps it).
function onBoard(boardId: string) {
  return and(eq(dish.boardId, boardId), isNull(dish.deletedAt))
}

const VIEW = { id: plannedDish.id, dishId: plannedDish.dishId, day: plannedDish.day }

// The Board's Week Plan, past weeks too, in order: by day, then place in the
// day. Those of an Archived Dish aren't in it.
export async function plannedDishesOf(boardId: string): Promise<PlannedDishView[]> {
  return db
    .select(VIEW)
    .from(plannedDish)
    .innerJoin(dish, eq(dish.id, plannedDish.dishId))
    .where(onBoard(boardId))
    .orderBy(asc(plannedDish.day), asc(plannedDish.position), asc(plannedDish.plannedAt), asc(plannedDish.id))
}

// The Planned Dish with its Board, unless it is gone or its Dish is archived.
export async function plannedDishBoard(id: string): Promise<{ boardId: string } | null> {
  const [found] = await db
    .select({ boardId: dish.boardId })
    .from(plannedDish)
    .innerJoin(dish, eq(dish.id, plannedDish.dishId))
    .where(and(eq(plannedDish.id, id), isNull(dish.deletedAt)))
  return found ?? null
}

async function viewOf(id: string): Promise<PlannedDishView | null> {
  const [found] = await db.select(VIEW).from(plannedDish).where(eq(plannedDish.id, id))
  return found ?? null
}

// The day's Planned Dishes on the Board other than `exceptId`, numbered
// from 0 in their order, as the SELECT of a `from`.
function daysOthers(boardId: string, day: string, exceptId: string) {
  return sql`select ${plannedDish.id} as id,
      row_number() over (order by ${plannedDish.position}, ${plannedDish.plannedAt}, ${plannedDish.id}) - 1 as rank
    from ${plannedDish} join ${dish} on ${dish.id} = ${plannedDish.dishId}
    where ${and(onBoard(boardId), sql`${plannedDish.day} = ${day}::date`, sql`${plannedDish.id} <> ${exceptId}`)}`
}

// Where a Planned Dish lands among the day's others: at `index`, or at the
// end if there are fewer; without one, at the end.
function landingPosition(boardId: string, day: string, exceptId: string, index: number | undefined) {
  const others = sql`(select count(*) from (${daysOthers(boardId, day, exceptId)}) others)`
  return index === undefined ? others : sql`least(${index}::int, ${others})`
}

// Plans the Dish on a day, at `index` among the day's Planned Dishes or at
// its end. Null unless the Dish is on the Board and not archived; 'taken' if
// `id` (made on the device, ADR 0012) is another Planned Dish's.
export async function planDish(
  boardId: string,
  userId: string,
  { id, dishId, day, index }: { id: string, dishId: string, day: string, index?: number },
): Promise<PlannedDishView | 'taken' | null> {
  if (await viewOf(id)) return 'taken'
  const plannable = sql`exists (select 1 from ${dish} where ${and(eq(dish.id, dishId), onBoard(boardId))})`
  try {
    await runAtomic(d => [
      // Leaves the place free, like a drop in a Column (renumberForDrop).
      ...index === undefined
        ? []
        : [d.execute(sql`
            with others as (${daysOthers(boardId, day, id)})
            update ${plannedDish} set position = case when others.rank < ${index}::int then others.rank else others.rank + 1 end
            from others where ${plannedDish.id} = others.id and ${plannable}
          `)],
      withEvents(
        d,
        sql`insert into ${plannedDish} (id, dish_id, day, position, planned_by)
          select ${id}, ${dish.id}, ${day}::date, ${landingPosition(boardId, day, id, index)}, ${userId}
          from ${dish} where ${and(eq(dish.id, dishId), onBoard(boardId))}
          returning id, dish_id, day, position`,
        plannedDishEvent('dish_planned', userId),
      ),
    ])
  }
  catch (err) {
    // The same id, planned at the same moment, got there first.
    if (isUniqueViolation(err)) return 'taken'
    throw err
  }
  return viewOf(id)
}

// Moves the Planned Dish to a day, at `index` among that day's others or at
// its end (within its own day too: that reorders it). Null unless it is on
// the Board and its Dish isn't archived. The Event Log has one event, for it
// alone, not for the ones the renumbering shifted.
export async function movePlannedDish(
  boardId: string,
  userId: string,
  id: string,
  { day, index }: { day: string, index?: number },
): Promise<PlannedDishView | null> {
  const movable = sql`exists (
    select 1 from ${plannedDish} join ${dish} on ${dish.id} = ${plannedDish.dishId}
    where ${and(eq(plannedDish.id, id), onBoard(boardId))}
  )`
  await runAtomic(d => [
    withEvents(
      d,
      index === undefined
        // To the end of the day: it alone changes.
        ? sql`update ${plannedDish} set day = ${day}::date, position = ${sql`coalesce((select max(p.position) + 1
              from ${plannedDish} p join ${dish} on ${dish.id} = p.dish_id
              where ${and(onBoard(boardId), sql`p.day = ${day}::date`, sql`p.id <> ${id}`)}), 0)`}
          where ${and(eq(plannedDish.id, id), movable)}
          returning id, dish_id, day, position`
        // Numbers the day afresh, leaving the place free for it.
        : sql`with others as (${daysOthers(boardId, day, id)})
          update ${plannedDish} set
            day = ${day}::date,
            position = case when ${plannedDish.id} = ${id} then least(${index}::int, (select count(*) from others))
              when (select rank from others where others.id = ${plannedDish.id}) < ${index}::int then (select rank from others where others.id = ${plannedDish.id})
              else (select rank from others where others.id = ${plannedDish.id}) + 1 end
          where ${and(movable, sql`(${plannedDish.id} = ${id} or ${plannedDish.id} in (select id from others))`)}
          returning id, dish_id, day, position`,
      plannedDishEvent('planned_dish_moved', userId, id),
      { earlier: sql`select ${plannedDish.id}, ${plannedDish.day} from ${plannedDish} where ${eq(plannedDish.id, id)}` },
    ),
  ])
  return viewOf(id)
}

// Takes the Planned Dish off the plan; its Dish stays where it is. False
// unless it was on the Board with its Dish not archived.
export async function unplanDish(boardId: string, userId: string, id: string): Promise<boolean> {
  const before = await plannedDishBoard(id)
  if (before?.boardId !== boardId) return false
  await runAtomic(d => [
    withEvents(
      d,
      sql`delete from ${plannedDish}
        where ${and(eq(plannedDish.id, id), sql`${plannedDish.dishId} in (select ${dish.id} from ${dish} where ${onBoard(boardId)})`)}
        returning id, dish_id`,
      plannedDishEvent('dish_unplanned', userId),
    ),
  ])
  return true
}
