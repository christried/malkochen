import { randomUUID } from 'node:crypto'
import { and, asc, eq, exists, inArray, isNull, sql } from 'drizzle-orm'
import { columnDeletion, type ColumnRefusal } from '../../shared/placement'
import { db, runAtomic, type Db } from '../db'
import { boardColumn, dish, membership } from '../db/schema'
import { membershipOf } from './boards'

// Columns (CONTEXT.md: Column, Gekocht Column), as Board settings manages
// them (PRD stories 57–60). Every Board keeps exactly one Gekocht Column and
// at least one other Column, where new Dishes go. Like the Dish functions,
// each answers null for a Column or Board that isn't there or isn't the
// user's, and checks membership in the write itself.

export interface ColumnView {
  id: string
  name: string
  // Its Column Subtitle, null if it has none.
  subtitle: string | null
  isGekocht: boolean
}

// The Gekocht Column's Column Subtitle, whatever it is called. It can't be
// changed, so it isn't stored.
export const GEKOCHT_SUBTITLE = 'Schon geschafft!'

// A Column's Column Subtitle as the app shows it.
export const columnSubtitle = sql<string | null>`case when ${boardColumn.isGekocht} then ${GEKOCHT_SUBTITLE}::text else ${boardColumn.subtitle} end`

export const columnView = { id: boardColumn.id, name: boardColumn.name, subtitle: columnSubtitle, isGekocht: boardColumn.isGekocht }

// The Column, if it is on a Board the user is a Member of.
function onMembersBoard(columnId: string, userId: string) {
  return and(
    eq(boardColumn.id, columnId),
    inArray(boardColumn.boardId, db.select({ id: membership.boardId }).from(membership).where(eq(membership.userId, userId))),
  )
}

// Adding, reordering and deleting a Board's Columns first take this lock, so
// they run one after the other per Board: two Members deleting the last two
// Columns besides Gekocht at once can't both succeed, and two Columns added
// at once don't share a place. Held until the batch commits.
function lockColumns(d: Db, boardId: string) {
  return d.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`columns:${boardId}`}, 0))`)
}

// Adds a Column at the end of the Board. Never a Gekocht Column: a Board has
// exactly one.
export async function addColumn(boardId: string, userId: string, name: string): Promise<ColumnView | null> {
  const id = randomUUID()
  await runAtomic(d => [
    lockColumns(d, boardId),
    d.execute(sql`
      insert into ${boardColumn} (id, board_id, name, position)
      select ${id}, ${boardId}, ${name},
        (select coalesce(max(position), -1) + 1 from ${boardColumn} where board_id = ${boardId})
      where ${exists(membershipOf(boardId, userId))}
    `),
  ])
  const [added] = await db.select(columnView).from(boardColumn).where(eq(boardColumn.id, id))
  return added ?? null
}

// Renames a Column, the Gekocht Column too.
export async function renameColumn(columnId: string, userId: string, name: string): Promise<ColumnView | null> {
  const [renamed] = await db.update(boardColumn).set({ name }).where(onMembersBoard(columnId, userId)).returning(columnView)
  return renamed ?? null
}

// The Board's Columns in order.
export async function boardColumns(boardId: string): Promise<ColumnView[]> {
  return db.select(columnView).from(boardColumn).where(eq(boardColumn.boardId, boardId)).orderBy(asc(boardColumn.position))
}

// Puts the Board's Columns in the given order; the Gekocht Column can go
// anywhere. Null unless the user is a Member and the order names each of the
// Board's Columns exactly once (the caller tells the two apart, as for
// moving a Dish).
export async function reorderColumns(boardId: string, userId: string, columnIds: string[]): Promise<ColumnView[] | null> {
  const ids = sql`array[${sql.join(columnIds.map(id => sql`${id}::uuid`), sql`, `)}]`
  await runAtomic(d => [
    lockColumns(d, boardId),
    d
      .update(boardColumn)
      .set({ position: sql`array_position(${ids}, ${boardColumn.id}) - 1` })
      .where(and(
        eq(boardColumn.boardId, boardId),
        exists(membershipOf(boardId, userId)),
        sql`cardinality(${ids}) = (select count(distinct x) from unnest(${ids}) as x)`,
        sql`${ids} <@ array(select ${boardColumn.id} from ${boardColumn} where ${boardColumn.boardId} = ${boardId})`,
        sql`cardinality(${ids}) = (select count(*) from ${boardColumn} where ${boardColumn.boardId} = ${boardId})`,
      )),
  ])
  const columns = await boardColumns(boardId)
  const applied = columns.length === columnIds.length && columns.every((c, i) => c.id === columnIds[i])
  return applied ? columns : null
}

interface DeletingColumn {
  id: string
  boardId: string
  isGekocht: boolean
}

// Where the Column's Dishes go when it is deleted, or why it can't be, as
// the Board is now (shared/placement.ts).
async function deleteTarget(column: DeletingColumn, moveTo?: string): Promise<{ target: string } | { refusal: ColumnRefusal }> {
  const [live] = await db.select({ id: dish.id }).from(dish).where(and(eq(dish.columnId, column.id), isNull(dish.deletedAt))).limit(1)
  const planned = columnDeletion(await boardColumns(column.boardId), column, { moveTo, hasDishes: live !== undefined })
  return 'refusal' in planned ? planned : { target: planned.target.id }
}

// Deletes a Column (PRD stories 57–60). Its Dishes go to the top of `moveTo`,
// in their order, deleted ones too; moved into the Gekocht Column they record
// no Cooking, since nobody cooked them. An empty Column needs no `moveTo`.
// Refused for the Gekocht Column, the Board's last other Column, a Column
// with Dishes but no `moveTo`, and a `moveTo` that isn't another Column of
// the same Board.
export async function deleteColumn(columnId: string, userId: string, moveTo?: string): Promise<'deleted' | ColumnRefusal | null> {
  const [found] = await db
    .select({ id: boardColumn.id, boardId: boardColumn.boardId, isGekocht: boardColumn.isGekocht })
    .from(boardColumn)
    .where(onMembersBoard(columnId, userId))
  if (!found) return null
  const planned = await deleteTarget(found, moveTo)
  if ('refusal' in planned) return planned.refusal
  const { target } = planned

  // Under the lock the Board's Columns can't change, only its Dishes, but
  // each statement checks again all the same: a Column changed before the
  // lock was granted leaves everything as it was, and a Dish added to this
  // Column meanwhile keeps it (Dishes already moved stay moved).
  const deletable = sql`not ${boardColumn.isGekocht} and exists (
    select 1 from ${boardColumn} as other
    where other.board_id = ${found.boardId} and other.id <> ${columnId} and not other.is_gekocht
  )`
  await runAtomic(d => [
    lockColumns(d, found.boardId),
    // Above everything in the target, deleted Dishes included, so a Dish
    // brought back later doesn't share a place with a moved one.
    d.execute(sql`
      with moving as (
        select id, row_number() over (order by position, created_at desc, id desc) as rank, count(*) over () as n
        from ${dish} where column_id = ${columnId}
      ), top as (
        select coalesce(min(position), 0) as position from ${dish} where column_id = ${target}
      )
      update ${dish} set column_id = ${target}, position = top.position - moving.n + moving.rank - 1
      from moving, top
      where ${dish.id} = moving.id
        and exists (select 1 from ${boardColumn} where ${boardColumn.id} = ${columnId} and ${deletable})
        and exists (select 1 from ${boardColumn} where ${boardColumn.id} = ${target} and ${boardColumn.boardId} = ${found.boardId})
        ${moveTo === undefined ? sql`and not exists (select 1 from ${dish} as live where live.column_id = ${columnId} and live.deleted_at is null)` : sql``}
    `),
    d.delete(boardColumn).where(and(
      eq(boardColumn.id, columnId),
      deletable,
      sql`not exists (select 1 from ${dish} where ${dish.columnId} = ${columnId})`,
    )),
  ])

  const [left] = await db.select({ id: boardColumn.id }).from(boardColumn).where(eq(boardColumn.id, columnId))
  if (!left) return 'deleted'
  const now = await deleteTarget(found, moveTo)
  return 'refusal' in now ? now.refusal : 'not-empty'
}
