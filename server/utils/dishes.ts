import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, exists, ilike, inArray, isNull, ne, or, sql, type SQL } from 'drizzle-orm'
import type { Placeholder } from '../../shared/placeholders'
import type { SourceKind } from '../source-lookup'
import { db, runAtomic, type Db } from '../db'
import { boardColumn, cooking, dish, membership, user } from '../db/schema'
import { cookingsByDish, type CookingView } from './cookings'

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
  // Its Cooking History, newest first; "N× gekocht" counts it.
  cookings: CookingView[]
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
  const views = await toViews(rows)
  rows.forEach((row, i) => byColumn.get(row.columnId)?.push(views[i]!))
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

function toView({ columnId: _, sourceLink, sourceKind, adderId, adderName, adderImage, ...row }: DishRow, cookings: CookingView[]): DishView {
  return {
    ...row,
    source: sourceLink && sourceKind ? { link: sourceLink, kind: sourceKind } : null,
    addedBy: adderId ? { id: adderId, name: adderName ?? '', image: adderImage } : null,
    createdAt: row.createdAt.toISOString(),
    cookings,
  }
}

// The rows as Dishes, each with its Cooking History.
async function toViews(rows: DishRow[]): Promise<DishView[]> {
  const cookings = await cookingsByDish(rows.map(row => row.id))
  return rows.map(row => toView(row, cookings.get(row.id) ?? []))
}

// The one Dish matching `where`, if any.
async function findDish(where: SQL | undefined): Promise<DishView | null> {
  const [view] = await toViews(await selectDishes().where(where))
  return view ?? null
}

// What editing a Dish may change (PRD story 43); fields left out stay as
// they are. `imageUrl` must already be a stored image, never a third-party link.
export type DishChanges = Partial<Pick<NewDish, 'title' | 'note' | 'source' | 'imageUrl' | 'placeholder'>>

// The Dish, if it is on a Board the user is a Member of, deleted or not.
function onMembersBoardIncludingDeleted(dishId: string, userId: string) {
  return and(
    eq(dish.id, dishId),
    inArray(dish.boardId, db.select({ id: membership.boardId }).from(membership).where(eq(membership.userId, userId))),
  )
}

// The Dish, if it is on a Board the user is a Member of and not deleted.
function onMembersBoard(dishId: string, userId: string) {
  return and(onMembersBoardIncludingDeleted(dishId, userId), isNull(dish.deletedAt))
}

// Whether the Dish exists on a Board the user is a Member of.
export async function isDishMember(dishId: string, userId: string): Promise<boolean> {
  const [found] = await db.select({ id: dish.id }).from(dish).where(onMembersBoard(dishId, userId))
  return found !== undefined
}

// The Board a Dish is on, Member or not; null if it is missing or deleted.
export async function boardOfDish(dishId: string): Promise<string | null> {
  const [found] = await db.select({ boardId: dish.boardId }).from(dish).where(and(eq(dish.id, dishId), isNull(dish.deletedAt)))
  return found?.boardId ?? null
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

  return findDish(target)
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
  const target = onMembersBoardIncludingDeleted(dishId, userId)
  await db.update(dish).set({ deletedAt: null }).where(target)
  return findDish(target)
}

// What moving a Dish answers: the Dish, and the Cooking the move recorded, if any.
export type MovedDish = DishView & { cooking?: CookingView }

// Moves a Dish to the top of a Column (PRD story 33), on its own Board or
// another one the user is a Member of (story 46), where it keeps its Cooking
// History; one already in that Column stays where it is. With an `index` (drag and drop,
// PRD stories 31, 32, 34) it goes to that place among the Column's other
// Dishes instead, in its own Column too, or to the end if the Column is
// shorter. Moving it into the Gekocht Column records a Cooking (PRD story
// 49); with `cook`, so does a move within it (story 55). Null unless the
// Dish and the Column are both on Boards the user is a Member of, and the
// Dish isn't deleted.
export async function moveDish(
  dishId: string,
  userId: string,
  columnId: string,
  { index, cook = false }: { index?: number, cook?: boolean } = {},
): Promise<MovedDish | null> {
  const target = onMembersBoard(dishId, userId)
  const movable = movableTo(target, userId, columnId)
  const cookingId = randomUUID()
  await runAtomic(d => [
    // First, so it still sees the Column the Dish comes from.
    d.execute(sql`
      insert into ${cooking} (id, dish_id, recorded_by)
      select ${cookingId}, ${dish.id}, ${userId} from ${dish}
      where ${and(movable, cook ? undefined : ne(dish.columnId, columnId))}
        and exists (select 1 from ${boardColumn} where ${boardColumn.id} = ${columnId} and ${boardColumn.isGekocht})
    `),
    index === undefined ? toTop(d, columnId, movable) : renumberForDrop(d, dishId, columnId, index, movable),
  ])

  const moved = await findDish(and(target, eq(dish.columnId, columnId)))
  const recorded = moved?.cookings.find(c => c.id === cookingId)
  return moved && recorded ? { ...moved, cooking: recorded } : moved
}

// "Gekocht ✓" (PRD story 35): records a Cooking and moves the Dish to the
// top of its Board's Gekocht Column; one already there stays where it is.
// Null unless the Dish is on a Board the user is a Member of and not deleted.
export async function cookDish(dishId: string, userId: string): Promise<MovedDish | null> {
  const [gekocht] = await db
    .select({ id: boardColumn.id })
    .from(dish)
    .innerJoin(boardColumn, and(eq(boardColumn.boardId, dish.boardId), eq(boardColumn.isGekocht, true)))
    .where(onMembersBoard(dishId, userId))
  return gekocht ? moveDish(dishId, userId, gekocht.id, { cook: true }) : null
}

// "Rückgängig" after cooking (PRD story 51): removes the Cooking for good
// and puts its Dish back at `index` in the Column it came from. Null unless
// the Dish is still in the Gekocht Column (nobody moved it on meanwhile) and
// that Column is on its Board. The caller has checked that the user may see
// the Cooking (cookingDishId).
export async function undoCooking(cookingId: string, dishId: string, userId: string, columnId: string, index: number): Promise<DishView | null> {
  const stillCooked = inArray(dish.columnId, db.select({ id: boardColumn.id }).from(boardColumn).where(eq(boardColumn.isGekocht, true)))
  const movable = movableTo(and(onMembersBoard(dishId, userId), stillCooked), userId, columnId)
  await runAtomic(d => [
    d.delete(cooking).where(and(
      eq(cooking.id, cookingId),
      eq(cooking.dishId, dishId),
      exists(db.select({ id: dish.id }).from(dish).where(movable)),
    )),
    renumberForDrop(d, dishId, columnId, index, movable),
  ])
  return findDish(and(onMembersBoard(dishId, userId), eq(dish.columnId, columnId)))
}

// The Dish `target`, if the Column is on a Board the user is a Member of:
// its own, or another one (PRD story 46).
function movableTo(target: SQL | undefined, userId: string, columnId: string) {
  return and(
    target,
    exists(db
      .select({ id: boardColumn.id })
      .from(boardColumn)
      .innerJoin(membership, and(eq(membership.boardId, boardColumn.boardId), eq(membership.userId, userId)))
      .where(eq(boardColumn.id, columnId))),
  )
}

// The Board of the Column, for a Dish moving into it.
function boardOf(columnId: string) {
  return sql`(select ${boardColumn.boardId} from ${boardColumn} where ${boardColumn.id} = ${columnId})`
}

// Moves a Dish to the top of a Column, if `movable`; one already in that
// Column stays where it is.
function toTop(d: Db, columnId: string, movable: SQL | undefined) {
  return d
    .update(dish)
    .set({
      columnId,
      boardId: boardOf(columnId),
      position: sql`case when ${dish.columnId} = ${columnId} then ${dish.position}
        else (select coalesce(min(${dish.position}), 0) - 1 from ${dish} where ${dish.columnId} = ${columnId}) end`,
    })
    .where(movable)
}

// Drops a Dish at `index` in a Column, if `movable`: one statement numbers
// the Column afresh, 0, 1, 2…, leaving that place free for the Dish. Deleted
// Dishes keep their position, so undo still puts them back about where they were.
function renumberForDrop(d: Db, dishId: string, columnId: string, index: number, movable: SQL | undefined) {
  const others = d.$with('others').as(
    d
      .select({
        id: dish.id,
        rank: sql<number>`row_number() over (order by ${dish.position}, ${dish.createdAt} desc, ${dish.id} desc) - 1`.as('rank'),
      })
      .from(dish)
      .where(and(
        eq(dish.columnId, columnId),
        isNull(dish.deletedAt),
        ne(dish.id, dishId),
        exists(db.select({ id: dish.id }).from(dish).where(movable)),
      )),
  )
  return d
    .with(others)
    .update(dish)
    .set({
      columnId,
      boardId: boardOf(columnId),
      position: sql`case when ${dish.id} = ${dishId} then ${index}::integer
        else (select case when rank < ${index}::integer then rank else rank + 1 end from ${others} where ${others.id} = ${dish.id}) end`,
    })
    .where(or(
      and(eq(dish.id, dishId), movable),
      inArray(dish.id, d.select({ id: others.id }).from(others)),
    ))
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

// The Board's Dishes whose title contains the query, ignoring case (PRD
// story 36), in Board order: Column by Column, each in its own order.
// Deleted Dishes don't count.
export async function searchDishes(boardId: string, query: string): Promise<DishView[]> {
  const rows = await selectDishes()
    .innerJoin(boardColumn, eq(boardColumn.id, dish.columnId))
    .where(and(eq(dish.boardId, boardId), isNull(dish.deletedAt), ilike(dish.title, `%${escapeLike(query)}%`)))
    .orderBy(asc(boardColumn.position), asc(dish.position), desc(dish.createdAt), desc(dish.id))
  return toViews(rows)
}

// So %, _ and \ in a query match themselves (\ is Postgres's LIKE escape).
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, c => `\\${c}`)
}

// Adds a Dish at the top of the Board's first Column (PRD story 13), skipping
// the Gekocht Column: a new Dish hasn't been cooked. Null unless the user is
// a Member of the Board.
export async function addDish(
  boardId: string,
  adder: Omit<DishAdder, 'image'> & { image?: string | null },
  input: NewDish,
): Promise<DishView | null> {
  const [firstColumn] = await db
    .select({ id: boardColumn.id })
    .from(boardColumn)
    .innerJoin(membership, and(eq(membership.boardId, boardColumn.boardId), eq(membership.userId, adder.id)))
    .where(and(eq(boardColumn.boardId, boardId), eq(boardColumn.isGekocht, false)))
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
    cookings: [],
  }
}
