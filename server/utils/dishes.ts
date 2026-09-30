import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceKind } from '../source-lookup'
import { db } from '../db'
import { boardColumn, dish, membership, user } from '../db/schema'

// The Member who added a Dish, as the card shows them.
export interface DishAdder {
  id: string
  name: string
  image: string | null
}

// Where a Dish came from (CONTEXT.md: Source).
export interface DishSource {
  link: string
  kind: SourceKind
}

export interface DishView {
  id: string
  title: string
  note: string | null
  source: DishSource | null
  // The stored copy of the Source image; null shows the Placeholder.
  imageUrl: string | null
  placeholder: Placeholder
  // Null once the account that added it is gone.
  addedBy: DishAdder | null
  createdAt: string
}

// What saving a Dish answers: the Dish, and whether a Source image that was
// asked for could not be stored (the Dish then shows its Placeholder).
export type SavedDish = DishView & { imageNotStored?: true }

export interface NewDish {
  title: string
  note: string | null
  source: DishSource | null
  // Must already be a stored image (Image Store), never a third-party link.
  imageUrl: string | null
  placeholder: Placeholder
}

// The Dishes of the given Columns, grouped by Column and in Board order: by
// position, and a tie (two Dishes added at the same moment) newest first.
export async function dishesByColumn(columnIds: string[]): Promise<Map<string, DishView[]>> {
  const byColumn = new Map<string, DishView[]>(columnIds.map(id => [id, []]))
  if (columnIds.length === 0) return byColumn

  const rows = await selectDishes()
    .where(and(inArray(dish.columnId, columnIds), isNull(dish.deletedAt)))
    .orderBy(asc(dish.position), desc(dish.createdAt), desc(dish.id))
  for (const row of rows) byColumn.get(row.columnId)?.push(toView(row))
  return byColumn
}

function selectDishes() {
  return db
    .select({
      id: dish.id,
      columnId: dish.columnId,
      title: dish.title,
      note: dish.note,
      sourceLink: dish.sourceLink,
      sourceKind: dish.sourceKind,
      imageUrl: dish.imageUrl,
      placeholder: dish.placeholder,
      createdAt: dish.createdAt,
      adderId: user.id,
      adderName: user.name,
      adderImage: user.image,
    })
    .from(dish)
    .leftJoin(user, eq(user.id, dish.addedBy))
    .$dynamic()
}

type DishRow = Awaited<ReturnType<typeof selectDishes>>[number]

function toView({ columnId: _, sourceLink, sourceKind, adderId, adderName, adderImage, ...row }: DishRow): DishView {
  return {
    ...row,
    source: sourceLink && sourceKind ? { link: sourceLink, kind: sourceKind } : null,
    addedBy: adderId ? { id: adderId, name: adderName ?? '', image: adderImage } : null,
    createdAt: row.createdAt.toISOString(),
  }
}

// What editing a Dish may change (PRD story 43); fields left out stay as
// they are. `imageUrl` must already be a stored image, never a third-party link.
export type DishChanges = Partial<Pick<NewDish, 'title' | 'note' | 'source' | 'imageUrl' | 'placeholder'>>

// The Dish, if it is on a Board the user is a Member of, deleted or not.
function onMembersBoardOrDeleted(dishId: string, userId: string) {
  return and(
    eq(dish.id, dishId),
    inArray(dish.boardId, db.select({ id: membership.boardId }).from(membership).where(eq(membership.userId, userId))),
  )
}

// The Dish, if it is on a Board the user is a Member of and not deleted.
function onMembersBoard(dishId: string, userId: string) {
  return and(onMembersBoardOrDeleted(dishId, userId), isNull(dish.deletedAt))
}

// Whether the Dish exists on a Board the user is a Member of.
export async function isDishMember(dishId: string, userId: string): Promise<boolean> {
  const [found] = await db.select({ id: dish.id }).from(dish).where(onMembersBoard(dishId, userId))
  return found !== undefined
}

// Edits a Dish. Null unless it exists and the user is a Member of its Board.
export async function editDish(dishId: string, userId: string, changes: DishChanges): Promise<DishView | null> {
  const { source, ...rest } = changes
  const values = {
    ...rest,
    ...source !== undefined && { sourceLink: source?.link ?? null, sourceKind: source?.kind ?? null },
  }
  const target = onMembersBoard(dishId, userId)
  if (Object.keys(values).length > 0) {
    const updated = await db.update(dish).set(values).where(target).returning({ id: dish.id })
    if (updated.length === 0) return null
  }

  const [row] = await selectDishes().where(target)
  return row ? toView(row) : null
}

// Deletes a Dish (PRD story 47): a soft delete, so it can be restored. False
// unless it is on a Board the user is a Member of and not deleted yet.
export async function deleteDish(dishId: string, userId: string): Promise<boolean> {
  const deleted = await db.update(dish).set({ deletedAt: new Date() }).where(onMembersBoard(dishId, userId)).returning({ id: dish.id })
  return deleted.length > 0
}

// Undoes deleting a Dish. It kept its Column and position, so it is back
// where it was. Null unless it is on a Board the user is a Member of.
export async function restoreDish(dishId: string, userId: string): Promise<DishView | null> {
  const target = onMembersBoardOrDeleted(dishId, userId)
  await db.update(dish).set({ deletedAt: null }).where(target)
  const [row] = await selectDishes().where(target)
  return row ? toView(row) : null
}

// A Dish already on a Board with the Source being added (PRD story 24).
export interface DuplicateDish {
  id: string
  title: string
  columnName: string
}

// The Board's newest Dish whose Source is this canonical link, if any.
// Deleted Dishes don't count.
export async function dishWithSource(boardId: string, canonicalLink: string): Promise<DuplicateDish | null> {
  const [found] = await db
    .select({ id: dish.id, title: dish.title, columnName: boardColumn.name })
    .from(dish)
    .innerJoin(boardColumn, eq(boardColumn.id, dish.columnId))
    .where(and(eq(dish.boardId, boardId), eq(dish.sourceLink, canonicalLink), isNull(dish.deletedAt)))
    .orderBy(desc(dish.createdAt), desc(dish.id))
    .limit(1)
  return found ?? null
}

// Adds a Dish at the top of the Board's first Column (PRD story 13). Null
// unless the user is a Member of the Board.
export async function addDish(
  boardId: string,
  adder: Omit<DishAdder, 'image'> & { image?: string | null },
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
      sourceLink: input.source?.link ?? null,
      sourceKind: input.source?.kind ?? null,
      imageUrl: input.imageUrl,
      placeholder: input.placeholder,
      addedBy: adder.id,
    })
    .returning({ id: dish.id, createdAt: dish.createdAt })
  if (!created) throw new Error(`Dish was not added to Board ${boardId}`)

  return {
    id: created.id,
    title: input.title,
    note: input.note,
    source: input.source,
    imageUrl: input.imageUrl,
    placeholder: input.placeholder,
    addedBy: { id: adder.id, name: adder.name, image: adder.image ?? null },
    createdAt: created.createdAt.toISOString(),
  }
}
