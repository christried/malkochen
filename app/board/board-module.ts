import { computed, type InjectionKey, type Ref } from 'vue'
// Relative imports, not `~~`: the module's tests run in plain Node (the
// "client" Vitest project), which knows no Nuxt aliases.
import type { BoardView } from '../../server/utils/boards'
import type { ColumnView } from '../../server/utils/columns'
import type { CookingView } from '../../server/utils/cookings'
import type { DishEditBody, AddDishBody } from '../../server/utils/dish-input'
import type { AddedDish, DishPlace, DishPlacement, DishView, MovedDish, PlacedDish, SavedDish } from '../../server/utils/dishes'
import { dishOnBoard } from '../../shared/board'
import { landingIndex, recordsCooking } from '../../shared/placement'
import { createDishHistories, type HistoryTransport } from './dish-histories'
import { createDishVotes, type VoteTransport } from './dish-votes'

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
function focusAfterLeaving(column: { id: string, dishes: { id: string }[] }, index: number): FocusTarget {
  const next = column.dishes[index + 1] ?? column.dishes[index - 1]
  return next ? { dish: next.id } : { column: column.id }
}

// What the page tells the Member, as a key the page looks up in the UI
// strings: mostly in their `dish` section (each takes the Dish's title,
// except `cook`: the Gekocht toast); those starting with `cooking` are about
// a Cooking, and come with it. `imageNotStored`: an added Dish's Source
// image couldn't be stored, so it has its Placeholder Image (`photoNotStored`:
// the same for the Member's own photo); `imageNotReplaced`: an edited Dish's new image couldn't be, so it keeps
// the one it had.
export type Notice = 'deleted' | 'deleteFailed' | 'restoreFailed' | 'moveFailed' | 'cookFailed' | 'uncookFailed' | 'cook'
  | 'cookingDeleted' | 'cookingDeleteFailed' | 'cookingRestoreFailed'
  | 'imageNotStored' | 'photoNotStored' | 'imageNotReplaced'

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

// What an operation on several Dishes at once (#218) answers, as
// BoardResult does for one: the Dishes it was about, in Board order, a
// notice, an undo, where focus goes, and what its write ended in. Its
// notices are about the Dishes together: `movedMany` and `deletedMany` come
// with an undo; the others say a write failed.
export type BulkNotice = 'movedMany' | 'deletedMany' | 'moveManyFailed' | 'deleteManyFailed' | 'restoreManyFailed' | 'returnManyFailed'

export interface BulkResult {
  dishes: DishView[]
  notice?: BulkNotice
  undo?: () => Promise<BulkResult>
  focus?: FocusTarget
  settled?: Promise<BulkResult>
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
// WriteFailed. With the Dish History's (dish-histories.ts) and the Votes'
// (dish-votes.ts).
export interface BoardTransport extends HistoryTransport, VoteTransport {
  addDish: (boardId: string, dish: AddDishBody) => Promise<AddedDish>
  editDish: (dishId: string, changes: DishEditBody) => Promise<SavedDish>
  deleteDish: (dishId: string) => Promise<void>
  restoreDish: (dishId: string) => Promise<PlacedDish>
  moveDish: (dishId: string, to: Destination) => Promise<MovedDish>
  cookDish: (dishId: string) => Promise<MovedDish>
  undoCooking: (cookingId: string, to: { columnId: string, index: number }) => Promise<PlacedDish>
  deleteCooking: (cookingId: string) => Promise<void>
  restoreCooking: (cookingId: string) => Promise<CookingView>
  addColumn: (boardId: string, name: string) => Promise<ColumnView>
  // Several Dishes at once (POST /api/dishes/bulk), all or nothing.
  moveDishes: (dishIds: string[], columnId: string) => Promise<PlacedDish[]>
  placeDishes: (places: DishPlace[]) => Promise<PlacedDish[]>
  deleteDishes: (dishIds: string[]) => Promise<void>
  restoreDishes: (dishIds: string[]) => Promise<PlacedDish[]>
}

type BoardColumn = BoardView['columns'][number]

// Where a Dish is asked to go: to `index` among a Column's other Dishes, or
// without one to its top (shared/placement.ts: landingIndex).
export interface Destination {
  columnId: string
  index?: number
}

// Where a Dish moved to another Board is asked to go: to the top of a
// Column there, which may be that Board's Gekocht Column.
export interface BoardDestination {
  boardId: string
  columnId: string
  isGekocht: boolean
}

// Where a Dish was in its Column, to put it back there (putBack): its index,
// and the Dishes above and below it then.
interface Place {
  columnId: string
  index: number
  above?: string
  below?: string
}

// How a move that may record a Cooking ended, for its undo: whether it
// failed, the Cooking it recorded, and whether it was undone.
interface MoveEnded {
  failed: boolean
  recorded?: CookingView
  undone: boolean
}

function placeOf(column: BoardColumn, index: number): Place {
  return { columnId: column.id, index, above: column.dishes[index - 1]?.id, below: column.dishes[index + 1]?.id }
}

// Takes `item` out of `list`, if it is in it.
function removeFrom<T>(list: T[], item: T | undefined) {
  const at = item === undefined ? -1 : list.indexOf(item)
  if (at !== -1) list.splice(at, 1)
}

export function createBoardModule(board: Ref<BoardView | undefined>, uncounted: BoardTransport) {
  // Every write goes through `transport`, so each is counted for sync.
  const { transport, mark, writesSince } = counted(uncounted)

  // Each Dish's writes, in the order they were made: one starts once the
  // one before it has settled, so they never cross on the way. With none
  // before it, it starts at once. A write is told whether it is still the
  // latest to move the Dish (`latest`): if not, a later one has changed
  // where it is on the Board since, and settles it in turn. One that never
  // moves it (an edit: `moves: false`) waits its turn, but leaves that to
  // the one before it. A Cooking's delete and restore queue by the
  // Cooking's id instead (`key`): they never move its Dish, so they mustn't
  // keep a move of it from settling. A write of several Dishes queues by
  // each of their ids (`key` a list), waiting for every one of their writes
  // before it; `latest` then answers for the Dish asked about.
  const queues = new Map<string, { settled: Promise<unknown> }>()
  const latestMoves = new Map<string, object>()
  function queued<T>(key: string | string[], write: (latest: (dishId?: string) => boolean) => Promise<T>, { moves = true } = {}): Promise<T> {
    const keys = typeof key === 'string' ? [key] : key
    // Each settles without rejecting.
    const before = keys.map(k => queues.get(k)?.settled).filter(settled => settled !== undefined)
    // In the queue before the write can start, so it is the latest at once.
    const entry = { settled: Promise.resolve() as Promise<unknown> }
    for (const k of keys) {
      queues.set(k, entry)
      if (moves) latestMoves.set(k, entry)
    }
    const run = () => write((dishId = keys[0]!) => latestMoves.get(dishId) === entry)
    // A write that throws rather than rejecting fails like one that rejects.
    // One write before it is waited for directly: as soon as it settles,
    // this one is under way, so a poll can't slip in between.
    const waited = before.length > 1 ? Promise.all(before) : before[0]
    const next = waited ? waited.then(run) : new Promise<T>(resolve => resolve(run()))
    entry.settled = next.catch(() => {}).then(() => {
      for (const k of keys) {
        if (queues.get(k) !== entry) continue
        queues.delete(k)
        latestMoves.delete(k)
        rolledBackTo.delete(k)
      }
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
  // Dish where it is until the next poll brings that Column. Its Cooking
  // History keeps the Cookings it shows as they are, filled in (the pending
  // one with the Cooking the server recorded): the detail keys its entries
  // by them, and new ones would redraw them all. Its Votes stay the Board's
  // own: a move never changes them, and a Vote still under way shows there.
  function settle(dish: DishView, { placement, cooking, cookings, votes: _, ...fields }: MovedDish) {
    Object.assign(dish, fields)
    dish.cookings = keepShownCookings(dish.cookings, cookings, cooking)
    const into = column(placement.columnId)
    if (!into) return
    takeOut(dish.id)
    insert(into, placement.index, dish)
  }

  // The server's Cooking History, with each Cooking already shown kept as
  // the same object and filled in. The pending one (no id yet) is the
  // Cooking the server just recorded.
  function keepShownCookings(shown: CookingView[], settled: CookingView[], recorded: CookingView | undefined): CookingView[] {
    return settled.map((cooking) => {
      const same = shown.find(c => c.id ? c.id === cooking.id : cooking.id === recorded?.id)
      return same ? Object.assign(same, cooking) : cooking
    })
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
    return { dish, placement, ...imageNotStored && { notice: input.photo ? 'photoNotStored' : 'imageNotStored' } }
  }

  // Editing a Dish (PRD stories 43–45), from the Dish detail, which waits
  // for it: once saved, its card and the detail show the Dish as the server
  // saved it. It waits for the Dish's writes before it, so their answers
  // can't bring back what it changed. The Cooking History and Votes stay
  // the Board's own: an edit never changes them, and a Cooking still being
  // recorded or a Vote under way shows there. A failed
  // write rejects with WriteFailed, for the form to say so.
  async function editDish(dishId: string, changes: DishEditBody): Promise<BoardResult> {
    const { imageNotStored, ...saved } = await queued(dishId, () => transport.editDish(dishId, changes), { moves: false })
    const shown = find(dishId)?.dish
    if (shown) {
      const { cookings: _, votes: __, ...fields } = saved
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
    const pending = cooks ? recordPending(dish) : undefined
    const ended: MoveEnded = { failed: false, undone: false }

    const settled = queued(dishId, async (latest): Promise<BoardResult> => {
      try {
        const moved = await write()
        ended.recorded = moved.cooking
        rolledBackTo.delete(dishId)
        if (latest()) settle(dish, moved)
        // A later write has the Dish elsewhere by now: only the Cooking
        // settles, if it still shows, or goes if none was recorded.
        else settlePending(dish, pending, moved.cooking)
        return { dish, placement: moved.placement, ...shownCooking(dish, moved.cooking) }
      }
      catch (error) {
        ended.failed = true
        if (isGone(error)) {
          takeOut(dishId)
          return { dish }
        }
        // Back where the server still has it. A later write moves it on, or
        // goes back there in turn.
        const back = rollBackTo(dishId, origin)
        removeFrom(dish.cookings, pending)
        // Undone already, it is back, and nothing is left to tell.
        if (ended.undone) return { dish }
        if (latest()) moveBack(dish, back)
        return { dish, notice: cooks ? 'cookFailed' : 'moveFailed' }
      }
    })

    return { dish, placement, focus, settled, ...pending && { cooking: pending, notice: 'cook', undo: undoCooked(dish, origin, pending, ended) } }
  }

  // The Cooking a move records, shown in the Dish's Cooking History at once
  // and filled in once the server has recorded it. The Board's own
  // (reactive) copy, so filling it in shows.
  function recordPending(dish: DishView): CookingView {
    dish.cookings.unshift({ id: '', cookedAt: new Date().toISOString(), recordedBy: null })
    return dish.cookings[0]!
  }

  // Fills in the pending Cooking as the server recorded it, or takes it out
  // of the Cooking History if the server recorded none.
  function settlePending(dish: DishView, pending: CookingView | undefined, recorded: CookingView | undefined) {
    if (pending && recorded) Object.assign(pending, recorded)
    else removeFrom(dish.cookings, pending)
  }

  // The recorded Cooking as the Dish's Cooking History shows it, unless it
  // is gone from there (undone meanwhile).
  function shownCooking(dish: DishView, recorded: CookingView | undefined): { cooking?: CookingView } {
    const cooking = recorded && dish.cookings.find(c => c.id === recorded.id)
    return cooking ? { cooking } : {}
  }

  // "Rückgängig" in the Gekocht toast (PRD story 51), for a move that
  // records a Cooking: the Dish is back where it was at once (on this
  // Board, also from another Board's Gekocht Column), without that Cooking,
  // with focus on it. Its write waits for the move, then takes the Cooking
  // off again (with none recorded, it moves the Dish back). If that fails,
  // the Dish is cooked again where it was, with a notice: back in this
  // Board's Gekocht Column, or off this Board again. After a failed move,
  // the Dish is back already.
  function undoCooked(dish: DishView, origin: Place, pending: CookingView, ended: MoveEnded) {
    const dishId = dish.id
    return async (): Promise<BoardResult> => {
      if (ended.failed) return { dish }
      ended.undone = true
      const now = find(dishId)
      const cooked = now && placeOf(now.column, now.column.dishes.indexOf(now.dish))
      moveBack(dish, origin)
      removeFrom(dish.cookings, dish.cookings.find(c => c === pending || c.id === ended.recorded?.id))

      const back = { columnId: origin.columnId, index: origin.index }
      const undoing = queued(dishId, async (latest): Promise<BoardResult> => {
        if (ended.failed) return { dish }
        const { recorded } = ended
        try {
          const placed = recorded ? await transport.undoCooking(recorded.id, back) : await transport.moveDish(dishId, back)
          if (latest()) settle(dish, placed)
          return { dish, placement: placed.placement }
        }
        catch (error) {
          // Its Cooking stays gone if it is gone on the server (deleted
          // from the Cooking History meanwhile).
          if (recorded && !isGone(error) && !dish.cookings.some(c => c.id === recorded.id)) dish.cookings.unshift(recorded)
          if (cooked) moveBack(dish, cooked)
          else {
            // Off this Board again, focus goes where it would as it leaves.
            const shown = find(dishId)
            if (shown) {
              const { focus } = leave(dish, shown.column)
              focusWhenGone.set(dishId, focus)
              return { dish, notice: 'uncookFailed', focus }
            }
          }
          return { dish, notice: 'uncookFailed' }
        }
      })
      return { dish, focus: { dish: dishId }, settled: undoing }
    }
  }

  // Moving a Dish to a Column on another of the Member's Boards (PRD story
  // 46): it leaves this Board at once, for the top of that Column, keeping
  // its Cooking History. If the move fails, it comes back exactly where it
  // was, with a notice; one the server no longer has (another Member
  // deleted it) stays gone. Null if it isn't on this Board.
  //
  // Into that Board's Gekocht Column it records a Cooking, as a move into
  // this Board's would (#129): it shows in the Dish's Cooking History at
  // once, and the Gekocht toast (`cook`) offers "Rückgängig", which brings
  // the Dish back here.
  function moveToBoard(dishId: string, to: BoardDestination): BoardResult | null {
    const found = find(dishId)
    if (!found) return null
    const { dish } = found
    const cooks = recordsCooking(found.column, { id: to.columnId, isGekocht: to.isGekocht })
    const { origin, focus } = leave(dish, found.column)
    focusWhenGone.set(dishId, focus)
    const pending = cooks ? recordPending(dish) : undefined
    const ended: MoveEnded = { failed: false, undone: false }

    const settled = queued(dishId, async (latest): Promise<BoardResult> => {
      try {
        const moved = await transport.moveDish(dishId, { columnId: to.columnId })
        ended.recorded = moved.cooking
        rolledBackTo.delete(dishId)
        settlePending(dish, pending, moved.cooking)
        return { dish, placement: moved.placement, ...shownCooking(dish, moved.cooking) }
      }
      catch (error) {
        ended.failed = true
        removeFrom(dish.cookings, pending)
        if (isGone(error)) return { dish }
        // Back where the server still has it.
        const back = rollBackTo(dishId, origin)
        // Undone already, it is back, and nothing is left to tell.
        if (ended.undone) return { dish }
        if (latest()) moveBack(dish, back)
        return { dish, notice: cooks ? 'cookFailed' : 'moveFailed' }
      }
    })

    const placement = { boardId: to.boardId, columnId: to.columnId, index: 0 }
    return { dish, placement, focus, settled, ...pending && { cooking: pending, notice: 'cook', undo: undoCooked(dish, origin, pending, ended) } }
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

  // A new Column (from the Board's add lane, on desktop): once the server
  // has added it, at the end, it shows there, empty. Not optimistic, as it
  // has no id before. A failed write rejects with WriteFailed, for the form
  // to say so.
  async function addColumn(name: string): Promise<ColumnView> {
    const boardId = board.value?.id
    if (!boardId) throw new WriteFailed()
    const added = await transport.addColumn(boardId, name)
    if (board.value?.id === boardId) board.value.columns.push({ ...added, dishes: [] })
    return added
  }

  // The Dishes of `dishIds` that are on the Board, in Board order: Column
  // by Column, each from the top.
  function inBoardOrder(dishIds: string[]) {
    const wanted = new Set(dishIds)
    return board.value?.columns.flatMap(column => column.dishes.filter(d => wanted.has(d.id)).map(dish => ({ dish, column }))) ?? []
  }

  // Takes several Dishes out of their Columns, answering where each was
  // (all taken before any goes, to put them back there in Board order), and
  // where focus goes instead: to the Dish now in the first one's place, the
  // one above, or that Column.
  function leaveAll(found: { dish: DishView, column: BoardColumn }[]): { origins: Place[], focus: FocusTarget } {
    const origins = found.map(({ dish, column }) => placeOf(column, column.dishes.indexOf(dish)))
    for (const { dish, column } of found) column.dishes.splice(column.dishes.indexOf(dish), 1)
    const first = found[0]!.column
    const at = origins[0]!.index
    const next = first.dishes[at] ?? first.dishes[at - 1]
    return { origins, focus: next ? { dish: next.id } : { column: first.id } }
  }

  // Puts several Dishes back at their places, wherever they are now, in
  // Board order, so each finds the ones above it back already.
  function putAllBack(dishes: DishView[], places: Place[], latest: (dishId: string) => boolean = () => true) {
    dishes.forEach((dish, i) => {
      if (latest(dish.id)) moveBack(dish, places[i]!)
    })
  }

  // Settles each placed Dish that is still the latest to move to where the
  // server put it.
  function settleAll(dishes: DishView[], placed: PlacedDish[], latest: (dishId: string) => boolean) {
    for (const answer of placed) {
      const dish = dishes.find(d => d.id === answer.id)
      if (dish && latest(dish.id)) settle(dish, answer)
    }
  }

  // Moving several selected Dishes (#218) to the top of a Column, of this
  // Board or of another of the Member's Boards (`boardId`), in Board order;
  // one already in that Column stays where it is. They go there at once,
  // then where the server put them. Never into a Gekocht Column: cooking
  // stays one Dish at a time. If the move fails, every Dish goes back
  // exactly where it was, with a notice. Null if none would move.
  function moveDishes(dishIds: string[], to: Destination | BoardDestination): BulkResult | null {
    const here = 'boardId' in to ? null : column(to.columnId)
    if ('boardId' in to ? to.isGekocht : !here || here.isGekocht) return null
    const moving = inBoardOrder(dishIds).filter(f => f.column !== here)
    if (moving.length === 0) return null
    const dishes = moving.map(f => f.dish)
    const ids = dishes.map(d => d.id)
    const { origins, focus } = leaveAll(moving)
    // Where the move puts them, as this Board shows it: at the top of
    // `here`, or off the Board.
    function moveOn() {
      for (const id of ids) takeOut(id)
      if (here) dishes.forEach((dish, i) => insert(here, i, dish))
      else for (const id of ids) focusWhenGone.set(id, focus)
    }
    moveOn()

    const settled = queued(ids, async (latest): Promise<BulkResult> => {
      try {
        settleAll(dishes, await transport.moveDishes(ids, to.columnId), latest)
        for (const id of ids) rolledBackTo.delete(id)
        return { dishes }
      }
      catch {
        // Back where the server still has them.
        putAllBack(dishes, dishes.map((dish, i) => rollBackTo(dish.id, origins[i]!)), latest)
        return { dishes, notice: 'moveManyFailed' }
      }
    })

    // "Rückgängig": once the move has settled, every Dish is back where it
    // was at once, with focus on the first, and then where the server put
    // them back. If that fails, they go where the move had put them, with a
    // notice.
    async function undo(): Promise<BulkResult> {
      if ((await settled).notice) return { dishes } // Never moved, and back already.
      putAllBack(dishes, origins)
      const places = origins.map((origin, i) => ({ dishId: ids[i]!, columnId: origin.columnId, index: origin.index }))
      const returned = queued(ids, async (latest): Promise<BulkResult> => {
        try {
          settleAll(dishes, await transport.placeDishes(places), latest)
          return { dishes }
        }
        catch {
          moveOn()
          return { dishes, notice: 'returnManyFailed' }
        }
      })
      return { dishes, focus: { dish: ids[0]! }, settled: returned }
    }

    return { dishes, notice: 'movedMany', undo, focus: here ? { column: here.id } : focus, settled }
  }

  // Deleting several selected Dishes (#218): their cards go at once. If the
  // delete fails, they come back with a notice.
  function deleteDishes(dishIds: string[]): BulkResult | null {
    const found = inBoardOrder(dishIds)
    if (found.length === 0) return null
    const dishes = found.map(f => f.dish)
    const ids = dishes.map(d => d.id)
    const { origins, focus } = leaveAll(found)
    for (const id of ids) focusWhenGone.set(id, focus)

    const settled = queued(ids, async (): Promise<BulkResult> => {
      try {
        await transport.deleteDishes(ids)
        return { dishes }
      }
      catch {
        putAllBack(dishes, origins)
        return { dishes, notice: 'deleteManyFailed' }
      }
    })

    // "Rückgängig": once the delete has settled, every Dish is back at
    // once, with focus on the first, and then where the server restored
    // them. If that fails, they go again, with a notice.
    async function undo(): Promise<BulkResult> {
      if ((await settled).notice) return { dishes } // Never deleted, and back already.
      putAllBack(dishes, origins)
      const restored = queued(ids, async (latest): Promise<BulkResult> => {
        try {
          settleAll(dishes, await transport.restoreDishes(ids), latest)
          return { dishes }
        }
        catch {
          for (const id of ids) takeOut(id)
          return { dishes, notice: 'restoreManyFailed' }
        }
      })
      return { dishes, focus: { dish: ids[0]! }, settled: restored }
    }

    return { dishes, notice: 'deletedMany', undo, focus, settled }
  }

  // Others' changes (PRD story 38), from polling (useBoardSync), which asks
  // the server for the Board with `ask`: what it answers is merged into the
  // Board. Dropped if one of the module's writes was under way when it
  // asked, or started since: that change shows on the Board already, and
  // the server may have read the Board without it, which would undo it for
  // a moment. Dropped too while `paused` (a Dish is being dragged), or once
  // the page shows another Board. The next poll brings what was dropped.
  async function sync(ask: () => Promise<BoardView>, { paused = () => false }: { paused?: () => boolean } = {}) {
    const asked = mark()
    const fresh = await ask()
    if (!writesSince(asked) && !paused() && board.value?.id === fresh.id) merge(board.value, fresh)
  }

  // The Dish History of the Dishes whose detail opens, and their Comments.
  const histories = createDishHistories({ transport, find: dishId => find(dishId)?.dish, queued, isGone })

  // The Member's Votes on the Board's Dishes.
  const votes = createDishVotes({ transport, find: dishId => find(dishId)?.dish, queued })

  // How many Dishes are on the Board, the Gekocht Column's included: it
  // follows every operation and poll, as the cards do.
  const dishCount = computed(() => board.value?.columns.reduce((count, c) => count + c.dishes.length, 0) ?? 0)

  return { addDish, editDish, deleteDish, moveDish, moveToBoard, cookDish, deleteCooking, addColumn, moveDishes, deleteDishes, sync, focusAfterDetail, dishCount, ...histories, ...votes }
}

// What the transport reads rather than writes: never counted below.
const READS = new Set<keyof BoardTransport>(['dishHistory'])

// `uncounted`, counting its writes while under way and as they start, for
// sync to tell whether one was under way when a poll asked (`mark`), or
// started since (`writesSince`).
function counted(uncounted: BoardTransport) {
  let underWay = 0
  let started = 0
  const writes: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const [name, write] of Object.entries(uncounted) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    writes[name] = READS.has(name as keyof BoardTransport) ? write : (...args) => {
      underWay++
      started++
      // One that throws rather than rejecting ends like one that rejects.
      return new Promise(resolve => resolve(write(...args))).finally(() => underWay--)
    }
  }
  return {
    transport: writes as unknown as BoardTransport,
    // A mark to ask writesSince() about later; null if a write is under way.
    mark: (): number | null => underWay > 0 ? null : started,
    // Whether a write was under way at `mark`, or started since.
    writesSince: (mark: number | null) => mark === null || started !== mark,
  }
}

// Brings the Board as the app shows it up to date with the Board as the
// server has it, in place: Columns and Dishes still there stay the same
// objects, as drag and the page keep hold of them; only what changed is
// written, so nothing re-renders for nothing; and what is gone goes.
// Whatever the server has wins, as the last write did there.
function merge(shown: BoardView, fresh: BoardView) {
  const { columns, ...board } = fresh
  assignChanged(shown, board)

  const shownColumns = new Map(shown.columns.map(c => [c.id, c]))
  // By id across all Columns: a Dish may have moved to another one.
  const shownDishes = new Map(shown.columns.flatMap(c => c.dishes).map(d => [d.id, d]))
  const merged = columns.map(({ dishes, ...fields }) => {
    const column = shownColumns.get(fields.id) ?? { ...fields, dishes: [] }
    assignChanged(column, fields)
    replaceChanged(column.dishes, dishes.map((dish) => {
      const known = shownDishes.get(dish.id)
      if (!known) return dish
      assignChanged(known, dish)
      return known
    }))
    return column
  })
  replaceChanged(shown.columns, merged)
}

// Copies the fields of `source` that differ onto `target`.
function assignChanged<T extends object>(target: T, source: Partial<T>) {
  for (const key of Object.keys(source) as (keyof T)[]) {
    if (JSON.stringify(target[key]) !== JSON.stringify(source[key])) target[key] = source[key]!
  }
}

// Makes `list` hold `items`, unless it already does.
function replaceChanged<T>(list: T[], items: T[]) {
  if (list.length === items.length && list.every((item, i) => item === items[i])) return
  list.splice(0, list.length, ...items)
}

export type BoardModule = ReturnType<typeof createBoardModule>

// How the Board page hands its module to the forms under it (useBoardModule).
export const boardModuleKey: InjectionKey<BoardModule> = Symbol('board module')
