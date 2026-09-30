import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Placeholder } from '../../shared/placeholders'
import { db } from '../db'
import { boardColumn, dish, membership, user } from '../db/schema'

export interface DishView {
  id: string
  title: string
  note: string | null
  placeholder: Placeholder
  // Null once the account that added it is gone.
  addedBy: { id: string, name: string, image: string | null } | null
  createdAt: string
}

export interface NewDish {
  title: string
  note: string | null
  placeholder: Placeholder
}

// The Dishes of the given Columns, grouped by Column and in Board order: by
// position, and a tie (two Dishes added at the same moment) newest first.
export async function dishesByColumn(columnIds: string[]): Promise<Map<string, DishView[]>> {
  const byColumn = new Map<string, DishView[]>(columnIds.map(id => [id, []]))
  if (columnIds.length === 0) return byColumn

  const rows = await db
    .select({
      id: dish.id,
      columnId: dish.columnId,
      title: dish.title,
      note: dish.note,
      placeholder: dish.placeholder,
      createdAt: dish.createdAt,
      adderId: user.id,
      adderName: user.name,
      adderImage: user.image,
    })
    .from(dish)
    .leftJoin(user, eq(user.id, dish.addedBy))
    .where(inArray(dish.columnId, columnIds))
    .orderBy(asc(dish.position), desc(dish.createdAt), desc(dish.id))

  for (const { columnId, adderId, adderName, adderImage, ...row } of rows) {
    byColumn.get(columnId)?.push({
      ...row,
      placeholder: row.placeholder as Placeholder,
      addedBy: adderId ? { id: adderId, name: adderName ?? '', image: adderImage } : null,
      createdAt: row.createdAt.toISOString(),
    })
  }
  return byColumn
}

// Adds a Dish at the top of the Board's first Column (PRD story 13). Null
// unless the user is a Member of the Board.
export async function addDish(
  boardId: string,
  adder: { id: string, name: string, image?: string | null },
  input: NewDish,
): Promise<DishView | null> {
  const [firstColumn] = await db
    .select({ id: boardColumn.id })
    .from(boardColumn)
    .innerJoin(membership, and(eq(membership.boardId, boardColumn.boardId), eq(membership.userId, adder.id)))
    .where(eq(boardColumn.boardId, boardId))
    .orderBy(asc(boardColumn.position))
    .limit(1)
  if (!firstColumn) return null

  const [created] = await db
    .insert(dish)
    .values({
      boardId,
      columnId: firstColumn.id,
      position: sql`(select coalesce(min(${dish.position}), 0) - 1 from ${dish} where ${dish.columnId} = ${firstColumn.id})`,
      title: input.title,
      note: input.note,
      placeholder: input.placeholder,
      addedBy: adder.id,
    })
    .returning({ id: dish.id, createdAt: dish.createdAt })
  if (!created) throw new Error(`Dish was not added to Board ${boardId}`)

  return {
    id: created.id,
    ...input,
    addedBy: { id: adder.id, name: adder.name, image: adder.image ?? null },
    createdAt: created.createdAt.toISOString(),
  }
}
