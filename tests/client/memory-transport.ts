import type { BoardTransport } from '../../app/board/board-module'
import { WriteFailed } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import type { CookingView } from '../../server/utils/cookings'
import type { DishEditBody, AddDishBody } from '../../server/utils/dish-input'
import type { AddedDish, DishView, MovedDish, PlacedDish, SavedDish } from '../../server/utils/dishes'
import { columnForNewDishes, landingIndex, recordsCooking } from '../../shared/placement'

// The in-memory transport for the client Board module's tests: a small fake
// of the server, holding its own copy of the Board. Tests change that copy
// as another Member would (deleting a Dish or a Column elsewhere), and can
// tell the next call of a write to fail with a status or to stay pending
// until they settle it.

type Write = keyof BoardTransport

// A call held pending: it does nothing on the server until it succeeds.
export interface Held {
  succeed: () => void
}

type Reply = { fail: number } | { hold: (held: Held) => void }

export interface MemoryTransport {
  transport: BoardTransport
  // The Board as the server has it.
  server: BoardView
  // The writes sent, in order, as "deleteDish b" or "moveDish b woche 1".
  sent: string[]
  // The next call of `write` fails with `status`, changing nothing.
  failNext: (write: Write, status: number) => void
  // The next call of `write` stays pending until the test lets it succeed.
  holdNext: (write: Write) => Held
  // Another Member deletes a Dish, or a Column (its deleted Dishes go to
  // the top of the Column that takes new Dishes, as on the real server).
  deleteDishElsewhere: (dishId: string) => void
  deleteColumnElsewhere: (columnId: string) => void
  // Another Member deletes a Cooking from its Dish's Cooking History.
  deleteCookingElsewhere: (cookingId: string) => void
}

export function memoryTransport(board: BoardView): MemoryTransport {
  const server = structuredClone(board)
  const sent: string[] = []
  const replies = new Map<Write, Reply[]>()
  // Deleted Dishes keep their Column and index, so restoring puts them back.
  const deleted = new Map<string, { dish: DishView, columnId: string, index: number }>()
  // Deleted Cookings keep their Dish, so restoring puts them back.
  const deletedCookings = new Map<string, { cooking: CookingView, dishId: string }>()
  let cookings = 0
  let added = 0

  // The Dish on the server that `matches`, and its Column.
  function located(matches: (dish: DishView) => boolean) {
    for (const column of server.columns) {
      const dish = column.dishes.find(matches)
      if (dish) return { dish, column }
    }
    return null
  }

  // Moves a Dish as the server does (shared/placement.ts), recording a
  // Cooking where the rules say so; without a Column, to the Gekocht Column
  // ("Gekocht ✓"). Null for a Dish the server doesn't have.
  function moveOnServer(dishId: string, columnId: string | undefined, index: number | undefined, cook: boolean): MovedDish | null {
    const found = located(d => d.id === dishId)
    const target = server.columns.find(c => columnId === undefined ? c.isGekocht : c.id === columnId)
    if (!found) return null
    if (!target) throw new WriteFailed(400)
    const to = landingIndex(target, dishId, index)
    found.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
    target.dishes.splice(to, 0, found.dish)
    const placed = { ...structuredClone(found.dish), placement: { boardId: server.id, columnId: target.id, index: to } }
    if (!recordsCooking(found.column, target, { cook })) return placed
    const cooking = { id: `cooking-${++cookings}`, cookedAt: new Date().toISOString(), note: null, recordedBy: null }
    found.dish.cookings.unshift(cooking)
    return { ...placed, cookings: structuredClone(found.dish.cookings), cooking: structuredClone(cooking) }
  }

  // Removes a Cooking and puts its Dish at `index` in a Column, if it is
  // still in the Gekocht Column (400 otherwise, as on the server).
  function undoOnServer(cookingId: string, columnId: string, index: number): PlacedDish | null {
    const found = located(dish => dish.cookings.some(c => c.id === cookingId))
    if (!found) return null
    if (!found.column.isGekocht) throw new WriteFailed(400)
    found.dish.cookings = found.dish.cookings.filter(c => c.id !== cookingId)
    return moveOnServer(found.dish.id, columnId, index, false)
  }

  // Adds a Dish as the server does: at the top of the Column that takes new
  // Dishes. One for another Board just answers it placed there. A Source
  // image without its Image Ticket isn't stored, as on the server.
  function addOnServer(boardId: string, input: AddDishBody): AddedDish {
    const dish: DishView = {
      id: `added-${++added}`,
      title: input.title,
      note: input.note || null,
      source: input.source ? { link: input.source.link, kind: input.source.kind ?? 'other' } : null,
      imageUrl: input.imageUrl && input.imageTicket ? `/images/added-${added}.jpg` : null,
      placeholder: input.placeholder,
      addedBy: null,
      createdAt: new Date().toISOString(),
      cookings: [],
    }
    const column = boardId === server.id ? columnForNewDishes(server.columns)! : { id: 'elsewhere', dishes: [] as DishView[] }
    column.dishes.unshift(dish)
    const placed = { ...structuredClone(dish), placement: { boardId, columnId: column.id, index: 0 } }
    return input.imageUrl && !input.imageTicket ? { ...placed, imageNotStored: true } : placed
  }

  // Saves the fields sent, as the server reads them (trimmed; a blank note
  // is none). A new image without its Image Ticket isn't stored: the Dish
  // keeps the one it had. Null for a Dish the server doesn't have.
  function editOnServer(dishId: string, changes: DishEditBody): SavedDish | null {
    const dish = located(d => d.id === dishId)?.dish
    if (!dish) return null
    const { title, note, source, placeholder, imageUrl, imageTicket } = changes
    if (title !== undefined) dish.title = title.trim()
    if (note !== undefined) dish.note = note?.trim() || null
    if (source !== undefined) dish.source = source && { link: source.link, kind: source.kind ?? 'other' }
    if (placeholder !== undefined) dish.placeholder = placeholder
    if (imageUrl === null || (imageUrl && imageTicket)) dish.imageUrl = imageUrl && `/images/${dishId}-${Date.now()}.jpg`
    const saved = structuredClone(dish)
    return imageUrl && !imageTicket ? { ...saved, imageNotStored: true } : saved
  }

  function deleteOnServer(dishId: string): boolean {
    for (const column of server.columns) {
      const index = column.dishes.findIndex(d => d.id === dishId)
      if (index === -1) continue
      const [dish] = column.dishes.splice(index, 1)
      deleted.set(dishId, { dish: dish!, columnId: column.id, index })
      return true
    }
    return false
  }

  function restoreOnServer(dishId: string): PlacedDish | null {
    const gone = deleted.get(dishId)
    if (!gone) return null
    deleted.delete(dishId)
    const column = server.columns.find(c => c.id === gone.columnId)!
    const index = Math.min(gone.index, column.dishes.length)
    column.dishes.splice(index, 0, gone.dish)
    return { ...structuredClone(gone.dish), placement: { boardId: server.id, columnId: column.id, index } }
  }

  function deleteCookingOnServer(cookingId: string): boolean {
    const found = located(dish => dish.cookings.some(c => c.id === cookingId))
    if (!found) return false
    const cooking = found.dish.cookings.find(c => c.id === cookingId)!
    found.dish.cookings = found.dish.cookings.filter(c => c !== cooking)
    deletedCookings.set(cookingId, { cooking, dishId: found.dish.id })
    return true
  }

  // Puts a deleted Cooking back into its Dish's Cooking History, newest
  // first, as the server reads it.
  function restoreCookingOnServer(cookingId: string): CookingView | null {
    const gone = deletedCookings.get(cookingId)
    const found = gone && located(dish => dish.id === gone.dishId)
    if (!gone || !found) return null
    deletedCookings.delete(cookingId)
    found.dish.cookings.push(gone.cooking)
    found.dish.cookings.sort((a, b) => b.cookedAt.localeCompare(a.cookedAt))
    return structuredClone(gone.cooking)
  }

  // Saves a Cooking's note, trimmed; a blank one is none. Null for a Cooking
  // the server doesn't have.
  function noteOnServer(cookingId: string, note: string): CookingView | null {
    const cooking = located(dish => dish.cookings.some(c => c.id === cookingId))?.dish.cookings.find(c => c.id === cookingId)
    if (!cooking) return null
    cooking.note = note.trim() || null
    return structuredClone(cooking)
  }

  // Answers a write as scripted, else runs it on the server: `run` answers
  // null for a Dish the server doesn't have (404), or throws WriteFailed.
  function answer<T>(write: Write, args: string, run: () => T | null): Promise<T> {
    sent.push(`${write} ${args}`.trimEnd())
    const settle = (resolve: (value: T) => void, reject: (error: unknown) => void, status?: number) => {
      if (status !== undefined) return reject(new WriteFailed(status))
      try {
        const result = run()
        if (result === null) reject(new WriteFailed(404))
        else resolve(result)
      }
      catch (error) {
        reject(error)
      }
    }
    const reply = replies.get(write)?.shift()
    return new Promise<T>((resolve, reject) => {
      if (!reply) settle(resolve, reject)
      else if ('fail' in reply) settle(resolve, reject, reply.fail)
      else reply.hold({ succeed: () => settle(resolve, reject) })
    })
  }

  function script(write: Write, reply: Reply) {
    replies.set(write, [...replies.get(write) ?? [], reply])
  }

  const transport: BoardTransport = {
    addDish: (boardId, input) => answer('addDish', `${boardId} ${input.title}`, () => addOnServer(boardId, input)),
    editDish: (dishId, changes) => answer('editDish', dishId, () => editOnServer(dishId, changes)),
    deleteDish: dishId => answer('deleteDish', dishId, () => deleteOnServer(dishId) || null).then(() => undefined),
    restoreDish: dishId => answer('restoreDish', dishId, () => restoreOnServer(dishId)),
    moveDish: (dishId, { columnId, index }) => answer('moveDish', `${dishId} ${columnId} ${index ?? ''}`, () => moveOnServer(dishId, columnId, index, false)),
    cookDish: dishId => answer('cookDish', dishId, () => moveOnServer(dishId, undefined, undefined, true)),
    undoCooking: (cookingId, { columnId, index }) => answer('undoCooking', `${cookingId} ${columnId} ${index}`, () => undoOnServer(cookingId, columnId, index)),
    deleteCooking: cookingId => answer('deleteCooking', cookingId, () => deleteCookingOnServer(cookingId) || null).then(() => undefined),
    restoreCooking: cookingId => answer('restoreCooking', cookingId, () => restoreCookingOnServer(cookingId)),
    noteCooking: (cookingId, note) => answer('noteCooking', cookingId, () => noteOnServer(cookingId, note)),
  }

  return {
    transport,
    server,
    sent,
    failNext: (write, status) => script(write, { fail: status }),
    holdNext(write) {
      let held: Held | undefined
      script(write, { hold: h => (held = h) })
      return { succeed: () => held!.succeed() }
    },
    deleteDishElsewhere: dishId => void deleteOnServer(dishId),
    deleteColumnElsewhere(columnId) {
      server.columns = server.columns.filter(c => c.id !== columnId)
      const target = columnForNewDishes(server.columns)!
      let top = 0
      for (const gone of deleted.values()) {
        if (gone.columnId === columnId) Object.assign(gone, { columnId: target.id, index: top++ })
      }
    },
    deleteCookingElsewhere: cookingId => void deleteCookingOnServer(cookingId),
  }
}
