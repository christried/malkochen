import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { db, runAtomic } from '../db'
import { dish, membership, plannedDish } from '../db/schema'
import { plannedDishEvent, withEvents } from './events'
import { madeAtOrNow, writeOnce, type DeviceIdStanding } from './late-changes'

// The Week Plan (CONTEXT.md: Week Plan, Planned Dish; ADR 0014): the Dishes
// a Board's Members put on days, and who cooks them. Planning, moving,
// unplanning and setting the cook are four small writes, each one atomic with
// its Event Log event and each checking what it needs in the same statement,
// so nothing races between check and write. They write nothing to the Dish
// History and notify nobody. The Permission to move Dishes is checked by the
// caller (permission-checks.ts).

// A Planned Dish as the Board load carries it: its Dish and its day, a
// calendar date in Europe/Berlin as 'YYYY-MM-DD'; and who cooks it, a Member
// of the Board, or null for nobody.
export interface PlannedDishView {
  id: string
  dishId: string
  day: string
  cookId: string | null
}

// A Planned Dish is on a Board through its Dish, and counts only while that
// Dish isn't archived (archiving hides the row and keeps it).
function onBoard(boardId: string) {
  return and(eq(dish.boardId, boardId), isNull(dish.deletedAt))
}

const VIEW = { id: plannedDish.id, dishId: plannedDish.dishId, day: plannedDish.day, cookId: plannedDish.cookId }

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

// The place after the day's last Planned Dish other than `exceptId`, as an
// expression: one past the highest number, which an archived Dish leaving a
// gap doesn't change (a count of them would land mid-day), or 0 for an empty
// day.
function endOfDay(boardId: string, day: string, exceptId: string) {
  return sql`coalesce((select max(p.position) + 1
    from ${plannedDish} p join ${dish} on ${dish.id} = p.dish_id
    where ${and(onBoard(boardId), sql`p.day = ${day}::date`, sql`p.id <> ${exceptId}`)}), 0)`
}

// Where a Planned Dish lands among the day's others: at `index`, or at the
// end if there are fewer; without one, at the end.
function landingPosition(boardId: string, day: string, exceptId: string, index: number | undefined) {
  if (index === undefined) return endOfDay(boardId, day, exceptId)
  const others = sql`(select count(*) from (${daysOthers(boardId, day, exceptId)}) others)`
  return sql`least(${index}::int, ${others})`
}

// How the id a device made for a new Planned Dish stands (late-changes.ts):
// a repeat if it is a Planned Dish of that Dish that the user planned
// (archived Dish or not), taken if it is any other's. One that is gone (taken
// off the plan since) is free again, as a Dish deleted for good is
// (dishIdStanding): the queue sends a device's writes in order, so a repeat
// of a plan never arrives after the unplan that followed it.
export async function plannedDishIdStanding(id: string, dishId: string, userId: string): Promise<DeviceIdStanding> {
  const [found] = await db.select({ dishId: plannedDish.dishId, plannedBy: plannedDish.plannedBy }).from(plannedDish).where(eq(plannedDish.id, id))
  if (!found) return 'free'
  return found.dishId === dishId && found.plannedBy === userId ? 'repeat' : 'taken'
}

// The Planned Dish as the Board shows it: null if it is gone, or its Dish is
// archived or not on the Board.
async function visibleView(boardId: string, id: string): Promise<PlannedDishView | null> {
  const [found] = await db
    .select(VIEW)
    .from(plannedDish)
    .innerJoin(dish, eq(dish.id, plannedDish.dishId))
    .where(and(eq(plannedDish.id, id), onBoard(boardId)))
  return found ?? null
}

// Plans the Dish on a day, at `index` among the day's Planned Dishes or at
// its end, dated `madeAt` if it was made offline (late-changes.ts). Null
// unless the Dish is on the Board and not archived (a repeat whose Dish was
// archived since too); 'taken' if `id` (made on the device, ADR 0012) is
// another user's or another Dish's Planned Dish. A repeat (the same id, Dish
// and user) plans nothing again and answers the Planned Dish as it is now.
export async function planDish(
  boardId: string,
  userId: string,
  { id, dishId, day, index, madeAt }: { id: string, dishId: string, day: string, index?: number, madeAt?: string },
): Promise<PlannedDishView | 'taken' | null> {
  const plannable = sql`exists (select 1 from ${dish} where ${and(eq(dish.id, dishId), onBoard(boardId))})`
  const standing = await writeOnce(() => plannedDishIdStanding(id, dishId, userId), async () => {
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
        sql`insert into ${plannedDish} (id, dish_id, day, position, planned_by, planned_at)
          select ${id}, ${dish.id}, ${day}::date, ${landingPosition(boardId, day, id, index)}, ${userId}, ${madeAtOrNow(madeAt)}
          from ${dish} where ${and(eq(dish.id, dishId), onBoard(boardId))}
          returning id, dish_id, day, position`,
        plannedDishEvent('dish_planned', userId),
      ),
    ])
  })
  if (standing === 'taken') return 'taken'
  return visibleView(boardId, id)
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
        ? sql`update ${plannedDish} set day = ${day}::date, position = ${endOfDay(boardId, day, id)}
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
// unless this took it off: it was on the Board with its Dish not archived,
// and nothing else took it off first.
export async function unplanDish(boardId: string, userId: string, id: string): Promise<boolean> {
  const [deleted] = await runAtomic(d => [
    withEvents(
      d,
      sql`delete from ${plannedDish}
        where ${and(eq(plannedDish.id, id), sql`${plannedDish.dishId} in (select ${dish.id} from ${dish} where ${onBoard(boardId)})`)}
        returning id, dish_id`,
      plannedDishEvent('dish_unplanned', userId),
    ),
  ])
  return (deleted?.rows.length ?? 0) > 0
}

// Sets who cooks the Planned Dish, or clears the cook (null). The cook must be
// a Member of the Board (a row in membership: the Operator visiting is not
// one), which the statement itself checks, so a Member leaving at the same
// moment can't slip in. Setting the cook it already has changes nothing: no
// Board Version move, no event. Null unless the Planned Dish is on the Board
// with its Dish not archived; 'not-member' if the cook isn't a Member (what
// the statement found, not what the Planned Dish looks like afterwards).
export async function setPlannedDishCook(
  boardId: string,
  userId: string,
  id: string,
  cookId: string | null,
): Promise<PlannedDishView | 'not-member' | null> {
  const isMember = cookId === null
    ? sql`true`
    : sql`exists (select 1 from ${membership} where ${and(eq(membership.boardId, boardId), eq(membership.userId, cookId))})`
  const [updated] = await runAtomic(d => [
    withEvents(
      d,
      sql`update ${plannedDish} set cook_id = ${cookId}
        where ${and(
          eq(plannedDish.id, id),
          sql`${plannedDish.dishId} in (select ${dish.id} from ${dish} where ${onBoard(boardId)})`,
          sql`${plannedDish.cookId} is distinct from ${cookId}::text`,
          isMember,
        )}
        returning id, dish_id, cook_id`,
      plannedDishEvent('planned_dish_cook_set', userId),
    ),
  ])
  if ((updated?.rows.length ?? 0) > 0) return viewOf(id)
  // It changed nothing: the Planned Dish isn't there for this Board, or it has
  // this cook already, or the cook isn't a Member.
  const now = await visibleView(boardId, id)
  if (!now) return null
  return now.cookId === cookId ? now : 'not-member'
}
