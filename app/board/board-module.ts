import type { InjectionKey, Ref } from 'vue'
// Relative imports, not `~~`: the module's tests run in plain Node (the
// "client" Vitest project), which knows no Nuxt aliases.
import type { BoardView } from '../../server/utils/boards'
import type { CookingView } from '../../server/utils/cookings'
import type { DishEditBody, AddDishBody } from '../../server/utils/dish-input'
import type { AddedDish, DishPlacement, DishView, MovedDish, PlacedDish, SavedDish } from '../../server/utils/dishes'
import { dishOnBoard } from '../../shared/board'
import { landingIndex, recordsCooking } from '../../shared/placement'

// The client Board module (spec #61): owns the app's copy of an open Board.
// Every change to it goes through an operation here, which changes the
// Board at once where that is optimistic, sends the write through the
// transport, then settles to where the server says the Dish is, or rolls
// back. Operations show no UI: they answer a plain result (BoardResult) that
// the page turns into Toasts, haptics and focus. Plain Vue reactivity, no
// Nuxt and no DOM, so it runs in Node under test.

// Where focus goes after an operation: a Dish's card, or a Column.
export type FocusTarget = { dish: string } | { column: string }

// Where focus goes when the Dish at `index` leaves its Column: the Dish
// that takes its place (the one below, else the one above), or the Column
// itself if it is left empty.
export function focusAfterLeaving(column: { id: string, dishes: { id: string }[] }, index: number): FocusTarget {
  const next = column.dishes[index + 1] ?? column.dishes[index - 1]
  return next ? { dish: next.id } : { column: column.id }
}

// What the page tells the Member, as a key the page looks up in the UI
// strings: mostly in their `dish` section (each takes the Dish's title,
// except `cook`: the Gekocht toast); those starting with `cooking` are about
// a Cooking, and come with it. `imageNotStored`: an added Dish's Source
// image couldn't be stored, so it has its Placeholder Image;
// `imageNotReplaced`: an edited Dish's new image couldn't be, so it keeps
// the one it had.
export type Notice = 'deleted' | 'deleteFailed' | 'restoreFailed' | 'moveFailed' | 'cookFailed' | 'uncookFailed' | 'cook'
  | 'cookingDeleted' | 'cookingDeleteFailed' | 'cookingRestoreFailed'
  | 'imageNotStored' | 'imageNotReplaced'

// What an operation answers: the Dish it was about, where it now is, the
// Cooking it recorded or deleted, a notice to show, an undo to offer with it, where
// focus goes, and, for a write that may still fail after the Board changed,
// what it ended in once settled.
export interface BoardResult {
  dish: DishView
  placement?: DishPlacement
  cooking?: CookingView
  notice?: Notice
  undo?: () => Promise<BoardResult>
  focus?: FocusTarget
  settled?: Promise<BoardResult>
}

// A write the server refused or never answered; `status` is its HTTP status
// if there was one (404: the Dish is gone there).
export class WriteFailed extends Error {
  constructor(readonly status?: number) {
    super(status === undefined ? 'Write failed' : `Write failed (${status})`)
  }
}

// Whether a write failed because the server no longer has what it was
// about (404): another Member deleted it.
function isGone(error: unknown) {
  return error instanceof WriteFailed && error.status === 404
}

// How the module's writes reach the server: over HTTP in the app
// (http-transport.ts), in memory under test. A failed write rejects with
// WriteFailed.
export interface BoardTransport {
  addDish: (boardId: string, dish: AddDishBody) => Promise<AddedDish>
  editDish: (dishId: string, changes: DishEditBody) => Promise<SavedDish>
  deleteDish: (dishId: string) => Promise<void>
  restoreDish: (dishId: string) => Promise<PlacedDish>
  moveDish: (dishId: string, to: Destination) => Promise<MovedDish>
  cookDish: (dishId: string) => Promise<MovedDish>
  undoCooking: (cookingId: string, to: { columnId: string, index: number }) => Promise<PlacedDish>
  deleteCooking: (cookingId: string) => Promise<void>
  restoreCooking: (cookingId: string) => Promise<CookingView>
  noteCooking: (cookingId: string, note: string) => Promise<CookingView>
}

type BoardColumn = BoardView['columns'][number]

// Where a Dish is asked to go: to `index` among a Column's other Dishes, or
// without one to its top (shared/placement.ts: landingIndex).
export interface Destination {
  columnId: string
  index?: number
}

// Where a Dish moved to another Board is asked to go: to the top of a
// Column there.
export interface BoardDestination {
  boardId: string
  columnId: string
}

// Where a Dish was in its Column, to put it back there (putBack): its index,
// and the Dishes above and below it then.
interface Place {
  columnId: string
  index: number
  above?: string
  below?: string
}

function placeOf(column: BoardColumn, index: number): Place {
  return { columnId: column.id, index, above: column.dishes[index - 1]?.id, below: column.dishes[index + 1]?.id }
}

// Takes `item` out of `list`, if it is in it.
function removeFrom<T>(list: T[], item: T | undefined) {
  const at = item === undefined ? -1 : list.indexOf(item)
  if (at !== -1) list.splice(at, 1)
}

export function createBoardModule(board: Ref<BoardView | undefined>, transport: BoardTransport) {
  // Each Dish's writes, in the order they were made: one starts once the
  // one before it has settled, so they never cross on the way. With none
  // before it, it starts at once. A write is told whether it is still the
  // latest to move the Dish (`latest`): if not, a later one has changed
  // where it is on the Board since, and settles it in turn. One that never
  // moves it (an edit: `moves: false`) waits its turn, but leaves that to
  // the one before it. A Cooking's delete and restore queue by the
  // Cooking's id instead (`key`): they never move its Dish, so they mustn't
  // keep a move of it from settling.
  const queues = new Map<string, { settled: Promise<unknown> }>()
  const latestMoves = new Map<string, object>()
  function queued<T>(key: string, write: (latest: () => boolean) => Promise<T>, { moves = true } = {}): Promise<T> {
    const before = queues.get(key)?.settled
    // In the queue before the write can start, so it is the latest at once.
    const entry = { settled: Promise.resolve() as Promise<unknown> }
    queues.set(key, entry)
    if (moves) latestMoves.set(key, entry)
    const run = () => write(() => latestMoves.get(key) === entry)
    // A write that throws rather than rejecting fails like one that rejects.
    const next = before ? before.then(run, run) : new Promise<T>(resolve => resolve(run()))
    entry.settled = next.catch(() => {}).then(() => {
      if (queues.get(key) !== entry) return
      queues.delete(key)
      latestMoves.delete(key)
      rolledBackTo.delete(key)
    })
    return next
  }

  // Where a failed write put its Dish back: where the server still has it.
  // A later write of the same Dish that fails too goes back there, not to
  // where the failed one had put it, which the server never had. Kept until
  // the Dish's writes are all settled, or one succeeds.
  const rolledBackTo = new Map<string, Place>()

  // Where a Dish whose move failed goes back to: where it came from
  // (`origin`), unless a write before this one failed too. Remembered for
  // the Dish's writes after it.
  function rollBackTo(dishId: string, origin: Place): Place {
    const back = rolledBackTo.get(dishId) ?? origin
    rolledBackTo.set(dishId, back)
    return back
  }

  // Where focus went when a Dish left the Board (deleted, moved to another
  // Board), for focusAfterDetail; forgotten once it is back (insert).
  const focusWhenGone = new Map<string, FocusTarget>()

  // Where focus goes once the Dish detail of a Dish closes: its card, if it
  // is on the Board; else where it went when the Dish left it. Null if
  // another Member took it off the Board.
  function focusAfterDetail(dishId: string): FocusTarget | null {
    return find(dishId) ? { dish: dishId } : focusWhenGone.get(dishId) ?? null
  }

  function find(dishId: string) {
    return board.value ? dishOnBoard(board.value, dishId) : null
  }

  function column(columnId: string) {
    return board.value?.columns.find(c => c.id === columnId)
  }

  function insert(into: BoardColumn, index: number, dish: DishView) {
    into.dishes.splice(Math.min(index, into.dishes.length), 0, dish)
    focusWhenGone.delete(dish.id)
  }

  // Puts a Dish back into its Column between the neighbours it had, found
  // by id, whatever changed meanwhile; else at its old index. Answers
  // whether it did: not if the Column is gone, or the Dish is back already.
  function putBack(dish: DishView, place: Place): boolean {
    const into = column(place.columnId)
    if (!into || find(dish.id)) return false
    const belowAt = into.dishes.findIndex(d => d.id === place.below)
    const aboveAt = into.dishes.findIndex(d => d.id === place.above)
    insert(into, belowAt !== -1 ? belowAt : aboveAt !== -1 ? aboveAt + 1 : place.index, dish)
    return true
  }

  // Takes a Dish out of its Column, answering where it was, to put it back
  // there, and where focus goes instead of its card.
  function leave(dish: DishView, from: BoardColumn): { origin: Place, focus: FocusTarget } {
    const index = from.dishes.indexOf(dish)
    const left = { origin: placeOf(from, index), focus: focusAfterLeaving(from, index) }
    from.dishes.splice(index, 1)
    return left
  }

  // Takes a Dish off the Board and puts it back at `place`.
  function moveBack(dish: DishView, place: Place) {
    takeOut(dish.id)
    putBack(dish, place)
  }

  // Takes a Dish off the Board, wherever it is now.
  function takeOut(dishId: string) {
    const found = find(dishId)
    found?.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
  }

  // Settles a Dish to where the server says it is: its fields as the server
  // has them, at its index in its Column, both found by id now. A Column
  // the Board doesn't show yet (another Member just added it) leaves the
  // Dish where it is until the next poll brings that Column.
  function settle(dish: DishView, { placement, cooking: _, ...fields }: MovedDish) {
    Object.assign(dish, fields)
    const into = column(placement.columnId)
    if (!into) return
    takeOut(dish.id)
    insert(into, placement.index, dish)
  }

  // Adding a Dish (PRD story 13), from Add Dish, which waits for it: nothing
  // shows before the server has it. Saved to this Board, it shows where the
  // server put it, at the top of the Column that takes new Dishes as the
  // server has the Columns; saved to another Board, it doesn't show here.
  // A failed write rejects with WriteFailed, for the form to say so.
  async function addDish(boardId: string, input: AddDishBody): Promise<BoardResult> {
    const { imageNotStored, placement, ...fields } = await transport.addDish(boardId, input)
    // Another Board's Column isn't on this one.
    const into = column(placement.columnId)
    if (into && !find(fields.id)) insert(into, placement.index, fields)
    // The Board's own copy, once it shows.
    const dish = find(fields.id)?.dish ?? fields
    return { dish, placement, ...imageNotStored && { notice: 'imageNotStored' } }
  }

  // Editing a Dish (PRD stories 43–45), from the Dish detail, which waits
  // for it: once saved, its card and the detail show the Dish as the server
  // saved it. It waits for the Dish's writes before it, so their answers
  // can't bring back what it changed. The Cooking History stays the Board's own: an edit never
  // changes it, and a Cooking still being recorded shows there. A failed
  // write rejects with WriteFailed, for the form to say so.
  async function editDish(dishId: string, changes: DishEditBody): Promise<BoardResult> {
    const { imageNotStored, ...saved } = await queued(dishId, () => transport.editDish(dishId, changes), { moves: false })
    const shown = find(dishId)?.dish
    if (shown) {
      const { cookings: _, ...fields } = saved
      Object.assign(shown, fields)
    }
    return { dish: shown ?? saved, ...imageNotStored && { notice: 'imageNotReplaced' } }
  }

  // Deleting a Dish (PRD story 47): its card goes at once. If the delete
  // fails, it comes back with a notice; one the server no longer has
  // (another Member deleted it) counts as deleted.
  function deleteDish(dishId: string): BoardResult | null {
    const found = find(dishId)
    if (!found) return null
    const { dish } = found
    const { origin: place, focus } = leave(dish, found.column)
    focusWhenGone.set(dishId, focus)

    const deleted = queued(dishId, () => transport.deleteDish(dishId)).then(() => true, (error: unknown) => {
      if (isGone(error)) return true
      putBack(dish, place)
      return false
    })
    const settled = deleted.then((ok): BoardResult => ok ? { dish } : { dish, notice: 'deleteFailed' })

    // "Rückgängig": once the delete has settled, the Dish is back at once,
    // with focus on it, and then where the server restored it. If that
    // fails, it goes again, with a notice.
    async function undo(): Promise<BoardResult> {
      if (!await deleted) return { dish } // Never deleted, and back already.
      const back = putBack(dish, place)
      const restored = queued(dishId, () => transport.restoreDish(dishId)).then((placed): BoardResult => {
        settle(dish, placed)
        // Its Column was gone, so only now is it back to focus.
        return back ? { dish } : { dish, focus: { dish: dishId } }
      }, (): BoardResult => {
        takeOut(dishId)
        return { dish, notice: 'restoreFailed' }
      })
      return { dish, ...back && { focus: { dish: dishId } }, settled: restored }
    }

    return { dish, notice: 'deleted', undo, focus, settled }
  }

  // Moving a Dish (PRD stories 31–34): to `index` among a Column's other
  // Dishes (dragged), or without one to the top of another Column
  // (shared/placement.ts). It goes there at once, then where the server put
  // it. If the move fails, it goes back exactly where it was, with a notice;
  // one the server no longer has (another Member deleted it) just goes.
  //
  // Into the Gekocht Column it records a Cooking (stories 49–55): it shows
  // in the Dish's Cooking History at once, and the Gekocht toast (`cook`)
  // offers "Rückgängig". Null if it wouldn't move or record one.
  function moveDish(dishId: string, to: Destination): BoardResult | null {
    return move(dishId, to, () => transport.moveDish(dishId, to))
  }

  // "Gekocht ✓" (PRD story 35): to the top of the Gekocht Column, or where
  // it is if it is there already, recording a Cooking either way.
  function cookDish(dishId: string): BoardResult | null {
    const gekocht = board.value?.columns.find(c => c.isGekocht)
    return gekocht ? move(dishId, { columnId: gekocht.id }, () => transport.cookDish(dishId), { cook: true }) : null
  }

  // Moves a Dish as moveDish says, sending `write` for it.
  function move(dishId: string, to: Destination, write: () => Promise<MovedDish>, { cook = false } = {}): BoardResult | null {
    const found = find(dishId)
    const target = column(to.columnId)
    if (!found || !target || !board.value) return null
    const { dish, column: from } = found
    const index = from.dishes.indexOf(dish)
    const landing = landingIndex(target, dishId, to.index)
    const stays = target === from && landing === index
    const cooks = recordsCooking(from, target, { cook })
    if (stays && !cooks) return null
    const left = leave(dish, from)
    const { origin } = left
    const focus = stays ? { dish: dishId } : left.focus
    insert(target, landing, dish)
    const placement = { boardId: board.value.id, columnId: target.id, index: landing }
    // The Cooking as the server will record it, filled in once it has. The
    // Board's own (reactive) copy, so filling it in shows.
    if (cooks) dish.cookings.unshift({ id: '', cookedAt: new Date().toISOString(), note: null, recordedBy: null })
    const pending = cooks ? dish.cookings[0]! : undefined
    // How the move ended, for undo: failed, or with the Cooking it recorded.
    let failed = false
    let recorded: CookingView | undefined
    let undone = false

    const settled = queued(dishId, async (latest): Promise<BoardResult> => {
      try {
        const moved = await write()
        recorded = moved.cooking
        rolledBackTo.delete(dishId)
        if (latest()) settle(dish, moved)
        // A later write has the Dish elsewhere by now: only the Cooking
        // settles, if it still shows, or goes if none was recorded.
        else if (pending && moved.cooking) Object.assign(pending, moved.cooking)
        else removeFrom(dish.cookings, pending)
        const cooking = moved.cooking && dish.cookings.find(c => c.id === moved.cooking!.id)
        return { dish, placement: moved.placement, ...cooking && { cooking } }
      }
      catch (error) {
        failed = true
        if (isGone(error)) {
          takeOut(dishId)
          return { dish }
        }
        // Back where the server still has it. A later write moves it on, or
        // goes back there in turn.
        const back = rollBackTo(dishId, origin)
        removeFrom(dish.cookings, pending)
        // Undone already, it is back, and nothing is left to tell.
        if (undone) return { dish }
        if (latest()) moveBack(dish, back)
        return { dish, notice: cooks ? 'cookFailed' : 'moveFailed' }
      }
    })

    // "Rückgängig" in the Gekocht toast (PRD story 51): the Dish is back
    // where it was at once, without that Cooking, with focus on it. Its
    // write waits for the move, then takes the Cooking off again (with none
    // recorded, it moves the Dish back). If that fails, the Dish is cooked
    // again where it was, with a notice. After a failed move, the Dish is
    // back already.
    async function undo(): Promise<BoardResult> {
      if (failed) return { dish }
      undone = true
      const now = find(dishId)
      const cooked = now && placeOf(now.column, now.column.dishes.indexOf(now.dish))
      moveBack(dish, origin)
      removeFrom(dish.cookings, dish.cookings.find(c => c === pending || c.id === recorded?.id))

      const back = { columnId: origin.columnId, index: origin.index }
      const undoing = queued(dishId, async (latest): Promise<BoardResult> => {
        if (failed) return { dish }
        try {
          const placed = recorded ? await transport.undoCooking(recorded.id, back) : await transport.moveDish(dishId, back)
          if (latest()) settle(dish, placed)
          return { dish, placement: placed.placement }
        }
        catch (error) {
          // Its Cooking stays gone if it is gone on the server (deleted
          // from the Cooking History meanwhile).
          if (recorded && !isGone(error) && !dish.cookings.some(c => c.id === recorded!.id)) dish.cookings.unshift(recorded)
          if (cooked) moveBack(dish, cooked)
          return { dish, notice: 'uncookFailed' }
        }
      })
      return { dish, focus: { dish: dishId }, settled: undoing }
    }

    return { dish, placement, focus, settled, ...pending && { cooking: pending, notice: 'cook', undo } }
  }

  // Moving a Dish to a Column on another of the Member's Boards (PRD story
  // 46): it leaves this Board at once, for the top of that Column, keeping
  // its Cooking History; into that Board's Gekocht Column the server
  // records a Cooking, but there is no Gekocht toast or undo, as the Dish
  // is no longer here. If the move fails, it comes back exactly where it
  // was, with a notice; one the server no longer has (another Member
  // deleted it) stays gone. Null if it isn't on this Board.
  function moveToBoard(dishId: string, to: BoardDestination): BoardResult | null {
    const found = find(dishId)
    if (!found) return null
    const { dish } = found
    const { origin, focus } = leave(dish, found.column)
    focusWhenGone.set(dishId, focus)

    const settled = queued(dishId, async (latest): Promise<BoardResult> => {
      try {
        const moved = await transport.moveDish(dishId, { columnId: to.columnId })
        rolledBackTo.delete(dishId)
        return { dish, placement: moved.placement }
      }
      catch (error) {
        if (isGone(error)) return { dish }
        // Back where the server still has it.
        const back = rollBackTo(dishId, origin)
        if (latest()) moveBack(dish, back)
        return { dish, notice: 'moveFailed' }
      }
    })

    return { dish, placement: { ...to, index: 0 }, focus, settled }
  }

  // Puts a Cooking back into its Dish's Cooking History, found by the
  // Dish's id wherever it is now. The History is newest first, so the
  // Cooking's date finds its place, whatever was added meanwhile.
  function putBackCooking(dishId: string, cooking: CookingView) {
    const dish = find(dishId)?.dish
    if (!dish || dish.cookings.some(c => c.id === cooking.id)) return
    const at = dish.cookings.findIndex(c => c.cookedAt < cooking.cookedAt)
    dish.cookings.splice(at === -1 ? dish.cookings.length : at, 0, cooking)
  }

  // Deleting a Cooking from a Dish's Cooking History (PRD story 48): it
  // goes at once. If the delete fails, it is back with a notice; one the
  // server no longer has (another Member deleted it) counts as deleted.
  function deleteCooking(dishId: string, cookingId: string): BoardResult | null {
    const found = find(dishId)
    // One still being recorded has no id yet: nothing to delete on the server.
    const at = cookingId ? found?.dish.cookings.findIndex(c => c.id === cookingId) ?? -1 : -1
    if (!found || at === -1) return null
    const { dish } = found
    const [cooking] = dish.cookings.splice(at, 1) as [CookingView]

    const deleted = queued(cookingId, () => transport.deleteCooking(cookingId)).then(() => true, (error: unknown) => {
      if (isGone(error)) return true
      putBackCooking(dishId, cooking)
      return false
    })
    const settled = deleted.then((ok): BoardResult => ok ? { dish, cooking } : { dish, cooking, notice: 'cookingDeleteFailed' })

    // "Rückgängig": once the delete has settled, the Cooking is back in
    // its Dish's Cooking History at once, and as the server restored it.
    // If that fails, it goes again, with a notice.
    async function undo(): Promise<BoardResult> {
      if (!await deleted) return { dish, cooking } // Never deleted, and back already.
      putBackCooking(dishId, cooking)
      const restored = queued(cookingId, () => transport.restoreCooking(cookingId)).then((fields): BoardResult => {
        const back = find(dishId)?.dish.cookings.find(c => c.id === cookingId)
        if (back) Object.assign(back, fields)
        return { dish, cooking: back ?? cooking }
      }, (): BoardResult => {
        const now = find(dishId)?.dish
        if (now) removeFrom(now.cookings, now.cookings.find(c => c.id === cookingId))
        return { dish, cooking, notice: 'cookingRestoreFailed' }
      })
      return { dish, cooking, settled: restored }
    }

    return { dish, cooking, notice: 'cookingDeleted', undo, settled }
  }

  // A Cooking's note (PRD story 53), from the Cooking note sheet, which
  // waits for it: once saved, the Cooking shows it in its Dish's Cooking
  // History, found by the Dish's id wherever it is now. A blank note removes
  // it. Null if the Dish isn't on the Board any more. A failed write rejects
  // with WriteFailed, for the form to say so.
  async function noteCooking(dishId: string, cookingId: string, note: string): Promise<BoardResult | null> {
    const saved = await queued(cookingId, () => transport.noteCooking(cookingId, note))
    const dish = find(dishId)?.dish
    if (!dish) return null
    const cooking = dish.cookings.find(c => c.id === cookingId)
    if (cooking) Object.assign(cooking, saved)
    return { dish, cooking: cooking ?? saved }
  }

  return { addDish, editDish, deleteDish, moveDish, moveToBoard, cookDish, deleteCooking, noteCooking, focusAfterDetail }
}

export type BoardModule = ReturnType<typeof createBoardModule>

// How the Board page hands its module to the forms under it (useBoardModule).
export const boardModuleKey: InjectionKey<BoardModule> = Symbol('board module')
