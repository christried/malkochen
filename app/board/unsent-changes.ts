import { computed, ref, shallowRef, toRaw } from 'vue'
// Relative imports, not `~~`: runs in plain Node under test, like the Board
// module.
import type { BoardView } from '../../server/utils/boards'
import type { AddedDish, CookingUndo, DishAdder, DishView } from '../../server/utils/dishes'
import { dishOnBoard } from '../../shared/board'
import { guessKind, siteOf } from '../utils/link-guess'
import { columnForNewDishes, landingIndex } from '../../shared/placement'
import type { Placeholder } from '../../shared/placeholders'
import type { BoardTransport } from './board-module'
import type { DeviceStore } from './device-store'
import { deviceOwner } from './device-owner'
import { plainCopy } from './plain-copy'
import { isUnanswered, WriteFailed } from './write-failed'

// Unsent Changes (CONTEXT.md; ADR 0012; spec #456): what the user did while
// malkochen didn't answer. Each shows on screen at once, is kept on the
// device in the order it was made, and goes out once malkochen answers, as
// the same request it would have been online, with its device-made ids and
// the time it was tapped. One list per signed-in user for the whole app,
// shared by every Board's module: a change made on one Board is sent while
// another is open. Plain Vue reactivity, no Nuxt and no DOM, so it runs in
// Node under test.

// Plain serialisable data, nothing that points at a live object: all it
// takes to send it, and to show it again on a Board that loads without it.
export type UnsentChange = {
  // The change's own id (not a Dish's or Cooking's).
  id: string
  boardId: string
  // When it was tapped, as ISO; it dates the Cooking it records.
  madeAt: string
  // The Dish title(s) it names in the "didn't arrive" toast.
  label: string
} & UnsentKind

export type UnsentKind =
  // A Dish moved or dragged within its Board; `cookingId` when it went into
  // the Gekocht Column and recorded a Cooking.
  | { kind: 'move', dishId: string, columnId: string, index?: number, cookingId?: string }
  // "Gekocht ✓" on one Dish.
  | { kind: 'cook', dishId: string, cookingId: string }
  // "Gekocht ✓" on several: one Cooking id per Dish, in the same order.
  | { kind: 'cookMany', dishIds: string[], cookingIds: string[] }
  // "Rückgängig" on a Cooking that had been recorded: the Cooking goes and
  // the Dish goes back to `back`.
  | { kind: 'uncook', dishId: string, cookingId: string, back: { columnId: string, index: number } }
  | { kind: 'uncookMany', dishIds: string[], cookings: CookingUndo[] }
  // A Comment written, with the id the device made for it, and who wrote it
  // (to show it before the server has it).
  | { kind: 'comment', dishId: string, commentId: string, text: string, author: DishAdder }
  // One of the Member's own Comments edited, or any deleted (the Owner's).
  | { kind: 'commentEdit', dishId: string, commentId: string, text: string }
  | { kind: 'commentDelete', dishId: string, commentId: string }
  // The Member's Vote given or changed (`up`), or taken back (null), and who
  // voted (to show it before the server has it).
  | { kind: 'vote', dishId: string, up: boolean | null, voter: DishAdder }
  // A Dish's title edited: the only field an edit can change offline.
  | { kind: 'title', dishId: string, title: string }
  // A Dish added (#462): with the id the device made for it, the link as
  // pasted and the title typed, either of them none (not both), the
  // Placeholder Image chosen (`noImage`: over the Source's image, which the
  // form had looked up before the save got no answer), and who added it (to show it before the server
  // has it). The server looks the link up when it arrives.
  | { kind: 'add', dishId: string, link: string | null, title: string | null, placeholder: Placeholder, adder: DishAdder, noImage?: true }

// The writes the Unsent Changes are sent with.
export type UnsentTransport = Pick<BoardTransport, 'addDishLate' | 'moveDish' | 'cookDish' | 'cookDishes' | 'undoCooking' | 'uncookDishes' | 'writeComment' | 'editComment' | 'deleteComment' | 'setVote' | 'takeBackVote' | 'editDish'>

// A Dish added offline, as the server answered once it had it: the Board
// module puts it in place of the unsent one (takeArrivals).
export interface Arrival {
  boardId: string
  dish: AddedDish
}

// Which Dish with the same Source was on the Board already when a Dish added
// offline arrived (the Member couldn't be asked before saving it).
export interface Duplicate {
  boardId: string
  title: string
  columnName: string
}

// How a run of `send` ended: how many went out, and those dropped because
// malkochen answered that it can't apply them; `emptied` when nothing is
// left. `at` counts the runs, for a page that watches for the next.
export interface SendRun {
  at: number
  sent: number
  dropped: UnsentChange[]
  emptied: boolean
}

// What `send` answers: the run, or why it stopped with changes left: no
// answer from malkochen, or the sign-in expired (401; they wait for the same
// user to sign in again).
export type SendOutcome = SendRun | 'unanswered' | 'signedOut'

export interface UnsentDeps {
  store: DeviceStore
  transport: UnsentTransport
  userId: string
}

export function createUnsentChanges({ store, transport, userId }: UnsentDeps) {
  const changes = ref<UnsentChange[]>([])
  const count = computed(() => changes.value.length)

  // Saves go one after the other, each writing the list as it is by then,
  // and none before what the device had has been loaded.
  const loaded = store.unsent.load(userId).catch((): UnsentChange[] => []).then((kept) => {
    // Anything added meanwhile comes after what was kept.
    if (kept.length) changes.value = [...kept, ...changes.value]
  })
  let saving: Promise<void> = Promise.resolve()
  // Closed (signed out, account deleted): nothing is written or sent any more.
  let closed = false
  // Whether the device still belongs to this user: another tab may have
  // signed out or in as someone else since. If not, this tab closes.
  const owner = deviceOwner(store, userId)
  async function stillMine(): Promise<boolean> {
    if (closed) return false
    if (!await owner.mine()) closed = true
    return !closed
  }
  function persist() {
    saving = saving.then(() => loaded).then(async () => {
      if (await stillMine()) await store.unsent.save(userId, plainCopy(changes.value))
    }).catch(() => {})
  }

  const has = (changeId: string) => changes.value.some(c => c.id === changeId)

  function add(change: UnsentChange) {
    changes.value.push(change)
    persist()
  }

  function remove(changeId: string): boolean {
    const at = changes.value.findIndex(c => c.id === changeId)
    if (at === -1) return false
    changes.value.splice(at, 1)
    persist()
    return true
  }

  // The one being sent now: asking to take a change back waits for it.
  let inFlight: { id: string, done: Promise<void> } | null = null

  // A new Vote on a Dish replaces the Member's earlier ones still waiting:
  // only the last counts, so only it is sent (the one being sent now goes
  // out anyway).
  function replaceVotes(dishId: string) {
    for (const c of [...changes.value]) {
      if (c.kind === 'vote' && c.dishId === dishId && c.id !== inFlight?.id) remove(c.id)
    }
  }

  // Takes a change back (the user undid it) so it is never sent. Waits for
  // it first if it is on its way: answers whether it was still unsent, and
  // so taken out; false if it had gone out by then.
  async function cancel(changeId: string): Promise<boolean> {
    if (inFlight?.id === changeId) await inFlight.done
    return remove(changeId)
  }

  // Sends count for a Board's sync: it must not merge what the server said
  // before a send, or while one is under way.
  let underWay = 0
  let started = 0
  const mark = (): number | null => underWay > 0 ? null : started
  const sentSince = (at: number | null) => at === null || started !== at

  const lastRun = shallowRef<SendRun | null>(null)
  let runs = 0
  // Changes dropped and not yet told to the user.
  let untold: UnsentChange[] = []
  function takeDropped(): UnsentChange[] {
    const dropped = untold
    untold = []
    return dropped
  }

  // Whether malkochen gave no answer to the error's write: nothing to say
  // about the change yet, so it stays and the rest wait. A 5xx counts too,
  // as the server failing is not it saying it can't apply the change.
  const unanswered = (error: unknown) => isUnanswered(error) || (error instanceof WriteFailed && error.status! >= 500)
  // A 401: the sign-in expired. The change is not refused, it waits for the
  // same user to sign in again (#463).
  const signedOut = (error: unknown) => error instanceof WriteFailed && error.status === 401

  // Dishes added offline that have arrived, and which Dish had their Source
  // already, not yet taken by the page (takeArrivals, takeDuplicates).
  let arrivals: Arrival[] = []
  let duplicates: Duplicate[] = []
  function takeArrivals(boardId: string): Arrival[] {
    const mine = arrivals.filter(a => a.boardId === boardId)
    arrivals = arrivals.filter(a => a.boardId !== boardId)
    return mine
  }
  function takeDuplicates(): Duplicate[] {
    const told = duplicates
    duplicates = []
    return told
  }
  function arrived(change: UnsentChange, answer: unknown) {
    if (change.kind !== 'add') return
    const dish = answer as AddedDish
    arrivals.push({ boardId: change.boardId, dish })
    if (dish.duplicateOf) duplicates.push({ boardId: change.boardId, title: dish.duplicateOf.title, columnName: dish.duplicateOf.columnName })
  }

  // A Dish added offline was dropped on arrival: what was done to it since,
  // sent after it, can't be applied either. Those go with it, unnamed, so
  // the Member is told once about the Dish and not once per change; a bulk
  // Cooking keeps the other Dishes it was about.
  function dropDependants(dishId: string) {
    for (const c of [...changes.value]) {
      if ('dishId' in c && c.dishId === dishId && c.kind !== 'add') remove(c.id)
      else if (c.kind === 'cookMany' && c.dishIds.includes(dishId)) {
        const keep = remaining(c.dishIds, dishId)
        if (keep.length === 0) remove(c.id)
        else {
          c.dishIds = keep.map(i => c.dishIds[i]!)
          c.cookingIds = keep.map(i => c.cookingIds[i]!)
          persist()
        }
      }
      else if (c.kind === 'uncookMany' && c.dishIds.includes(dishId)) {
        const keep = remaining(c.dishIds, dishId)
        if (keep.length === 0) remove(c.id)
        else {
          c.cookings = keep.map(i => c.cookings[i]!)
          c.dishIds = keep.map(i => c.dishIds[i]!)
          persist()
        }
      }
    }
  }

  function deliver(change: UnsentChange): Promise<unknown> {
    const { madeAt } = change
    switch (change.kind) {
      case 'add':
        return transport.addDishLate(change.boardId, { offline: true, id: change.dishId, placeholder: change.placeholder, ...change.noImage && { noImage: true }, ...change.title && { title: change.title }, ...change.link && { source: { link: change.link } } })
      case 'move':
        return transport.moveDish(change.dishId, { columnId: change.columnId, ...change.index !== undefined && { index: change.index } }, { ...change.cookingId && { cookingId: change.cookingId }, madeAt })
      case 'cook':
        return transport.cookDish(change.dishId, { cookingId: change.cookingId, madeAt })
      case 'cookMany':
        return transport.cookDishes(change.dishIds, { cookingIds: change.cookingIds, madeAt })
      case 'uncook':
        return transport.undoCooking(change.cookingId, change.back)
      case 'uncookMany':
        return transport.uncookDishes(change.cookings)
      case 'comment':
        return transport.writeComment(change.dishId, change.text, { id: change.commentId, madeAt })
      case 'commentEdit':
        return transport.editComment(change.commentId, change.text)
      case 'commentDelete':
        return transport.deleteComment(change.commentId)
      case 'vote':
        return change.up === null ? transport.takeBackVote(change.dishId) : transport.setVote(change.dishId, change.up, { madeAt })
      case 'title':
        return transport.editDish(change.dishId, { title: change.title })
    }
  }

  let running: Promise<SendOutcome> | null = null

  // Sends them in order, each as the request it would have been online. One
  // run at a time: a call while one runs joins it, and a change added
  // meanwhile goes out in the same run. Each is taken off the list (and the
  // device) as soon as it is answered. No answer stops the run and keeps the
  // rest. A refusal or "can't apply" (a 4xx) drops that change, remembers it
  // for the user, and goes on.
  function send(): Promise<SendOutcome> {
    running ??= run()
    return running
  }

  async function run(): Promise<SendOutcome> {
    // Always an await before anything else, so `running` is set first.
    await loaded
    let sent = 0
    let stopped: false | 'unanswered' | 'signedOut' = false
    const dropped: UnsentChange[] = []
    while (!stopped && changes.value.length > 0) {
      // Not as someone else's: nothing goes out once the device is not this
      // user's any more. (The list may have changed while that was read.)
      if (!await stillMine()) break
      const change = changes.value[0]
      if (!change) break
      underWay++
      started++
      // A transport that throws rather than rejecting fails like one that rejects.
      const step = new Promise(resolve => resolve(deliver(change)))
      inFlight = { id: change.id, done: step.then(() => {}, () => {}) }
      try {
        arrived(change, await step)
        sent++
      }
      catch (error) {
        if (signedOut(error)) stopped = 'signedOut'
        else if (unanswered(error)) stopped = 'unanswered'
        else {
          dropped.push(change)
          if (change.kind === 'add') dropDependants(change.dishId)
        }
      }
      underWay--
      inFlight = null
      if (!stopped) remove(change.id)
    }
    // In the same breath as the loop's last check of the list, so a change
    // added after it starts a run of its own.
    running = null
    const ended: SendRun = { at: ++runs, sent, dropped, emptied: changes.value.length === 0 }
    if (sent + dropped.length > 0) {
      untold.push(...dropped)
      lastRun.value = ended
    }
    return stopped || ended
  }

  return {
    changes: computed(() => changes.value as readonly UnsentChange[]),
    count,
    // Loaded from the device.
    ready: loaded,
    // The user signed out or deleted the account: what was still to be sent
    // is not, and none of it is written to the device again (#463).
    close() {
      closed = true
    },
    // Resolves once everything added or removed so far is written.
    saved: () => saving,
    add,
    remove,
    replaceVotes,
    cancel,
    has,
    send,
    mark,
    sentSince,
    lastRun,
    takeDropped,
    takeArrivals,
    takeDuplicates,
    forBoard: (boardId: string) => changes.value.filter(c => c.boardId === boardId),
    // Whether a Cooking with this id is still waiting to be sent.
    hasCooking: (cookingId: string) => changes.value.some(c =>
      ('cookingId' in c && c.cookingId === cookingId && c.kind !== 'uncook')
      || (c.kind === 'cookMany' && c.cookingIds.includes(cookingId))),
  }
}

// The positions in `dishIds` of the Dishes other than `dishId`.
const remaining = (dishIds: string[], dishId: string) => dishIds.flatMap((id, i) => id === dishId ? [] : [i])

export type UnsentChanges = ReturnType<typeof createUnsentChanges>

// Puts the Cooking on the Dish, newest first, unless it is there already (it
// may have arrived, its answer lost).
function addCooking(dish: DishView, id: string, cookedAt: string) {
  if (!dish.cookings.some(c => c.id === id)) dish.cookings.unshift({ id, cookedAt, recordedBy: null })
}

function removeCooking(dish: DishView, id: string) {
  const at = dish.cookings.findIndex(c => c.id === id)
  if (at !== -1) dish.cookings.splice(at, 1)
}

// Puts a Dish at `index` among a Column's other Dishes.
function place(dish: DishView, column: BoardView['columns'][number], index: number) {
  column.dishes.splice(Math.min(index, column.dishes.length), 0, dish)
}

// Applies the Unsent Changes of `view`'s Board to it, in order, in place, and
// answers it: what the server says, with what the user did since laid over
// it, so nothing flickers back. Applying a change twice changes nothing more
// (a Board that already shows it). A Dish that isn't on the Board (archived
// or deleted meanwhile) or a Column that isn't is skipped silently: sending
// the change will drop it and name it.
export function layOver(view: BoardView, changes: readonly UnsentChange[]): BoardView {
  const counted = countedOn(toRaw(view))
  for (const change of changes) {
    if (change.boardId !== view.id) continue
    // A Comment count only moves by one: once per change on a given Board.
    if (change.kind === 'comment' || change.kind === 'commentDelete') {
      if (counted.has(change.id)) continue
      counted.add(change.id)
    }
    apply(view, change)
  }
  return view
}

// Which Comment changes a Board object has been laid over with already.
const countedChanges = new WeakMap<object, Set<string>>()
function countedOn(view: object): Set<string> {
  let counted = countedChanges.get(view)
  if (!counted) countedChanges.set(view, counted = new Set())
  return counted
}

// The Dish a Dish added offline shows as until the server has it: the title
// typed, else the link's site; the Source as the link's address says; the
// short code its Address would have from its id, so its page opens (the
// server's own code replaces it on arrival).
export function dishOfAdd(change: Extract<UnsentChange, { kind: 'add' }>): DishView {
  return {
    id: change.dishId,
    code: change.dishId.slice(-12),
    title: change.title ?? siteOf(change.link ?? ''),
    source: change.link ? { link: change.link, kind: guessKind(change.link) } : null,
    creator: null,
    caption: null,
    playableVideo: null,
    recipe: null,
    recipeSearch: null,
    imageUrl: null,
    imageFocus: { x: 50, y: 50 },
    placeholder: change.placeholder,
    addedBy: change.adder,
    createdAt: change.madeAt,
    cookings: [],
    votes: [],
    commentCount: 0,
  }
}

function apply(view: BoardView, change: UnsentChange) {
  switch (change.kind) {
    case 'add': {
      // At the top of the Column that takes new Dishes, unless it is on the
      // Board already (the server has it, or it was laid over before).
      if (dishOnBoard(view, change.dishId)) return
      const into = columnForNewDishes(view.columns)
      if (into) into.dishes.unshift(dishOfAdd(change))
      return
    }
    case 'move': {
      const found = dishOnBoard(view, change.dishId)
      const target = view.columns.find(c => c.id === change.columnId)
      if (!found || !target) return
      const landing = landingIndex(target, found.dish.id, change.index)
      found.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
      place(found.dish, target, landing)
      if (change.cookingId) addCooking(found.dish, change.cookingId, change.madeAt)
      return
    }
    case 'cook': {
      const found = dishOnBoard(view, change.dishId)
      const gekocht = view.columns.find(c => c.isGekocht)
      if (!found || !gekocht) return
      if (found.column !== gekocht) {
        found.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
        place(found.dish, gekocht, 0)
      }
      addCooking(found.dish, change.cookingId, change.madeAt)
      return
    }
    case 'cookMany': {
      const gekocht = view.columns.find(c => c.isGekocht)
      if (!gekocht) return
      const found = change.dishIds.map(id => dishOnBoard(view, id))
      // Those not in the Gekocht Column go to its top, in the order sent.
      const movers = found.filter(f => f && f.column !== gekocht)
      for (const f of movers) f!.column.dishes.splice(f!.column.dishes.indexOf(f!.dish), 1)
      movers.forEach((f, i) => place(f!.dish, gekocht, i))
      found.forEach((f, i) => f && addCooking(f.dish, change.cookingIds[i]!, change.madeAt))
      return
    }
    case 'uncook': {
      uncook(view, change.dishId, change.cookingId, change.back)
      return
    }
    case 'uncookMany': {
      change.cookings.forEach((undo, i) => uncook(view, change.dishIds[i]!, undo.cookingId, undo.back))
      return
    }
    case 'title': {
      const found = dishOnBoard(view, change.dishId)
      if (found) found.dish.title = change.title
      return
    }
    case 'vote': {
      const found = dishOnBoard(view, change.dishId)
      if (!found) return
      const others = found.dish.votes.filter(v => v.voter?.id !== change.voter.id)
      found.dish.votes = change.up === null ? others : [...others, { voter: change.voter, up: change.up, votedAt: change.madeAt }]
      return
    }
    // The card's Comment count follows the Comments written and deleted. The
    // Comments themselves are the Dish History's (dish-histories.ts).
    case 'comment':
    case 'commentDelete': {
      const found = dishOnBoard(view, change.dishId)
      if (found) found.dish.commentCount = Math.max(0, found.dish.commentCount + (change.kind === 'comment' ? 1 : -1))
    }
  }
}

// Takes the Cooking off its Dish and, with `back`, puts the Dish there.
function uncook(view: BoardView, dishId: string, cookingId: string, back?: { columnId: string, index: number }) {
  const found = dishOnBoard(view, dishId)
  if (!found) return
  removeCooking(found.dish, cookingId)
  const target = back && view.columns.find(c => c.id === back.columnId)
  if (!target) return
  found.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
  place(found.dish, target, back.index)
}
