import type { BoardTransport } from '../../app/board/board-module'
import { WriteFailed } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import type { DishView, MovedDish, PlacedDish } from '../../server/utils/dishes'
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
}

export function memoryTransport(board: BoardView): MemoryTransport {
  const server = structuredClone(board)
  const sent: string[] = []
  const replies = new Map<Write, Reply[]>()
  // Deleted Dishes keep their Column and index, so restoring puts them back.
  const deleted = new Map<string, { dish: DishView, columnId: string, index: number }>()
  let cookings = 0

  function located(dishId: string) {
    for (const column of server.columns) {
      const dish = column.dishes.find(d => d.id === dishId)
      if (dish) return { dish, column }
    }
    return null
  }

  function placed(dish: DishView, columnId: string): PlacedDish {
    const index = server.columns.find(c => c.id === columnId)!.dishes.indexOf(dish)
    return { ...structuredClone(dish), placement: { boardId: server.id, columnId, index } }
  }

  // Moves a Dish as the server does (shared/placement.ts), recording a
  // Cooking where the rules say so. Null for a Dish the server doesn't have.
  function moveOnServer(dishId: string, columnId: string, index: number | undefined, cook: boolean): MovedDish | null {
    const found = located(dishId)
    const target = server.columns.find(c => c.id === columnId)
    if (!found) return null
    if (!target) throw new WriteFailed(400)
    const to = landingIndex(target, dishId, index)
    found.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
    target.dishes.splice(to, 0, found.dish)
    if (!recordsCooking(found.column, target, { cook })) return placed(found.dish, columnId)
    const cooking = { id: `cooking-${++cookings}`, cookedAt: new Date().toISOString(), note: null, recordedBy: null }
    found.dish.cookings.unshift(cooking)
    return { ...placed(found.dish, columnId), cooking: structuredClone(cooking) }
  }

  // Removes a Cooking and puts its Dish at `index` in a Column, if it is
  // still in the Gekocht Column (400 otherwise, as on the server).
  function undoOnServer(cookingId: string, columnId: string, index: number): PlacedDish | null {
    const found = server.columns.flatMap(c => c.dishes.map(dish => ({ dish, column: c }))).find(({ dish }) => dish.cookings.some(c => c.id === cookingId))
    if (!found) return null
    if (!found.column.isGekocht) throw new WriteFailed(400)
    found.dish.cookings = found.dish.cookings.filter(c => c.id !== cookingId)
    moveOnServer(found.dish.id, columnId, index, false)
    return placed(found.dish, columnId)
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
    deleteDish: dishId => answer('deleteDish', dishId, () => deleteOnServer(dishId) || null).then(() => undefined),
    restoreDish: dishId => answer('restoreDish', dishId, () => restoreOnServer(dishId)),
    moveDish: (dishId, { columnId, index }) => answer('moveDish', `${dishId} ${columnId} ${index ?? ''}`, () => moveOnServer(dishId, columnId, index, false)),
    cookDish: dishId => answer('cookDish', dishId, () => moveOnServer(dishId, server.columns.find(c => c.isGekocht)!.id, undefined, true)),
    undoCooking: (cookingId, { columnId, index }) => answer('undoCooking', `${cookingId} ${columnId} ${index}`, () => undoOnServer(cookingId, columnId, index)),
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
  }
}
