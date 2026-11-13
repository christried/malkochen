import type { Ref } from 'vue'
// Relative imports, not `~~`, as in board-module.ts.
import type { BoardView } from '../../server/utils/boards'
import type { DishView } from '../../server/utils/dishes'
import type { ShoppingItemView, WeekPutOn } from '../../shared/shopping-list'
import type { Late } from './late'
import { sendOrKeep } from './send-or-keep'
import type { UnsentChange, UnsentChanges, UnsentKind } from './unsent-changes'
import { WriteFailed } from './write-failed'

// The Board module's part for the Shopping List (#534; CONTEXT.md: Shopping
// List, Shopping Item; ADR 0015): the Board's list as groups for the screen,
// and its writes as optimistic changes like the Week Plan's: each shows at
// once, goes to the server after the list's earlier writes, and is rolled
// back if the server refuses it. Without an answer it stays and waits as an
// Unsent Change (unsent-changes.ts). A change to an item that has gone
// meanwhile (deleted or cleared by someone else) just goes, with no notice:
// the line is gone anyway. Plain Vue reactivity, no Nuxt, so it runs in Node
// under test.

// What the page tells the Member when a write failed, as a key for the page
// to look up: `shoppingFailed` for any; `shoppingFull` when the list would
// hold more than 500 items; `dishGone` when the Dish put on was archived,
// moved or deleted meanwhile.
export type ShoppingNotice = 'shoppingFailed' | 'shoppingFull' | 'dishGone'

// What a write answers: how many items it put on, cleared or brought back
// (`count`), a notice if it failed, and for one that may still fail after the
// list changed, what it ended in once settled. `unsent`: it got no answer and
// waits as an Unsent Change. `undo`: "Rückgängig", after a delete, a clear or
// putting a Dish on (never on the result of an undo).
export interface ShoppingResult {
  count: number
  notice?: ShoppingNotice
  settled?: Promise<ShoppingResult>
  unsent?: true
  undo?: () => ShoppingResult | null
}

// What putting a week on answers once the server has: how many Dishes went
// on (0: everything was on already), or a notice; `unsent` when it waits as
// an Unsent Change, its count not known yet. `undo`: "Rückgängig", taking back
// just the items this put on; there when a Dish went on.
export interface WeekResult {
  dishes: number
  notice?: ShoppingNotice
  unsent?: true
  undo?: () => ShoppingResult | null
}

// A Shopping Item as the screen draws it; `unsent` while a change of it
// waits to be sent.
export interface ShoppingEntry extends ShoppingItemView {
  unsent: boolean
}

// A group of the list: "Sonstiges" (`dishId` null), or a Dish's, with the
// Dish while it is on the Board (its title and image as they are now; its
// detail opens from it), else only its title as last known. `times`: how many
// times its Dish was put on (the distinct put-ons among its items), 1 for
// "Sonstiges".
export interface ShoppingGroup {
  dishId: string | null
  title: string | null
  dish: DishView | null
  times: number
  items: ShoppingEntry[]
}

// How the Shopping List reaches the server (BoardTransport). `late.madeAt`,
// only from the Unsent Changes.
export interface ShoppingTransport {
  addShoppingItem: (boardId: string, item: { id: string, text: string }, late?: Late) => Promise<ShoppingItemView>
  changeShoppingItem: (itemId: string, change: { text: string } | { ticked: boolean }, late?: Late) => Promise<ShoppingItemView>
  deleteShoppingItem: (itemId: string, late?: Late) => Promise<void>
  clearShoppingItems: (boardId: string, late?: Late) => Promise<{ ids: string[] }>
  restoreShoppingItems: (boardId: string, ids: string[], late?: Late) => Promise<ShoppingItemView[]>
  takeBackShoppingItems: (boardId: string, ids: string[], late?: Late) => Promise<{ ids: string[] }>
  putDishOnShoppingList: (boardId: string, put: { dishId: string, items: { id: string, text: string, line: number }[] }, late?: Late) => Promise<ShoppingItemView[]>
  putWeekOnShoppingList: (boardId: string, week: string, late?: Late) => Promise<WeekPutOn>
}

// --- The list's order, shared with the Unsent Changes and the tests ----------

// Where an item belongs in the Board's list (in the server's order:
// "Sonstiges" first, then the groups in the order put on): at the end of its
// group, or as a new group after all others. Not twice.
export function placeItem(list: ShoppingItemView[], item: ShoppingItemView) {
  if (list.some(i => i.id === item.id)) return
  let at = -1
  list.forEach((i, index) => {
    if (i.dishId === item.dishId) at = index
  })
  if (at === -1 && item.dishId === null) {
    // A first item of "Sonstiges" comes before every group.
    list.unshift(item)
    return
  }
  list.splice(at === -1 ? list.length : at + 1, 0, item)
}

// Puts an item back at `index`, where it was, unless it is there.
export function putBack(list: ShoppingItemView[], item: ShoppingItemView, index: number) {
  if (list.some(i => i.id === item.id)) return
  list.splice(Math.min(index, list.length), 0, item)
}

export function takeOffList(list: ShoppingItemView[], itemId: string): boolean {
  const at = list.findIndex(i => i.id === itemId)
  if (at === -1) return false
  list.splice(at, 1)
  return true
}

// The ids of the items that changes still waiting are about.
export function waitingItemIds(changes: readonly UnsentChange[]): Set<string> {
  const ids = new Set<string>()
  for (const c of changes) {
    if ('itemId' in c) ids.add(c.itemId)
    if (c.kind === 'shopClear' || c.kind === 'shopTakeBack') c.itemIds.forEach(id => ids.add(id))
    if (c.kind === 'shopRestore') c.items.forEach(({ item }) => ids.add(item.id))
    if (c.kind === 'shopDish') c.items.forEach(item => ids.add(item.id))
  }
  return ids
}

// The list as groups, in order: "Sonstiges" first (also when empty, never
// shown empty by the page: it decides), then each Dish's group in the order
// put on; in each, open lines first, ticked ones at the bottom, each by its
// place (a Dish's line in its Recipe), a line put on twice side by side:
// A, A, B, B. `dishOf` finds a Dish on the Board.
export function groupsOf(items: ShoppingItemView[], dishOf: (dishId: string) => DishView | undefined, waiting: Set<string> = new Set()): ShoppingGroup[] {
  const groups = new Map<string | null, ShoppingGroup>()
  for (const item of items) {
    let group = groups.get(item.dishId)
    if (!group) {
      const dish = item.dishId === null ? undefined : dishOf(item.dishId)
      group = { dishId: item.dishId, title: dish?.title ?? item.dishTitle, dish: dish ?? null, times: 1, items: [] }
      groups.set(item.dishId, group)
    }
    group.items.push({ ...item, unsent: waiting.has(item.id) })
  }
  const ordered = [...groups.values()].sort((a, b) => (a.dishId === null ? 0 : 1) - (b.dishId === null ? 0 : 1))
  const byPlace = (a: ShoppingEntry, b: ShoppingEntry) => a.place - b.place || a.putOn - b.putOn
  for (const group of ordered) {
    group.times = new Set(group.items.map(i => i.putOn)).size
    group.items = [...group.items.filter(i => !i.ticked).sort(byPlace), ...group.items.filter(i => i.ticked).sort(byPlace)]
  }
  return ordered
}

// --- The module part ----------------------------------------------------------

// What the Board module lends it.
interface ShoppingHost {
  board: Ref<BoardView | undefined>
  transport: ShoppingTransport
  // The Dish on the Board, archived ones aren't.
  find: (dishId: string) => DishView | undefined
  queued: <T>(key: string, write: () => Promise<T>, options: { moves: false }) => Promise<T>
  unsent?: UnsentChanges
  queueUnsent: (kind: UnsentKind, madeAt: string, label: string) => string
  anyUnsent: () => boolean
}

const status = (error: unknown) => error instanceof WriteFailed ? error.status : undefined

export function createShoppingList({ board, transport, find, queued, unsent, queueUnsent, anyUnsent }: ShoppingHost) {
  const list = () => board.value?.shoppingItems ?? []
  const item = (itemId: string) => list().find(i => i.id === itemId)

  // The list as the screen draws it (groupsOf). Reads what the module holds,
  // so a computed or a template calling it follows every change and poll.
  function shoppingList(): ShoppingGroup[] {
    return groupsOf(list(), find, waitingItemIds(unsent?.changes.value ?? []))
  }

  // How many items are ticked: "Erledigte entfernen" is off at 0.
  const tickedCount = () => list().filter(i => i.ticked).length

  // What "Auf die Einkaufsliste" offers for a Dish: its Ingredients, all
  // chosen, in the Recipe's order. Empty for a Dish without any, or not on
  // the Board: then it isn't offered.
  function ingredientsToPutOn(dishId: string): string[] {
    return find(dishId)?.recipe?.ingredients.filter(line => line.trim() !== '') ?? []
  }

  // The notice for a write that failed with `error`.
  function noticeFor(error: unknown): ShoppingNotice {
    if (status(error) === 409) return 'shoppingFull'
    return 'shoppingFailed'
  }

  // One write of the list. It shows already; it is sent after the list's
  // earlier writes. Without an answer it stays and is kept as an Unsent
  // Change (`unsentKind`, named `label`), so is one made while Unsent
  // Changes wait. If it fails, `rollBack` puts the list back, told whether
  // the server no longer has what it was about (404), and answers the notice
  // to tell the Member, if any.
  function shoppingWrite<T>({ unsentKind, label, count, send, done, rollBack }: {
    unsentKind: UnsentKind
    label: string
    count: number
    send: () => Promise<T>
    done?: (answer: T) => void
    rollBack: (gone: boolean, error: unknown) => ShoppingNotice | null
  }): ShoppingResult {
    const madeAt = new Date().toISOString()
    const settled = queued(`shop:${board.value!.id}`, async (): Promise<ShoppingResult> => {
      try {
        return await sendOrKeep<ShoppingResult, ShoppingResult>({
          canKeep: !!unsent,
          waiting: anyUnsent(),
          keep: () => {
            queueUnsent(unsentKind, madeAt, label)
            return { count, unsent: true }
          },
          send: async () => {
            // Not `done?.(await send())`: without `done` that would never send.
            const answer = await send()
            done?.(answer)
            return { count }
          },
        })
      }
      catch (error) {
        const notice = rollBack(status(error) === 404, error)
        return { count: 0, ...notice && { notice } }
      }
    }, { moves: false })
    return { count, settled }
  }

  // Types an item into "Sonstiges", at its end. Null for an empty text, or
  // without a Board.
  function addShoppingItem(text: string): ShoppingResult | null {
    const line = text.trim()
    if (!board.value || !line) return null
    const id = crypto.randomUUID()
    // Typing order: after the last place used in "Sonstiges".
    const place = Math.max(-1, ...list().filter(i => i.dishId === null).map(i => i.place)) + 1
    placeItem(board.value.shoppingItems, { id, text: line, ticked: false, dishId: null, dishTitle: null, dishOnBoard: false, place, putOn: 1 })
    return shoppingWrite({
      unsentKind: { kind: 'shopAdd', itemId: id, text: line },
      label: line,
      count: 1,
      send: () => transport.addShoppingItem(board.value!.id, { id, text: line }),
      rollBack: (_, error) => {
        takeOffList(list(), id)
        return noticeFor(error)
      },
    })
  }

  // Changes an item's text. Null if it isn't on the list, for an empty text,
  // or the text it has. Back to the text it had, with a notice, if the
  // server refuses it; one gone meanwhile just goes.
  function changeShoppingItem(itemId: string, text: string): ShoppingResult | null {
    const found = item(itemId)
    const line = text.trim()
    if (!found || !line || found.text === line) return null
    const was = found.text
    found.text = line
    return shoppingWrite({
      unsentKind: { kind: 'shopText', itemId, text: line },
      label: line,
      count: 1,
      send: () => transport.changeShoppingItem(itemId, { text: line }),
      rollBack: (gone) => {
        if (gone) {
          takeOffList(list(), itemId)
          return null
        }
        const now = item(itemId)
        if (now) now.text = was
        return 'shoppingFailed'
      },
    })
  }

  // Ticks an item off, or unticks it. Null if it isn't on the list, or is
  // ticked (or not) already.
  function tickShoppingItem(itemId: string, ticked: boolean): ShoppingResult | null {
    const found = item(itemId)
    if (!found || found.ticked === ticked) return null
    found.ticked = ticked
    return shoppingWrite({
      unsentKind: { kind: 'shopTick', itemId, ticked },
      label: found.text,
      count: 1,
      send: () => transport.changeShoppingItem(itemId, { ticked }),
      rollBack: (gone) => {
        if (gone) {
          takeOffList(list(), itemId)
          return null
        }
        const now = item(itemId)
        if (now) now.ticked = !ticked
        return 'shoppingFailed'
      },
    })
  }

  // Brings deleted items back where they were (`back`: each with its index
  // in the list), as "Rückgängig" does.
  function restore(back: { item: ShoppingItemView, index: number }[]): ShoppingResult | null {
    if (!board.value || back.length === 0) return null
    for (const { item, index } of [...back].sort((a, b) => a.index - b.index)) putBack(board.value.shoppingItems, item, index)
    return shoppingWrite({
      unsentKind: { kind: 'shopRestore', items: back },
      label: back[0]!.item.text,
      count: back.length,
      send: () => transport.restoreShoppingItems(board.value!.id, back.map(b => b.item.id)),
      // Those the server brought back that weren't shown (another Member
      // cleared them meanwhile with this one's) come back too.
      done: restored => restored.forEach(i => placeItem(list(), i)),
      rollBack: (gone, error) => {
        back.forEach(b => takeOffList(list(), b.item.id))
        return gone ? null : noticeFor(error)
      },
    })
  }

  // Deletes an item from the list. Null if it isn't on it. Back in its place,
  // with a notice, if the server refuses it; one gone meanwhile counts as
  // deleted. `undo` brings it back as it was.
  function deleteShoppingItem(itemId: string): ShoppingResult | null {
    const found = item(itemId)
    if (!found || !board.value) return null
    const back = [{ item: { ...found }, index: list().indexOf(found) }]
    takeOffList(board.value.shoppingItems, itemId)
    const result = shoppingWrite({
      unsentKind: { kind: 'shopDelete', itemId },
      label: found.text,
      count: 1,
      send: () => transport.deleteShoppingItem(itemId),
      rollBack: (gone) => {
        if (gone) return null
        putBack(list(), back[0]!.item, back[0]!.index)
        return 'shoppingFailed'
      },
    })
    return { ...result, undo: () => restore(back) }
  }

  // "Erledigte entfernen": clears every ticked item, for everyone. Null when
  // nothing is ticked. Back, with a notice, if the server refuses it. `undo`
  // brings them back as they were, and those the server cleared too (ticked
  // by another Member meanwhile) with them.
  function clearTicked(): ShoppingResult | null {
    if (!board.value) return null
    const back = list().flatMap((i, index) => i.ticked ? [{ item: { ...i }, index }] : [])
    if (back.length === 0) return null
    for (const { item } of back) takeOffList(board.value.shoppingItems, item.id)
    let cleared: string[] = []
    const result = shoppingWrite({
      unsentKind: { kind: 'shopClear', itemIds: back.map(b => b.item.id) },
      label: back[0]!.item.text,
      count: back.length,
      send: () => transport.clearShoppingItems(board.value!.id),
      done: ({ ids }) => {
        cleared = ids
      },
      rollBack: () => {
        for (const { item, index } of back) putBack(list(), item, index)
        return 'shoppingFailed'
      },
    })
    const undo = () => {
      const result = restore(back)
      // The others the server cleared come back with the restore's answer.
      const extra = cleared.filter(id => !back.some(b => b.item.id === id))
      if (result && extra.length > 0) void queued(`shop:${board.value!.id}`, async () => {
        try {
          (await transport.restoreShoppingItems(board.value!.id, extra)).forEach(i => placeItem(list(), i))
        }
        catch {
          // Offline or refused: those stay cleared.
        }
      }, { moves: false })
      return result
    }
    return { ...result, undo }
  }

  // "Rückgängig" after putting a Dish or a week on: takes the items `ids` off
  // the list at once, for everyone. Null if none is on the list. Back where
  // they were, with a notice, if the server refuses it. It queues behind the
  // put-on it undoes, so an unsent put-on and its take-back go out in order.
  // There is no undo of an undo.
  function takeBack(ids: string[]): ShoppingResult | null {
    if (!board.value) return null
    const back = list().flatMap((i, index) => ids.includes(i.id) ? [{ item: { ...i }, index }] : [])
    if (back.length === 0) return null
    for (const { item } of back) takeOffList(board.value.shoppingItems, item.id)
    return shoppingWrite({
      unsentKind: { kind: 'shopTakeBack', itemIds: back.map(b => b.item.id) },
      label: back[0]!.item.text,
      count: back.length,
      send: () => transport.takeBackShoppingItems(board.value!.id, back.map(b => b.item.id)),
      rollBack: (gone) => {
        if (gone) return null
        for (const { item, index } of [...back].sort((a, b) => a.index - b.index)) putBack(list(), item, index)
        return 'shoppingFailed'
      },
    })
  }

  // "Auf die Einkaufsliste": puts the Dish on with the lines chosen from its
  // Ingredients (`line`: the index in `ingredientsToPutOn`), as its next
  // put-on: each line at its place in the Recipe, next to the same line of
  // the earlier put-ons (a new group after the others if it has none). Null
  // if the Dish isn't on the Board, has no Ingredients, or no line is chosen.
  // Rolled back with a notice if the server refuses it: the Dish archived or
  // moved meanwhile, or the list full. `undo` takes just these items back.
  function putDishOn(dishId: string, lines: { line: number, text: string }[]): ShoppingResult | null {
    const dish = find(dishId)
    const chosen = lines.map(l => ({ line: l.line, text: l.text.trim() })).filter(l => l.text !== '')
    if (!dish || !board.value || chosen.length === 0 || ingredientsToPutOn(dishId).length === 0) return null
    const items = chosen.map(({ line, text }) => ({ id: crypto.randomUUID(), text, line }))
    const putOn = Math.max(0, ...list().filter(i => i.dishId === dishId).map(i => i.putOn)) + 1
    for (const { id, text, line } of items) placeItem(board.value.shoppingItems, { id, text, ticked: false, dishId, dishTitle: dish.title, dishOnBoard: true, place: line, putOn })
    const result = shoppingWrite({
      unsentKind: { kind: 'shopDish', dishId, title: dish.title, items },
      label: dish.title,
      count: items.length,
      send: () => transport.putDishOnShoppingList(board.value!.id, { dishId, items }),
      rollBack: (gone, error) => {
        items.forEach(i => takeOffList(list(), i.id))
        return gone ? 'dishGone' : noticeFor(error)
      },
    })
    return { ...result, undo: () => takeBack(items.map(i => i.id)) }
  }

  // "Woche auf die Einkaufsliste": puts every Dish planned from today (or
  // the week's Monday, 'YYYY-MM-DD', if later) to its Sunday on the list, as
  // the server collects them (a Dish planned twice goes on twice). Nothing
  // shows before the server answers; then its items do, and the answer says
  // how many Dishes went on, with an `undo` taking those items back. Without
  // an answer it waits as an Unsent Change, and the server collects its
  // Dishes when it arrives.
  async function putWeekOn(week: string): Promise<WeekResult | null> {
    if (!board.value) return null
    const boardId = board.value.id
    const madeAt = new Date().toISOString()
    return queued(`shop:${boardId}`, async (): Promise<WeekResult> => {
      try {
        return await sendOrKeep<WeekResult, WeekResult>({
          canKeep: !!unsent,
          waiting: anyUnsent(),
          keep: () => {
            queueUnsent({ kind: 'shopWeek', week }, madeAt, week)
            return { dishes: 0, unsent: true }
          },
          send: async () => {
            const put = await transport.putWeekOnShoppingList(boardId, week)
            if (board.value?.id === boardId) put.items.forEach(i => placeItem(list(), i))
            const ids = put.items.map(i => i.id)
            return put.dishes > 0 ? { dishes: put.dishes, undo: () => takeBack(ids) } : { dishes: 0 }
          },
        })
      }
      catch (error) {
        return { dishes: 0, notice: noticeFor(error) }
      }
    }, { moves: false })
  }

  return { shoppingList, tickedCount, ingredientsToPutOn, addShoppingItem, changeShoppingItem, tickShoppingItem, deleteShoppingItem, clearTicked, putDishOn, putWeekOn }
}
