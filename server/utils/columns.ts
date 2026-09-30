import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { db, runAtomic, type Db } from '../db'
import { boardColumn, dish, membership } from '../db/schema'
import { isMember } from './boards'

// Columns (CONTEXT.md: Column, Gekocht Column), as Board settings manages
// them (PRD stories 57–60). Every Board keeps exactly one Gekocht Column and
// at least one other Column, where new Dishes go.

export interface ColumnView {
  id: string
  name: string
  isGekocht: boolean
}

const columnView = { id: boardColumn.id, name: boardColumn.name, isGekocht: boardColumn.isGekocht }

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
// exactly one. Null unless the user is a Member.
export async function addColumn(boardId: string, userId: string, name: string): Promise<ColumnView | null> {
  if (!await isMember(boardId, userId)) return null
  const id = randomUUID()
  await runAtomic(d => [
    lockColumns(d, boardId),
    d.insert(boardColumn).values({
      id,
      boardId,
      name,
      position: sql`(select coalesce(max(${boardColumn.position}), -1) + 1 from ${boardColumn} where ${boardColumn.boardId} = ${boardId})`,
    }),
  ])
  const [added] = await db.select(columnView).from(boardColumn).where(eq(boardColumn.id, id))
  return added ?? null
}

// Renames a Column, the Gekocht Column too. Null unless it is on a Board the
// user is a Member of.
export async function renameColumn(columnId: string, userId: string, name: string): Promise<ColumnView | null> {
  const [renamed] = await db.update(boardColumn).set({ name }).where(onMembersBoard(columnId, userId)).returning(columnView)
  return renamed ?? null
}

// The Board's Columns in order.
export async function boardColumns(boardId: string): Promise<ColumnView[]> {
  return db.select(columnView).from(boardColumn).where(eq(boardColumn.boardId, boardId)).orderBy(asc(boardColumn.position))
}

// Puts the Board's Columns in the given order; the Gekocht Column can go
// anywhere. 'invalid' unless the order names each of the Board's Columns
// exactly once. Null unless the user is a Member.
export async function reorderColumns(boardId: string, userId: string, columnIds: string[]): Promise<ColumnView[] | 'invalid' | null> {
  if (!await isMember(boardId, userId)) return null
  const ids = sql`array[${sql.join(columnIds.map(id => sql`${id}::uuid`), sql`, `)}]`
  await runAtomic(d => [
    lockColumns(d, boardId),
    d
      .update(boardColumn)
      .set({ position: sql`array_position(${ids}, ${boardColumn.id}) - 1` })
      .where(and(
        eq(boardColumn.boardId, boardId),
        sql`cardinality(${ids}) = (select count(distinct x) from unnest(${ids}) as x)`,
        sql`${ids} <@ array(select ${boardColumn.id} from ${boardColumn} where ${boardColumn.boardId} = ${boardId})`,
        sql`cardinality(${ids}) = (select count(*) from ${boardColumn} where ${boardColumn.boardId} = ${boardId})`,
      )),
  ])
  const columns = await boardColumns(boardId)
  const applied = columns.length === columnIds.length && columns.every((c, i) => c.id === columnIds[i])
  return applied ? columns : 'invalid'
}

export type DeleteColumnResult = 'deleted' | 'not-found' | ColumnRefusal

type ColumnRefusal = 'gekocht' | 'last' | 'not-empty' | 'bad-target'

// Why the Column can't be deleted as asked, if it can't.
async function refusal(column: { id: string, boardId: string, isGekocht: boolean }, moveTo?: string): Promise<ColumnRefusal | null> {
  if (column.isGekocht) return 'gekocht'
  const columns = await boardColumns(column.boardId)
  if (!columns.some(c => c.id !== column.id && !c.isGekocht)) return 'last'
  if (moveTo !== undefined) return moveTo !== column.id && columns.some(c => c.id === moveTo) ? null : 'bad-target'
  const [live] = await db.select({ id: dish.id }).from(dish).where(and(eq(dish.columnId, column.id), isNull(dish.deletedAt))).limit(1)
  return live ? 'not-empty' : null
}

// Deletes a Column (PRD stories 57–60). Its Dishes go to the top of `moveTo`,
// in their order, deleted ones too (so "Rückgängig" still finds a Column);
// moved into the Gekocht Column they record no Cooking, since nobody cooked
// them. An empty Column needs no `moveTo`; Dishes deleted from it, which
// could only come back into a Column that is gone, go for good. Refused for
// the Gekocht Column, the Board's last other Column, a Column with Dishes but
// no `moveTo`, and a `moveTo` that isn't another Column of the same Board.
export async function deleteColumn(columnId: string, userId: string, moveTo?: string): Promise<DeleteColumnResult> {
  const [found] = await db
    .select({ id: boardColumn.id, boardId: boardColumn.boardId, isGekocht: boardColumn.isGekocht })
    .from(boardColumn)
    .where(onMembersBoard(columnId, userId))
  if (!found) return 'not-found'
  const refused = await refusal(found, moveTo)
  if (refused) return refused

  // Under the lock the Board's Columns can't change, only its Dishes, but
  // each statement checks again all the same: a Column changed before the
  // lock was granted leaves everything as it was, and a Dish added to this
  // Column meanwhile keeps it (Dishes already moved stay moved).
  const deletable = sql`not ${boardColumn.isGekocht} and exists (
    select 1 from ${boardColumn} as other
    where other.board_id = ${found.boardId} and other.id <> ${columnId} and not other.is_gekocht
  )`
  const stillDeletable = sql`exists (select 1 from ${boardColumn} where ${boardColumn.id} = ${columnId} and ${deletable})`
  await runAtomic(d => [
    lockColumns(d, found.boardId),
    moveTo === undefined
      ? d.delete(dish).where(and(
          eq(dish.columnId, columnId),
          isNotNull(dish.deletedAt),
          stillDeletable,
          sql`not exists (select 1 from ${dish} as live where live.column_id = ${columnId} and live.deleted_at is null)`,
        ))
      : d.execute(sql`
          with moving as (
            select id, row_number() over (order by position, created_at desc, id desc) as rank, count(*) over () as n
            from ${dish} where column_id = ${columnId}
          ), top as (
            select coalesce(min(position), 0) as position from ${dish} where column_id = ${moveTo} and deleted_at is null
          )
          update ${dish} set column_id = ${moveTo}, position = top.position - moving.n + moving.rank - 1
          from moving, top
          where ${dish.id} = moving.id and ${stillDeletable}
            and exists (select 1 from ${boardColumn} where ${boardColumn.id} = ${moveTo} and ${boardColumn.boardId} = ${found.boardId})
        `),
    d.delete(boardColumn).where(and(
      eq(boardColumn.id, columnId),
      deletable,
      sql`not exists (select 1 from ${dish} where ${dish.columnId} = ${columnId})`,
    )),
  ])

  const [left] = await db.select({ id: boardColumn.id }).from(boardColumn).where(eq(boardColumn.id, columnId))
  if (!left) return 'deleted'
  return await refusal(found, moveTo) ?? 'not-empty'
}
