import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, exists, ilike, inArray, isNull, ne, notExists, or, sql, type SQL } from 'drizzle-orm'
import { FOCUS_CENTRE, type ImageFocus } from '../../shared/image-focus'
import type { Placeholder } from '../../shared/placeholders'
import { columnForNewDishes } from '../../shared/placement'
import type { SourceKind } from '../source-lookup'
import { db, runAtomic, type Db } from '../db'
import { boardColumn, cooking, dish, membership, user } from '../db/schema'
import { cookingsByDish, undoableCooking, type CookingView } from './cookings'
import { pictureOf, shownAs, usernameOf } from './people'

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
  // Its short code, which ends its Address (shared/address.ts).
  code: string
  title: string
  note: string | null
  source: DishSource | null
  // Who published the Source (CONTEXT.md: Creator); null if nobody is named.
  creator: string | null
  // The stored copy of the Source image; null shows the Placeholder.
  imageUrl: string | null
  // The part of that image a frame cropping it shows (shared/image-focus.ts).
  imageFocus: ImageFocus
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

// Where a Dish is: its Board, its Column, and its index among that Column's
// Dishes in Board order.
export interface DishPlacement {
  boardId: string
  columnId: string
  index: number
}

// What a Dish write answers with (a "placed Dish"): the Dish and where it now
// is, so the app settles to where the server put it.
export type PlacedDish = DishView & { placement: DishPlacement }

// What adding a Dish answers: the Dish placed, and whether its Source image
// could not be stored, as for SavedDish.
export type AddedDish = PlacedDish & { imageNotStored?: true }

export interface NewDish {
  title: string
  note: string | null
  source: DishSource | null
  creator: string | null
  // Must already be a stored image (Image Store), never a third-party link.
  imageUrl: string | null
  // Where that image is shifted to; the centre if left out. Without an
  // image, always the centre.
  imageFocus?: ImageFocus
  placeholder: Placeholder
}

// Board order within a Column: by position, and a tie (two Dishes added at
// the same moment) newest first.
const BOARD_ORDER = [asc(dish.position), desc(dish.createdAt), desc(dish.id)]

// The Dishes of the given Columns, grouped by Column and in Board order.
export async function dishesByColumn(columnIds: string[]): Promise<Map<string, DishView[]>> {
  const byColumn = new Map<string, DishView[]>(columnIds.map(id => [id, []]))
  if (columnIds.length === 0) return byColumn

  const rows = await selectDishes()
    .where(and(inArray(dish.columnId, columnIds), isNull(dish.deletedAt)))
    .orderBy(...BOARD_ORDER)
  const views = await toViews(rows)
  rows.forEach((row, i) => byColumn.get(row.columnId)?.push(views[i]!))
  return byColumn
}

function selectDishes() {
  return db
    .select({
      id: dish.id,
      code: dish.code,
      columnId: dish.columnId,
      title: dish.title,
      note: dish.note,
      sourceLink: dish.sourceLink,
      sourceKind: dish.sourceKind,
      creator: dish.creator,
      imageUrl: dish.imageUrl,
      imageFocusX: dish.imageFocusX,
      imageFocusY: dish.imageFocusY,
      placeholder: dish.placeholder,
      createdAt: dish.createdAt,
      adderId: user.id,
      adderName: usernameOf,
      adderImage: pictureOf,
    })
    .from(dish)
    .leftJoin(user, eq(user.id, dish.addedBy))
    .$dynamic()
}

type DishRow = Awaited<ReturnType<typeof selectDishes>>[number]

function toView({ columnId: _, sourceLink, sourceKind, imageFocusX, imageFocusY, adderId, adderName, adderImage, ...row }: DishRow, cookings: CookingView[]): DishView {
  return {
    ...row,
    imageFocus: { x: imageFocusX, y: imageFocusY },
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

// The Dish with where it now is (DishPlacement); null if it is deleted,
// also if that happened between the two reads.
async function withPlacement(view: DishView | null): Promise<PlacedDish | null> {
  if (!view) return null
  const [location] = await db.select({ boardId: dish.boardId, columnId: dish.columnId }).from(dish).where(and(eq(dish.id, view.id), isNull(dish.deletedAt)))
  if (!location) return null
  const order = await db.select({ id: dish.id }).from(dish).where(and(eq(dish.columnId, location.columnId), isNull(dish.deletedAt))).orderBy(...BOARD_ORDER)
  const index = order.findIndex(d => d.id === view.id)
  return index === -1 ? null : { ...view, placement: { ...location, index } }
}

// What editing a Dish may change (PRD story 43); fields left out stay as
// they are. `imageUrl` must already be a stored image, never a third-party
// link. A new image starts in the centre unless `imageFocus` comes with it;
// none (the Placeholder) always does.
export type DishChanges = Partial<Pick<NewDish, 'title' | 'note' | 'source' | 'creator' | 'imageUrl' | 'imageFocus' | 'placeholder'>>

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
  const { source, imageFocus, ...rest } = changes
  const focus = rest.imageUrl === undefined ? imageFocus : focusOf(rest.imageUrl, imageFocus)
  const values = {
    ...rest,
    ...source !== undefined && { sourceLink: source?.link ?? null, sourceKind: source?.kind ?? null },
    // Shifting the image the Dish has: a Placeholder stays centred.
    ...focus && (rest.imageUrl === undefined
      ? { imageFocusX: unlessPlaceholder(focus.x, FOCUS_CENTRE.x), imageFocusY: unlessPlaceholder(focus.y, FOCUS_CENTRE.y) }
      : { imageFocusX: focus.x, imageFocusY: focus.y }),
  }
  const target = onMembersBoard(dishId, userId)
  if (Object.keys(values).length > 0) {
    const updated = await db.update(dish).set(values).where(target).returning({ id: dish.id })
    if (updated.length === 0) return null
  }

  return findDish(target)
}

// The focus point an image is stored with: the one given, else the centre.
// A Dish without an image (its Placeholder) has none to shift.
function focusOf(imageUrl: string | null, focus: ImageFocus | undefined): ImageFocus {
  return imageUrl && focus ? focus : { ...FOCUS_CENTRE }
}

// `percent` as a Dish's stored focus coordinate, or `centre` if it shows
// its Placeholder.
function unlessPlaceholder(percent: number, centre: number) {
  return sql<number>`case when ${dish.imageUrl} is null then ${centre}::smallint else ${percent}::smallint end`
}

// Deletes a Dish (PRD story 47): a soft delete, so it can be restored. False
// unless it is on a Board the user is a Member of and not deleted yet.
export async function deleteDish(dishId: string, userId: string): Promise<boolean> {
  const deleted = await db.update(dish).set({ deletedAt: new Date() }).where(onMembersBoard(dishId, userId)).returning({ id: dish.id })
  return deleted.length > 0
}

// Undoes deleting a Dish. It kept its Column and position, so it is back
// where it was (or, if its Column was deleted meanwhile, where that
// Column's Dishes went). Answers it placed; null unless it is on a Board the
// user is a Member of.
export async function restoreDish(dishId: string, userId: string): Promise<PlacedDish | null> {
  const target = onMembersBoardIncludingDeleted(dishId, userId)
  await db.update(dish).set({ deletedAt: null }).where(target)
  return withPlacement(await findDish(target))
}

// What moving or cooking a Dish answers: the Dish placed (PlacedDish), and
// the Cooking the move recorded, if any.
export type MovedDish = PlacedDish & { cooking?: CookingView }

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

  const moved = await withPlacement(await findDish(and(target, eq(dish.columnId, columnId))))
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
// and puts its Dish back at `index` in the Column it came from, on its own
// Board or, after a move into another Board's Gekocht Column, back on the
// Board it came from. Answers the Dish and where it now is (PlacedDish);
// null, changing nothing, unless "Rückgängig" may take the Cooking back
// (undoableCooking: the user's own, just recorded), the Dish is still in a
// Gekocht Column (nobody moved it on meanwhile) and `columnId` is on a Board
// the user is a Member of. The caller has checked that the user may see the
// Cooking (cookingDishId).
export async function undoCooking(cookingId: string, dishId: string, userId: string, columnId: string, index: number): Promise<PlacedDish | null> {
  const stillCooked = inArray(dish.columnId, db.select({ id: boardColumn.id }).from(boardColumn).where(eq(boardColumn.isGekocht, true)))
  const movable = movableTo(and(onMembersBoard(dishId, userId), stillCooked), userId, columnId)
  const cookingGone = notExists(db.select({ id: cooking.id }).from(cooking).where(eq(cooking.id, cookingId)))
  await runAtomic(d => [
    d.delete(cooking).where(and(
      undoableCooking(cookingId, userId),
      eq(cooking.dishId, dishId),
      exists(db.select({ id: dish.id }).from(dish).where(movable)),
    )),
    // Only once the Cooking is gone: the delete above went through.
    renumberForDrop(d, dishId, columnId, index, and(movable, cookingGone)),
  ])
  // Also when an undo just before this one took the Cooking back already:
  // the Dish is back, so this one answers where, too.
  const [kept] = await db.select({ id: cooking.id }).from(cooking).where(eq(cooking.id, cookingId))
  if (kept) return null
  return withPlacement(await findDish(onMembersBoard(dishId, userId)))
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
  code: string
  title: string
  columnName: string
}

// The Board's newest Dish whose Source is this canonical link, if any.
// Deleted Dishes don't count.
export async function dishWithSource(boardId: string, canonicalLink: string): Promise<DuplicateDish | null> {
  const [found] = await db
    .select({ id: dish.id, code: dish.code, title: dish.title, columnName: boardColumn.name })
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

// Adds a Dish at the top of the Column that takes new Dishes (PRD story 13;
// shared/placement.ts). Answers it placed; null unless the user is a Member
// of the Board, or if another Member deleted it already.
export async function addDish(
  boardId: string,
  adder: Parameters<typeof shownAs>[0],
  input: NewDish,
): Promise<PlacedDish | null> {
  const columns = await db
    .select({ id: boardColumn.id, isGekocht: boardColumn.isGekocht })
    .from(boardColumn)
    .innerJoin(membership, and(eq(membership.boardId, boardColumn.boardId), eq(membership.userId, adder.id)))
    .where(eq(boardColumn.boardId, boardId))
    .orderBy(asc(boardColumn.position))
  const firstColumn = columnForNewDishes(columns)
  if (!firstColumn) return null

  const focus = focusOf(input.imageUrl, input.imageFocus)
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
      creator: input.creator,
      imageUrl: input.imageUrl,
      imageFocusX: focus.x,
      imageFocusY: focus.y,
      placeholder: input.placeholder,
      addedBy: adder.id,
    })
    .returning({ id: dish.id, code: dish.code, createdAt: dish.createdAt })
  if (!created) throw new Error(`Dish was not added to Board ${boardId}`)

  return withPlacement({
    id: created.id,
    code: created.code,
    title: input.title,
    note: input.note,
    source: input.source,
    creator: input.creator,
    imageUrl: input.imageUrl,
    imageFocus: focus,
    placeholder: input.placeholder,
    addedBy: shownAs(adder),
    createdAt: created.createdAt.toISOString(),
    cookings: [],
  })
}
