import { computed, reactive, type InjectionKey, type Ref } from 'vue'
// Relative imports, not `~~`: the module's tests run in plain Node (the
// "client" Vitest project), which knows no Nuxt aliases.
import type { BoardView } from '../../server/utils/boards'
import type { ColumnView } from '../../server/utils/columns'
import type { CookingView } from '../../server/utils/cookings'
import type { DishEditBody, AddDishBody, OfflineAddBody } from '../../server/utils/dish-input'
import type { AddedDish, CookedDish, CookingUndo, DishAdder, DishPlace, DishPlacement, DishView, MovedDish, PlacedDish, SavedDish } from '../../server/utils/dishes'
import { MILESTONE_COOKINGS } from '../utils/achievement'
import { dishOnBoard } from '../../shared/board'
import { viewerMay, type Permission } from '../../shared/permissions'
import { columnForNewDishes, landingIndex, recordsCooking } from '../../shared/placement'
import { WriteFailed, isUnanswered } from './write-failed'
import { dishOfAdd, layOver, type UnsentChange, type UnsentChanges, type UnsentKind } from './unsent-changes'
import { createDishHistories, type HistoryTransport } from './dish-histories'
import type { KeptBoards } from './kept-boards'
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
// the one it had. `notAllowed`, in place of any failure: the server
// refused a write the user's Permissions no longer allow (the Owner just
// switched one off).
export type Notice = 'deleted' | 'deleteFailed' | 'restoreFailed' | 'moveFailed' | 'cookFailed' | 'uncookFailed' | 'cook' | 'notAllowed'
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
  // The write got no answer, so the change stays on screen as an Unsent
  // Change (unsent-changes.ts) instead of failing; set on what it settled in.
  unsent?: true
}

// What an operation on several Dishes at once (#218) answers, as
// BoardResult does for one: the Dishes it was about, in Board order, a
// notice, an undo, where focus goes, and what its write ended in. Its
// notices are about the Dishes together: `movedMany`, `deletedMany` and
// `cookedMany` come with an undo; the others say a write failed
// (`notAllowedMany`: as the user's Permissions no longer allow it).
export type BulkNotice = 'movedMany' | 'deletedMany' | 'moveManyFailed' | 'deleteManyFailed' | 'restoreManyFailed' | 'returnManyFailed' | 'cookedMany' | 'cookManyFailed' | 'uncookManyFailed' | 'notAllowedMany'

export interface BulkResult {
  dishes: DishView[]
  notice?: BulkNotice
  undo?: () => Promise<BulkResult>
  focus?: FocusTarget
  settled?: Promise<BulkResult>
  // As for BoardResult.
  unsent?: true
  // For `cookDishes`, once settled: the Dishes whose new Cooking made them a
  // Klassiker, each with that Cooking, in Board order (#452 celebrates them).
  klassiker?: { dish: DishView, cooking: CookingView }[]
}

// A write the server refused or never answered (write-failed.ts).
export { WriteFailed }

// Whether a write failed because the server no longer has what it was
// about (404): another Member deleted it.
function isGone(error: unknown) {
  return error instanceof WriteFailed && error.status === 404
}

// Whether a write failed because the user's Permissions don't allow it
// (403), as the server has them: through the Board module (WriteFailed),
// or straight through $fetch, as Board settings writes.
export function isRefused(error: unknown) {
  if (error instanceof WriteFailed) return error.status === 403
  return (error as { statusCode?: number } | null)?.statusCode === 403
}

// The notice for a write that failed with `error`: `notAllowed` if the
// server refused it for the user's Permissions, else `notice`.
function failedAs(error: unknown, notice: Notice): Notice {
  return isRefused(error) ? 'notAllowed' : notice
}

// The same for a write of several Dishes.
function failedManyAs(error: unknown, notice: BulkNotice): BulkNotice {
  return isRefused(error) ? 'notAllowedMany' : notice
}

// How the module's writes reach the server: over HTTP in the app
// (http-transport.ts), in memory under test. A failed write rejects with
// WriteFailed. With the Dish History's (dish-histories.ts) and the Votes'
// (dish-votes.ts).
export interface BoardTransport extends HistoryTransport, VoteTransport {
  addDish: (boardId: string, dish: AddDishBody) => Promise<AddedDish>
  // A Dish added offline, sent once malkochen answers (unsent-changes.ts):
  // the server looks its link up then (#462).
  addDishLate: (boardId: string, dish: OfflineAddBody) => Promise<AddedDish>
  editDish: (dishId: string, changes: DishEditBody) => Promise<SavedDish>
  deleteDish: (dishId: string) => Promise<void>
  restoreDish: (dishId: string) => Promise<PlacedDish>
  // `late`, only from the Unsent Changes (unsent-changes.ts): when the change
  // was made; and, whenever a Cooking is recorded, the id the device made for
  // it, so a write sent again records it once.
  moveDish: (dishId: string, to: Destination, late?: Late) => Promise<MovedDish>
  cookDish: (dishId: string, late?: Late) => Promise<MovedDish>
  undoCooking: (cookingId: string, to: { columnId: string, index: number }) => Promise<PlacedDish>
  deleteCooking: (cookingId: string) => Promise<void>
  restoreCooking: (cookingId: string) => Promise<CookingView>
  addColumn: (boardId: string, name: string) => Promise<ColumnView>
  // Several Dishes at once (POST /api/dishes/bulk), all or nothing.
  moveDishes: (dishIds: string[], columnId: string) => Promise<PlacedDish[]>
  placeDishes: (places: DishPlace[]) => Promise<PlacedDish[]>
  deleteDishes: (dishIds: string[]) => Promise<void>
  restoreDishes: (dishIds: string[]) => Promise<PlacedDish[]>
  // "Gekocht ✓" on several (#451): each with the Cooking recorded, in the
  // order sent; and its undo, answering the Dishes placed, in that order.
  cookDishes: (dishIds: string[], late?: { cookingIds?: string[], madeAt?: string }) => Promise<CookedDish[]>
  uncookDishes: (cookings: CookingUndo[]) => Promise<PlacedDish[]>
}

export interface Late {
  cookingId?: string
  madeAt?: string
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
  // The Unsent Change the move became, while it is one.
  unsentId?: string
}

function placeOf(column: BoardColumn, index: number): Place {
  return { columnId: column.id, index, above: column.dishes[index - 1]?.id, below: column.dishes[index + 1]?.id }
}

// Takes `item` out of `list`, if it is in it.
function removeFrom<T>(list: T[], item: T | undefined) {
  const at = item === undefined ? -1 : list.indexOf(item)
  if (at !== -1) list.splice(at, 1)
}

// With `unsent` (one for the whole app, shared by every Board's module), a
// move or "Gekocht ✓" whose write gets no answer stays on screen and is kept
// as an Unsent Change; without it the module behaves as ever. With `kept`
// (kept-boards.ts), every load that merges keeps the Board on the device, as
// the server said it, and a Dish History opened is kept too. `offline`: the
// app knows malkochen can't be reached, so nothing is asked of it (opening a
// Dish marks it seen, which offline it doesn't).
export function createBoardModule(board: Ref<BoardView | undefined>, uncounted: BoardTransport, { unsent, kept, offline }: { unsent?: UnsentChanges, kept?: KeptBoards, offline?: () => boolean } = {}) {
  // Every write goes through `transport`, so each is counted for sync.
  const { transport, mark, writesSince } = counted(uncounted)

  // Cookings shown before the server has answered for them. Each has the id
  // the device made for it, which the server keeps. Those in an Unsent Change
  // are in the Unsent Changes' list instead (isRecording).
  const recording = reactive(new Set<string>())
  const isRecording = (cookingId: string) => recording.has(cookingId) || !!unsent?.hasCooking(cookingId)

  // Whether Unsent Changes wait: then new ones join their end, nothing is
  // tried on the network.
  const anyUnsent = () => (unsent?.count.value ?? 0) > 0

  // Keeps a change as an Unsent Change, and tries to send them all.
  function keep(kind: UnsentKind, madeAt: string, label: string): string {
    const change = { id: crypto.randomUUID(), boardId: board.value!.id, madeAt, label, ...kind } as UnsentChange
    unsent!.add(change)
    void unsent!.send()
    return change.id
  }

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

  // Whether the user may take an action `permission` covers on this Board,
  // on the Dish `dishId` if it is about one: their Permissions as the Board
  // last loaded, as the server would decide (shared/permissions.ts). The
  // page hides what isn't allowed; each operation refuses it, before any
  // change shows.
  function may(permission: Permission, dishId?: string): boolean {
    if (!board.value) return false
    return viewerMay(board.value, permission, dishId === undefined ? undefined : { addedBy: find(dishId)?.dish.addedBy?.id })
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
  // the same object and filled in. The pending one has the id the device
  // made for it, which the server kept.
  function keepShownCookings(shown: CookingView[], settled: CookingView[], recorded: CookingView | undefined): CookingView[] {
    return settled.map((cooking) => {
      const same = shown.find(c => c.id === cooking.id)
      if (cooking.id === recorded?.id) recording.delete(cooking.id)
      return same ? Object.assign(same, cooking) : cooking
    })
  }

  // Adding a Dish (PRD story 13), from Add Dish, which waits for it: nothing
  // shows before the server has it. Saved to this Board, it shows where the
  // server put it, at the top of the Column that takes new Dishes as the
  // server has the Columns; saved to another Board, it doesn't show here.
  // A failed write rejects with WriteFailed, for the form to say so; on
  // this Board without "add Dishes" (its Permissions as last loaded), at
  // once with 403, as the server would.
  //
  // Offline (#462) it is kept instead, if `adder` (who adds it) is given and
  // it is for this Board, from a link and/or a title, without an Own Photo
  // and not during the Tour: it shows at once at the top of the Column that
  // takes new Dishes, as an Unsent Change, and the server looks its link up
  // when it arrives. The same when a save gets no answer, or while Unsent
  // Changes wait (it joins their end). Its id is the device's own, sent online
  // too, so a save whose answer was lost is recorded once.
  async function addDish(boardId: string, input: AddDishBody, adder?: DishAdder): Promise<BoardResult> {
    if (board.value?.id === boardId && !board.value.permissions.addDishes) throw new WriteFailed(403)
    const title = input.title.trim()
    const link = input.source?.link ?? null
    const keepable = !!(unsent && adder && board.value?.id === boardId && !input.photo && !input.tour && (title || link))
    const dishId = input.id ?? crypto.randomUUID()
    if (keepable && (offline?.() || anyUnsent())) return keepAdded(dishId, input, adder)
    let answer: AddedDish
    try {
      answer = await transport.addDish(boardId, { ...input, id: dishId })
    }
    catch (error) {
      if (keepable && isUnanswered(error)) return keepAdded(dishId, input, adder)
      throw error
    }
    const { imageNotStored, placement, ...fields } = answer
    // Another Board's Column isn't on this one.
    const into = column(placement.columnId)
    if (into && !find(fields.id)) insert(into, placement.index, fields)
    // The Board's own copy, once it shows.
    const dish = find(fields.id)?.dish ?? fields
    return { dish, placement, ...imageNotStored && { notice: input.photo ? 'photoNotStored' : 'imageNotStored' } }
  }

  // Shows a Dish added at once and keeps it as an Unsent Change.
  function keepAdded(dishId: string, input: AddDishBody, adder: DishAdder | undefined): BoardResult {
    const into = columnForNewDishes(board.value!.columns)
    if (!into || !adder) throw new WriteFailed()
    const link = input.source?.link ?? null
    const title = input.title.trim() || null
    const madeAt = new Date().toISOString()
    const kind = { kind: 'add', dishId, link, title, placeholder: input.placeholder, adder } as const
    const shown = dishOfAdd({ id: '', boardId: board.value!.id, madeAt, label: '', ...kind })
    into.dishes.unshift(shown)
    keep(kind, madeAt, shown.title)
    return { dish: find(dishId)?.dish ?? shown, placement: { boardId: board.value!.id, columnId: into.id, index: 0 }, unsent: true }
  }

  // Whether the Dish was added offline and has not arrived yet. What needs
  // the server to have it (deleting it, moving it to another Board, editing
  // more than its title, its image, Creator and Source, archiving, sharing,
  // copying) is greyed out until then; moves within the Board, "Gekocht ✓",
  // Comments, Votes and its title go on, and are sent after it.
  function isUnsentAdd(dishId: string): boolean {
    return !!unsent?.changes.value.some(c => c.kind === 'add' && c.dishId === dishId)
  }

  // The Dishes added offline that have arrived since: the Board's card takes
  // the Dish as the server made it (its code, title, image, Creator), keeping
  // its Cookings, Votes and Comment count, which others unsent still change.
  function takeArrivals() {
    if (!unsent || !board.value) return
    for (const { dish } of unsent.takeArrivals(board.value.id)) {
      const { placement: _, imageNotStored: __, duplicateOf: ___, cookings: ____, votes: _____, commentCount: ______, ...fields } = dish
      const shown = find(dish.id)?.dish
      if (!shown) continue
      // The code it was shown with still leads to it (an open detail).
      arrivedCodes.set(shown.code, shown.id)
      Object.assign(shown, fields)
    }
  }
  const arrivedCodes = reactive(new Map<string, string>())

  // The id of the Dish that was added offline, shown with `code` until it
  // arrived; null for any other code.
  const arrivedAs = (code: string): string | null => arrivedCodes.get(code) ?? null

  // Changes malkochen couldn't apply were dropped: a Dish added offline goes
  // from the Board, and the Comments among them from the open Dish History.
  function droppedChanges(dropped: readonly UnsentChange[]) {
    for (const change of dropped) {
      if (change.kind === 'add' && board.value?.id === change.boardId) takeOut(change.dishId)
    }
    return histories.droppedChanges(dropped)
  }

  // Editing a Dish (PRD stories 43–45), from the Dish detail, which waits
  // for it: once saved, its card and the detail show the Dish as the server
  // saved it. It waits for the Dish's writes before it, so their answers
  // can't bring back what it changed. The Cooking History and Votes stay
  // the Board's own: an edit never changes them, and a Cooking still being
  // recorded or a Vote under way shows there. A failed
  // write rejects with WriteFailed, for the form to say so; without "edit
  // Dishes" for it, at once with 403, as the server would.
  //
  // An edit of the title alone (the only field that works offline) whose
  // write gets no answer, or that is made while Unsent Changes wait, shows
  // at once and is kept as an Unsent Change instead; it wins over what
  // others changed meanwhile.
  async function editDish(dishId: string, changes: DishEditBody): Promise<BoardResult> {
    if (!may('editDishes', dishId)) throw new WriteFailed(403)
    const title = changes.title?.trim()
    const titleOnly = !!title && Object.keys(changes).length === 1
    // The server has nothing to change yet but the title, which is sent after the add.
    if (isUnsentAdd(dishId) && !titleOnly) throw new WriteFailed()
    const kept = Symbol('kept')
    const madeAt = new Date().toISOString()
    const answer = await queued(dishId, async () => {
      if (titleOnly && unsent && anyUnsent()) return kept
      try {
        return await transport.editDish(dishId, changes)
      }
      catch (error) {
        if (titleOnly && unsent && isUnanswered(error)) return kept
        throw error
      }
    }, { moves: false })
    if (answer === kept) {
      const dish = find(dishId)?.dish
      if (!dish) throw new WriteFailed(404)
      keep({ kind: 'title', dishId, title: title! }, madeAt, dish.title)
      dish.title = title!
      return { dish, unsent: true }
    }
    const { imageNotStored, ...saved } = answer
    const shown = find(dishId)?.dish
    if (shown) {
      const { cookings: _, votes: __, ...fields } = saved
      Object.assign(shown, fields)
    }
    return { dish: shown ?? saved, ...imageNotStored && { notice: 'imageNotReplaced' } }
  }

  // Deleting a Dish (PRD story 47): its card goes at once. If the delete
  // fails, it comes back with a notice; one the server no longer has
  // (another Member deleted it) counts as deleted. Null without "archive
  // Dishes" for it.
  function deleteDish(dishId: string): BoardResult | null {
    const found = find(dishId)
    if (!found || !may('archiveDishes', dishId) || isUnsentAdd(dishId)) return null
    const { dish } = found
    const { origin: place, focus } = leave(dish, found.column)
    focusWhenGone.set(dishId, focus)

    // Why it wasn't deleted, as a notice; none once it is.
    const notDeleted = queued(dishId, () => transport.deleteDish(dishId)).then(() => null, (error: unknown): Notice | null => {
      if (isGone(error)) return null
      putBack(dish, place)
      return failedAs(error, 'deleteFailed')
    })
    const settled = notDeleted.then((notice): BoardResult => notice ? { dish, notice } : { dish })

    // "Rückgängig": once the delete has settled, the Dish is back at once,
    // with focus on it, and then where the server restored it. If that
    // fails, it goes again, with a notice.
    async function undo(): Promise<BoardResult> {
      if (await notDeleted) return { dish } // Never deleted, and back already.
      const back = putBack(dish, place)
      const restored = queued(dishId, () => transport.restoreDish(dishId)).then((placed): BoardResult => {
        settle(dish, placed)
        // Its Column was gone, so only now is it back to focus.
        return back ? { dish } : { dish, focus: { dish: dishId } }
      }, (error: unknown): BoardResult => {
        takeOut(dishId)
        return { dish, notice: failedAs(error, 'restoreFailed') }
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
  // offers "Rückgängig". Null if it wouldn't move or record one, or without
  // "move Dishes".
  function moveDish(dishId: string, to: Destination): BoardResult | null {
    return move(dishId, to)
  }

  // "Gekocht ✓" (PRD story 35): to the top of the Gekocht Column, or where
  // it is if it is there already, recording a Cooking either way.
  function cookDish(dishId: string): BoardResult | null {
    const gekocht = board.value?.columns.find(c => c.isGekocht)
    return gekocht ? move(dishId, { columnId: gekocht.id }, { cook: true }) : null
  }

  // Moves a Dish as moveDish says (`cook`: as cookDish does). Without an
  // answer from malkochen the move stays and is kept as an Unsent Change; so
  // is one made while Unsent Changes wait, without trying the network.
  function move(dishId: string, to: Destination, { cook = false } = {}): BoardResult | null {
    const found = find(dishId)
    const target = column(to.columnId)
    if (!found || !target || !board.value || !may('moveDishes')) return null
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
    const cookingId = cooks ? crypto.randomUUID() : undefined
    const madeAt = new Date().toISOString()
    const pending = cookingId ? recordPending(dish, cookingId, madeAt) : undefined
    const ended: MoveEnded = { failed: false, undone: false }
    const write = () => cook
      ? transport.cookDish(dishId, { cookingId })
      : transport.moveDish(dishId, to, cookingId ? { cookingId } : undefined)
    // The Dish stays where it is on screen; the change waits to be sent.
    function keepUnsent(): BoardResult {
      rolledBackTo.delete(dishId)
      if (cookingId) recording.delete(cookingId)
      const kind: UnsentKind = cook
        ? { kind: 'cook', dishId, cookingId: cookingId! }
        : { kind: 'move', dishId, columnId: target!.id, ...to.index !== undefined && { index: to.index }, ...cookingId && { cookingId } }
      ended.unsentId = keep(kind, madeAt, dish.title)
      return { dish, placement, unsent: true, ...pending && { cooking: pending } }
    }

    const settled = queued(dishId, async (latest): Promise<BoardResult> => {
      if (anyUnsent()) return keepUnsent()
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
        // No answer: the move may or may not have arrived. It stays, and is
        // sent again with the same ids.
        if (unsent && isUnanswered(error)) return keepUnsent()
        ended.failed = true
        if (isGone(error)) {
          takeOut(dishId)
          dropCooking(dish, pending)
          return { dish }
        }
        // Back where the server still has it. A later write moves it on, or
        // goes back there in turn.
        const back = rollBackTo(dishId, origin)
        dropCooking(dish, pending)
        // Undone already, it is back, and nothing is left to tell.
        if (ended.undone) return { dish }
        if (latest()) moveBack(dish, back)
        return { dish, notice: failedAs(error, cooks ? 'cookFailed' : 'moveFailed') }
      }
    })

    return { dish, placement, focus, settled, ...pending && { cooking: pending, notice: 'cook', undo: undoCooked(dish, origin, pending, ended, true) } }
  }

  // The Cooking a move records, shown in the Dish's Cooking History at once
  // with the id the device made for it and the time it was tapped, and
  // filled in once the server has recorded it. The Board's own (reactive)
  // copy, so filling it in shows.
  function recordPending(dish: DishView, id: string, cookedAt: string): CookingView {
    dish.cookings.unshift({ id, cookedAt, recordedBy: null })
    recording.add(id)
    return dish.cookings[0]!
  }

  // Takes a Cooking out of the Dish's Cooking History, found by its id (a
  // Board load may have replaced the object).
  function dropCooking(dish: DishView, cooking: { id: string } | undefined) {
    if (!cooking) return
    recording.delete(cooking.id)
    const at = dish.cookings.findIndex(c => c.id === cooking.id)
    if (at !== -1) dish.cookings.splice(at, 1)
  }

  // Fills in the pending Cooking as the server recorded it, or takes it out
  // of the Cooking History if the server recorded none.
  function settlePending(dish: DishView, pending: CookingView | undefined, recorded: CookingView | undefined) {
    if (pending && recorded) {
      recording.delete(pending.id)
      Object.assign(dish.cookings.find(c => c.id === pending.id) ?? pending, recorded)
    }
    else dropCooking(dish, pending)
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
  //
  // On this Board (`keepable`), what is unsent is taken back without
  // sending anything; a Cooking the server has recorded (or that was sent
  // since) is taken off by an Unsent Change when malkochen doesn't answer.
  function undoCooked(dish: DishView, origin: Place, pending: CookingView, ended: MoveEnded, keepable = false) {
    const dishId = dish.id
    return async (): Promise<BoardResult> => {
      if (ended.failed) return { dish }
      ended.undone = true
      const now = find(dishId)
      const cooked = now && placeOf(now.column, now.column.dishes.indexOf(now.dish))
      moveBack(dish, origin)
      dropCooking(dish, pending)

      const back = { columnId: origin.columnId, index: origin.index }
      const undoing = queued(dishId, async (latest): Promise<BoardResult> => {
        if (ended.failed) return { dish }
        // Still unsent: taken back, and nothing is sent.
        if (unsent && ended.unsentId && await unsent.cancel(ended.unsentId)) {
          ended.unsentId = undefined
          return { dish, unsent: true }
        }
        // Recorded: answered, or sent from the Unsent Changes since.
        const recorded = ended.recorded ?? (ended.unsentId ? pending : undefined)
        const keepUncook = (): BoardResult => {
          keep({ kind: 'uncook', dishId, cookingId: pending.id, back }, new Date().toISOString(), dish.title)
          return { dish, unsent: true }
        }
        if (keepable && unsent && recorded && anyUnsent()) return keepUncook()
        try {
          const placed = recorded ? await transport.undoCooking(recorded.id, back) : await transport.moveDish(dishId, back)
          if (latest()) settle(dish, placed)
          return { dish, placement: placed.placement }
        }
        catch (error) {
          if (keepable && unsent && recorded && isUnanswered(error)) return keepUncook()
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
              return { dish, notice: failedAs(error, 'uncookFailed'), focus }
            }
          }
          return { dish, notice: failedAs(error, 'uncookFailed') }
        }
      })
      return { dish, focus: { dish: dishId }, settled: undoing }
    }
  }

  // Moving a Dish to a Column on another of the Member's Boards (PRD story
  // 46): it leaves this Board at once, for the top of that Column, keeping
  // its Cooking History. If the move fails, it comes back exactly where it
  // was, with a notice; one the server no longer has (another Member
  // deleted it) stays gone. Null if it isn't on this Board, or without
  // "move Dishes".
  //
  // Into that Board's Gekocht Column it records a Cooking, as a move into
  // this Board's would (#129): it shows in the Dish's Cooking History at
  // once, and the Gekocht toast (`cook`) offers "Rückgängig", which brings
  // the Dish back here.
  function moveToBoard(dishId: string, to: BoardDestination): BoardResult | null {
    const found = find(dishId)
    if (!found || !may('moveDishes') || isUnsentAdd(dishId)) return null
    const { dish } = found
    const cooks = recordsCooking(found.column, { id: to.columnId, isGekocht: to.isGekocht })
    const { origin, focus } = leave(dish, found.column)
    focusWhenGone.set(dishId, focus)
    const cookingId = cooks ? crypto.randomUUID() : undefined
    const pending = cookingId ? recordPending(dish, cookingId, new Date().toISOString()) : undefined
    const ended: MoveEnded = { failed: false, undone: false }

    const settled = queued(dishId, async (latest): Promise<BoardResult> => {
      try {
        const moved = await transport.moveDish(dishId, { columnId: to.columnId }, cookingId ? { cookingId } : undefined)
        ended.recorded = moved.cooking
        rolledBackTo.delete(dishId)
        settlePending(dish, pending, moved.cooking)
        return { dish, placement: moved.placement, ...shownCooking(dish, moved.cooking) }
      }
      catch (error) {
        ended.failed = true
        dropCooking(dish, pending)
        if (isGone(error)) return { dish }
        // Back where the server still has it.
        const back = rollBackTo(dishId, origin)
        // Undone already, it is back, and nothing is left to tell.
        if (ended.undone) return { dish }
        if (latest()) moveBack(dish, back)
        return { dish, notice: failedAs(error, cooks ? 'cookFailed' : 'moveFailed') }
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
  // Null without "move Dishes", which covers what the Gekocht Column says.
  function deleteCooking(dishId: string, cookingId: string): BoardResult | null {
    if (!may('moveDishes')) return null
    const found = find(dishId)
    // One still being recorded isn't on the server yet: nothing to delete there.
    const at = isRecording(cookingId) ? -1 : found?.dish.cookings.findIndex(c => c.id === cookingId) ?? -1
    if (!found || at === -1) return null
    const { dish } = found
    const [cooking] = dish.cookings.splice(at, 1) as [CookingView]


    // Why it wasn't deleted, as a notice; none once it is.
    const notDeleted = queued(cookingId, () => transport.deleteCooking(cookingId)).then(() => null, (error: unknown): Notice | null => {
      if (isGone(error)) return null
      putBackCooking(dishId, cooking)
      return failedAs(error, 'cookingDeleteFailed')
    })
    const settled = notDeleted.then((notice): BoardResult => notice ? { dish, cooking, notice } : { dish, cooking })

    // "Rückgängig": once the delete has settled, the Cooking is back in
    // its Dish's Cooking History at once, and as the server restored it.
    // If that fails, it goes again, with a notice.
    async function undo(): Promise<BoardResult> {
      if (await notDeleted) return { dish, cooking } // Never deleted, and back already.
      putBackCooking(dishId, cooking)
      const restored = queued(cookingId, () => transport.restoreCooking(cookingId)).then((fields): BoardResult => {
        const back = find(dishId)?.dish.cookings.find(c => c.id === cookingId)
        if (back) Object.assign(back, fields)
        return { dish, cooking: back ?? cooking }
      }, (error: unknown): BoardResult => {
        const now = find(dishId)?.dish
        if (now) removeFrom(now.cookings, now.cookings.find(c => c.id === cookingId))
        return { dish, cooking, notice: failedAs(error, 'cookingRestoreFailed') }
      })
      return { dish, cooking, settled: restored }
    }

    return { dish, cooking, notice: 'cookingDeleted', undo, settled }
  }

  // A new Column (from the Board's add lane, on desktop): once the server
  // has added it, at the end, it shows there, empty. Not optimistic, as it
  // has no id before. A failed write rejects with WriteFailed, for the form
  // to say so; without "edit Columns", at once with 403, as the server would.
  async function addColumn(name: string): Promise<ColumnView> {
    const boardId = board.value?.id
    if (!boardId) throw new WriteFailed()
    if (!may('editColumns')) throw new WriteFailed(403)
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
  // then where the server put them. Never into a Gekocht Column: that is
  // cookDishes. If the move fails, every Dish goes back exactly where it
  // was, with a notice. Null if none would move, or without "move Dishes".
  function moveDishes(dishIds: string[], to: Destination | BoardDestination): BulkResult | null {
    if (!may('moveDishes')) return null
    const here = 'boardId' in to ? null : column(to.columnId)
    if ('boardId' in to ? to.isGekocht : !here || here.isGekocht) return null
    const moving = inBoardOrder(dishIds).filter(f => f.column !== here)
    if (moving.length === 0 || moving.some(f => isUnsentAdd(f.dish.id))) return null
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
      catch (error) {
        // Back where the server still has them.
        putAllBack(dishes, dishes.map((dish, i) => rollBackTo(dish.id, origins[i]!)), latest)
        return { dishes, notice: failedManyAs(error, 'moveManyFailed') }
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
        catch (error) {
          moveOn()
          return { dishes, notice: failedManyAs(error, 'returnManyFailed') }
        }
      })
      return { dishes, focus: { dish: ids[0]! }, settled: returned }
    }

    return { dishes, notice: 'movedMany', undo, focus: here ? { column: here.id } : focus, settled }
  }

  // "Gekocht ✓" on several selected Dishes (#451): each records a Cooking, as
  // the card's own does for one. Those not in the Gekocht Column yet go to
  // the top of it at once, in Board order; one already there stays put. Each
  // Dish shows a pending Cooking at once, filled in once the server has
  // recorded it. If the write fails, every Dish goes back exactly where it
  // was, without its Cooking, with a notice. Null without "move Dishes",
  // without a Gekocht Column, or if none of them is on the Board.
  function cookDishes(dishIds: string[]): BulkResult | null {
    const gekocht = board.value?.columns.find(c => c.isGekocht)
    if (!may('moveDishes') || !gekocht) return null
    const found = inBoardOrder(dishIds)
    if (found.length === 0) return null
    const dishes = found.map(f => f.dish)
    const ids = dishes.map(d => d.id)
    const moving = found.filter(f => f.column !== gekocht)
    const movers = moving.map(f => f.dish)
    const moverIds = movers.map(d => d.id)
    const left = moving.length > 0 ? leaveAll(moving) : null
    const origins = left?.origins ?? []
    // Where the cook puts the moving ones, as this Board shows it: at the
    // top of the Gekocht Column, in Board order.
    function intoGekocht() {
      for (const id of moverIds) takeOut(id)
      movers.forEach((dish, i) => insert(gekocht!, i, dish))
    }
    intoGekocht()
    const cookingIds = dishes.map(() => crypto.randomUUID())
    const madeAt = new Date().toISOString()
    const pendings = dishes.map((dish, i) => recordPending(dish, cookingIds[i]!, madeAt))
    // The Cookings the server recorded, for "Rückgängig".
    const recorded = new Map<string, CookingView>()
    let unsentId: string | undefined

    // Where malkochen doesn't answer, the Dishes stay cooked on screen, and
    // the Klassiker are told by the phone's count (#452).
    function keepUnsent(): BulkResult {
      for (const id of cookingIds) recording.delete(id)
      for (const id of ids) rolledBackTo.delete(id)
      unsentId = keep({ kind: 'cookMany', dishIds: ids, cookingIds }, madeAt, dishes.map(d => d.title).join(', '))
      const klassiker = dishes
        .map((dish, i) => ({ dish, cooking: pendings[i]! }))
        .filter(({ dish }) => dish.cookings.length === MILESTONE_COOKINGS)
      return { dishes, klassiker, unsent: true }
    }

    const settled = queued(ids, async (latest): Promise<BulkResult> => {
      if (anyUnsent()) return keepUnsent()
      try {
        const answers = await transport.cookDishes(ids, { cookingIds })
        for (const answer of answers) {
          const i = ids.indexOf(answer.id)
          const dish = dishes[i]
          if (!dish) continue
          recorded.set(dish.id, answer.cooking)
          if (latest(dish.id)) settle(dish, answer)
          else settlePending(dish, pendings[i], answer.cooking)
        }
        for (const id of ids) rolledBackTo.delete(id)
        // The Dishes this Cooking made a Klassiker (#452 celebrates them).
        const klassiker = dishes
          .filter(d => answers.find(a => a.id === d.id)?.cookings.length === MILESTONE_COOKINGS)
          .map(dish => ({ dish, cooking: recorded.get(dish.id)! }))
        return { dishes, klassiker }
      }
      catch (error) {
        if (unsent && isUnanswered(error)) return keepUnsent()
        // Back where the server still has them, without the Cookings.
        dishes.forEach((dish, i) => dropCooking(dish, pendings[i]))
        putAllBack(movers, movers.map((dish, i) => rollBackTo(dish.id, origins[i]!)), latest)
        return { dishes, notice: failedManyAs(error, 'cookManyFailed') }
      }
    })

    // "Rückgängig": once the cook has settled, every moved Dish is back
    // where it was at once, the batch's Cookings are off their Dishes, and
    // focus is on the first; then the write takes them off the server. If
    // that fails, they are cooked again as the server still has them, with a
    // notice.
    async function undo(): Promise<BulkResult> {
      if ((await settled).notice) return { dishes } // Never cooked, and back already.
      putAllBack(movers, origins)
      // The Cookings as shown, with the ids the device made for them.
      const cookings = dishes.map((dish, i) => recorded.get(dish.id) ?? pendings[i]!)
      dishes.forEach((dish, i) => dropCooking(dish, cookings[i]))
      const undos = dishes.map((dish, i) => {
        const origin = origins[moverIds.indexOf(dish.id)]
        return { cookingId: cookingIds[i]!, ...origin && { back: { columnId: origin.columnId, index: origin.index } } }
      })
      const keepUncook = (): BulkResult => {
        keep({ kind: 'uncookMany', dishIds: ids, cookings: undos }, new Date().toISOString(), dishes.map(d => d.title).join(', '))
        return { dishes, unsent: true }
      }
      const uncooked = queued(ids, async (latest): Promise<BulkResult> => {
        // Still unsent: taken back, and nothing is sent.
        if (unsent && unsentId && await unsent.cancel(unsentId)) {
          unsentId = undefined
          return { dishes, unsent: true }
        }
        if (unsent && anyUnsent()) return keepUncook()
        try {
          settleAll(dishes, await transport.uncookDishes(undos), latest)
          return { dishes }
        }
        catch (error) {
          if (unsent && isUnanswered(error)) return keepUncook()
          intoGekocht()
          if (!isGone(error)) dishes.forEach((dish, i) => putBackCooking(dish.id, cookings[i]!))
          return { dishes, notice: failedManyAs(error, 'uncookManyFailed') }
        }
      })
      return { dishes, focus: { dish: ids[0]! }, settled: uncooked }
    }

    return { dishes, notice: 'cookedMany', undo, focus: left?.focus ?? { dish: ids[0]! }, settled }
  }

  // Deleting several selected Dishes (#218): their cards go at once. If the
  // delete fails, they come back with a notice. Null unless "archive
  // Dishes" holds for every one of them.
  function deleteDishes(dishIds: string[]): BulkResult | null {
    const found = inBoardOrder(dishIds)
    if (found.length === 0 || found.some(f => !may('archiveDishes', f.dish.id) || isUnsentAdd(f.dish.id))) return null
    const dishes = found.map(f => f.dish)
    const ids = dishes.map(d => d.id)
    const { origins, focus } = leaveAll(found)
    for (const id of ids) focusWhenGone.set(id, focus)

    const settled = queued(ids, async (): Promise<BulkResult> => {
      try {
        await transport.deleteDishes(ids)
        return { dishes }
      }
      catch (error) {
        putAllBack(dishes, origins)
        return { dishes, notice: failedManyAs(error, 'deleteManyFailed') }
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
        catch (error) {
          for (const id of ids) takeOut(id)
          return { dishes, notice: failedManyAs(error, 'restoreManyFailed') }
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
  // the page shows another Board. The next poll brings what was dropped:
  // answers whether it merged, and only a merged answer moves on the
  // Board's version, so the next check still sees a dropped one as new.
  async function sync(ask: () => Promise<BoardView>, { paused = () => false }: { paused?: () => boolean } = {}): Promise<boolean> {
    const asked = mark()
    const sending = unsent?.mark() ?? null
    const fresh = await ask()
    // A send of Unsent Changes counts as a write under way. Waiting ones
    // don't: they are laid over what the server says, so nothing flickers.
    if (writesSince(asked) || (unsent && unsent.sentSince(sending)) || paused() || board.value?.id !== fresh.id) return false
    // Kept as the server says it, before the Unsent Changes are laid over it:
    // a change dropped on arrival must not stick in the kept copy.
    void kept?.keep(fresh)
    if (unsent) layOver(fresh, unsent.forBoard(fresh.id))
    merge(board.value, fresh)
    return true
  }

  // Shows the Unsent Changes kept on the device (or made on another page
  // before) on this Board, once they are loaded: as a Board load brings it
  // from the server, nothing of them is there.
  async function layOverUnsent() {
    if (!unsent) return
    await unsent.ready
    if (board.value) layOver(board.value, unsent.forBoard(board.value.id))
  }

  // The Board Version (ADR 0008) of the Board as the app shows it.
  const version = () => board.value?.version

  // Takes a Dish off the ones with something new in their Dish History.
  function clearNewInHistory(dishId: string) {
    if (board.value) removeFrom(board.value.newInHistoryDishIds, dishId)
  }

  // The Dish History of the Dishes whose detail opens, and their Comments.
  const histories = createDishHistories({ transport, offline, isUnsentAdd, kept: kept && { keep: (dishId, history) => { if (board.value) void kept.keepHistory(board.value.id, dishId, history) }, history: kept.history }, find: dishId => find(dishId)?.dish, clearNewInHistory, queued, isGone, isRefused, mayComment: () => may('commentAndVote'), unsent, keep, anyUnsent })

  // The Member's Votes on the Board's Dishes.
  const votes = createDishVotes({ transport, find: dishId => find(dishId)?.dish, queued, isRefused, mayVote: () => may('commentAndVote'), unsent, keep, anyUnsent })

  // How many Dishes are on the Board, the Gekocht Column's included: it
  // follows every operation and poll, as the cards do.
  const dishCount = computed(() => board.value?.columns.reduce((count, c) => count + c.dishes.length, 0) ?? 0)

  return { addDish, editDish, deleteDish, moveDish, moveToBoard, cookDish, deleteCooking, addColumn, moveDishes, cookDishes, deleteDishes, sync, layOverUnsent, version, focusAfterDetail, dishCount, may, isRecording, isUnsentAdd, takeArrivals, arrivedAs, ...histories, ...votes, droppedChanges }
}

// `uncounted`, counting its writes while under way and as they start, for
// sync to tell whether one was under way when a poll asked (`mark`), or
// started since (`writesSince`).
function counted(uncounted: BoardTransport) {
  let underWay = 0
  let started = 0
  const writes: Record<string, (...args: unknown[]) => Promise<unknown>> = {}
  for (const [name, write] of Object.entries(uncounted) as [string, (...args: unknown[]) => Promise<unknown>][]) {
    writes[name] = (...args) => {
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
