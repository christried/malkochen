import { reactive } from 'vue'
// Relative imports, not `~~`, as in board-module.ts.
import type { CommentView } from '../../server/utils/comments'
import type { DishHistory, DishHistoryEntry } from '../../server/utils/dish-history'
import type { DishAdder, DishView } from '../../server/utils/dishes'
import { commentText } from '../utils/comment-text'
import { historyEntries } from '../utils/history-entries'
import { isUnanswered } from './write-failed'
import type { UnsentChange, UnsentChanges, UnsentKind } from './unsent-changes'

// The Board module's part for the Dish History ("Verlauf", #332) of the
// Dishes whose detail opens: loaded from the server as the detail opens,
// which clears the card's mark for what's new in it (#335), and its
// Comments written, edited and deleted as optimistic writes, like the
// Board's own (board-module.ts), which the card's Comment count follows. A
// write that gets no answer stays on screen as an Unsent Change
// (unsent-changes.ts), and is laid over every load of the history.
// Its Cookings are the Board's: the module changes those as Dishes are
// cooked and Cookings deleted, so the history shows them from there, never
// a copy that could lag behind.

// What the page tells the Member about a Comment, as a key in its UI
// strings. `commentDeleted` comes with an undo; the others say a write
// failed (`commentFailed`: writing it, whose text the page gives back to
// the field; `commentNotAllowed`: writing or editing it, refused as the
// user's Permissions no longer allow it).
export type CommentNotice = 'commentDeleted' | 'commentFailed' | 'commentEditFailed' | 'commentDeleteFailed' | 'commentRestoreFailed' | 'commentNotAllowed'

export interface CommentResult {
  comment: CommentView
  notice?: CommentNotice
  undo?: () => Promise<CommentResult>
  settled?: Promise<CommentResult>
  // The write got no answer, so the change stays on screen as an Unsent
  // Change instead of failing; set on what it settled in.
  unsent?: true
}

// How the Dish History reaches the server (BoardTransport).
export interface HistoryTransport {
  // Records that the Member opened the Dish, answering its history.
  openDish: (dishId: string) => Promise<DishHistory>
  // `late`: the id the device made for the Comment and when it was written,
  // which the server keeps (a write sent again records it once).
  writeComment: (dishId: string, text: string, late?: { id?: string, madeAt?: string }) => Promise<CommentView>
  editComment: (commentId: string, text: string) => Promise<CommentView>
  deleteComment: (commentId: string) => Promise<void>
  restoreComment: (commentId: string) => Promise<CommentView>
}

// What the Board module lends it.
interface HistoryHost {
  transport: HistoryTransport
  // The Dish as the Board shows it, if it is on the Board.
  find: (dishId: string) => DishView | undefined
  // Takes the card's mark for what's new in the Dish's history off.
  clearNewInHistory: (dishId: string) => void
  // Runs `write` after the writes queued before it under the same key
  // (board-module.ts).
  queued: <T>(key: string, write: () => Promise<T>, options: { moves: false }) => Promise<T>
  // Whether a failed write failed because the server no longer has it (404),
  // or refused it for the user's Permissions (403).
  isGone: (error: unknown) => boolean
  isRefused: (error: unknown) => boolean
  // Whether the user may comment on the Board ("comment and vote").
  mayComment: () => boolean
  // The Unsent Changes (none: a write without an answer fails as ever).
  // `keep` keeps a change as one and tries to send them all; `anyUnsent`:
  // changes wait, so new ones join their end without trying the network.
  unsent?: UnsentChanges
  keep: (kind: UnsentKind, madeAt: string, label: string) => string
  anyUnsent: () => boolean
}

export function createDishHistories({ transport, find, clearNewInHistory, queued, isGone, isRefused, mayComment, unsent, keep, anyUnsent }: HistoryHost) {
  // Each Dish's Comments, oldest first, once its history has loaded or a
  // Comment was written on it; a Comment still being written has no id yet.
  const comments = reactive(new Map<string, CommentView[]>())
  // Each Dish's Comment writes, counted as they start, for a load to tell
  // whether one started since it asked.
  const writes = new Map<string, number>()
  const underWay = new Map<string, number>()

  function tracked<T>(dishId: string, write: () => Promise<T>): Promise<T> {
    writes.set(dishId, (writes.get(dishId) ?? 0) + 1)
    underWay.set(dishId, (underWay.get(dishId) ?? 0) + 1)
    return write().finally(() => underWay.set(dishId, underWay.get(dishId)! - 1))
  }

  // The Dishes whose history has loaded once, and the Comments deleted here
  // (until restored), which an answer read before the delete still has.
  const loadedOnce = reactive(new Set<string>())
  const deletedHere = new Set<string>()

  // The Dish's Comments, as the reactive copy, so changes to it show.
  function listOf(dishId: string): CommentView[] {
    if (!comments.has(dishId)) comments.set(dishId, [])
    return comments.get(dishId)!
  }

  // Counts `by` more (or fewer) Comments on the Dish's card.
  function count(dishId: string, by: number) {
    const dish = find(dishId)
    if (dish) dish.commentCount = Math.max(0, dish.commentCount + by)
  }

  // Opening a Dish's detail: its card's mark for what's new goes at once,
  // and its history loads from the server, which records the opening. If a
  // Comment write of the Dish was under way or started meanwhile, the
  // server may have answered without it, so the answer is dropped, unless
  // it is the first to load: then the Comments shown that it doesn't have
  // (the Member's own, written meanwhile) stay beside it. False if it
  // couldn't load.
  async function openDish(dishId: string): Promise<boolean> {
    clearNewInHistory(dishId)
    const asked = writes.get(dishId) ?? 0
    const quiet = !underWay.get(dishId)
    let history: DishHistory
    try {
      history = await transport.openDish(dishId)
    }
    catch {
      return false
    }
    const first = !loadedOnce.has(dishId)
    loadedOnce.add(dishId)
    if (!first && !(quiet && (writes.get(dishId) ?? 0) === asked)) return true
    const loaded = history.entries.flatMap(e => e.kind === 'comment' && !deletedHere.has(e.comment.id) ? [e.comment] : [])
    const shown = listOf(dishId)
    const kept = first ? shown.filter(s => !loaded.some(c => c.id === s.id)) : []
    // The ones still shown stay the same objects, as the history keys its
    // entries by them.
    const merged = [...loaded.map(c => Object.assign(shown.find(s => s.id === c.id) ?? c, c)), ...kept]
    layOverUnsent(dishId, merged, shown)
    shown.splice(0, shown.length, ...merged.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt)))
    return true
  }

  // Whether the Dish's history has loaded on this page: offline, only then
  // are its Comments there to change (an Unsent Change is laid over them).
  const historyLoaded = (dishId: string) => loadedOnce.has(dishId)

  // Lays the Unsent Changes of the Dish's Comments over `list` (what the
  // server said, in place), so nothing flickers back: a Comment written and
  // not there yet is added, an edited one has its text, a deleted one goes.
  // Doing it twice changes nothing more. (After a restart there are no
  // Comments shown yet, so the list is what the server said.)
  function layOverUnsent(dishId: string, list: CommentView[], shown: readonly CommentView[]) {
    for (const change of unsent?.changes.value ?? []) {
      if (!('dishId' in change) || change.dishId !== dishId) continue
      applyToComments(change, list, shown)
    }
  }

  // A Comment already shown stays the same object, as the history keys its
  // entries by them (a new one would play the entry animation again).
  function applyToComments(change: UnsentChange, list: CommentView[], shown: readonly CommentView[]) {
    switch (change.kind) {
      case 'comment':
        if (!list.some(c => c.id === change.commentId)) list.push(shown.find(c => c.id === change.commentId) ?? { id: change.commentId, text: change.text, createdAt: change.madeAt, editedAt: null, author: change.author })
        return
      case 'commentEdit': {
        const found = list.find(c => c.id === change.commentId)
        if (found) Object.assign(found, { text: change.text, editedAt: change.madeAt })
        return
      }
      case 'commentDelete':
        removeFrom(list, list.find(c => c.id === change.commentId))
    }
  }

  // Changes malkochen couldn't apply were dropped (4xx): the Comments among
  // them are loaded again, so what the server doesn't have goes from the
  // history (and the remaining Unsent Changes are laid over it).
  async function droppedChanges(dropped: readonly UnsentChange[]) {
    const dishIds = new Set(dropped.flatMap(c => c.kind === 'comment' || c.kind === 'commentEdit' || c.kind === 'commentDelete' ? [c.dishId] : []))
    for (const dishId of dishIds) {
      if (loadedOnce.has(dishId)) await openDish(dishId)
    }
  }

  // The Dish History as the detail shows it: when the Dish was added and by
  // whom, its Cookings and its Comments, in the order the server tells it
  // (historyEntries). Before it has loaded, without Comments. Empty if the
  // Dish isn't on the Board.
  function historyOf(dishId: string): DishHistoryEntry[] {
    const dish = find(dishId)
    return dish ? historyEntries(dish, comments.get(dishId) ?? []) : []
  }

  // Writing a Comment (PRD #318 stories 6–8), by `author` (the Member
  // writing it): it shows at the end of the Dish History at once, counted
  // on its card, and is filled in once the server has it. The device makes
  // its id and time, sent with it even online, so a write sent again
  // records it once. With no answer from malkochen (or while others
  // wait) it stays and is kept as an Unsent Change; from then on, with its
  // id, it can be edited and deleted. If the write fails, it goes again,
  // with a notice, and the result's Comment holds the text for the field.
  // Null for a text the server would refuse, or without "comment and vote".
  function writeComment(dishId: string, text: string, author: DishAdder): CommentResult | null {
    const said = commentText(text)
    if (!said || !mayComment()) return null
    const list = listOf(dishId)
    const commentId = crypto.randomUUID()
    const madeAt = new Date().toISOString()
    list.push({ id: '', text: said, createdAt: madeAt, editedAt: null, author })
    const pending = list.at(-1)!
    count(dishId, 1)
    function keepUnsent(): CommentResult {
      pending.id = commentId
      keep({ kind: 'comment', dishId, commentId, text: said!, author }, madeAt, find(dishId)?.title ?? '')
      return { comment: pending, unsent: true }
    }
    const settled = tracked(dishId, async (): Promise<CommentResult> => {
      if (anyUnsent()) return keepUnsent()
      try {
        Object.assign(pending, await transport.writeComment(dishId, said, { id: commentId, madeAt }))
        return { comment: pending }
      }
      catch (error) {
        if (unsent && isUnanswered(error)) return keepUnsent()
        removeFrom(listOf(dishId), pending)
        count(dishId, -1)
        return { comment: pending, notice: isRefused(error) ? 'commentNotAllowed' : 'commentFailed' }
      }
    })
    return { comment: pending, settled }
  }

  // Each edited Comment's text as the server last had it, while an edit of
  // it is under way: where a failed edit goes back to, also when an edit
  // before it is still unconfirmed.
  const confirmed = new WeakMap<CommentView, Pick<CommentView, 'text' | 'editedAt'>>()
  const editsUnderWay = new WeakMap<CommentView, number>()

  // Editing the Member's own Comment (stories 9–10): the new text shows at
  // once, marked "bearbeitet", then as the server saved it. If the edit
  // fails, the Comment is back as the server has it, with a notice; one the
  // server no longer has (deleted meanwhile) goes. Null for a Comment not
  // shown, still being written, a text the server would refuse, or
  // without "comment and vote".
  function editComment(dishId: string, commentId: string, text: string): CommentResult | null {
    const said = commentText(text)
    const found = commentId ? comments.get(dishId)?.find(c => c.id === commentId) : undefined
    if (!said || !found || !mayComment()) return null
    const comment: CommentView = found
    if (said === comment.text) return { comment }
    if (!editsUnderWay.get(comment)) confirmed.set(comment, { text: comment.text, editedAt: comment.editedAt })
    editsUnderWay.set(comment, (editsUnderWay.get(comment) ?? 0) + 1)
    const madeAt = new Date().toISOString()
    Object.assign(comment, { text: said, editedAt: madeAt })
    // The edit as an Unsent Change, while others wait or malkochen doesn't answer.
    // Null once kept.
    const keepUnsent = (): null => {
      keep({ kind: 'commentEdit', dishId, commentId, text: said }, madeAt, find(dishId)?.title ?? '')
      return null
    }
    const edited = queued(commentId, async (): Promise<CommentView | null> => {
      if (anyUnsent()) return keepUnsent()
      try {
        return await transport.editComment(commentId, said)
      }
      catch (error) {
        if (unsent && isUnanswered(error)) return keepUnsent()
        throw error
      }
    }, { moves: false })
      .finally(() => editsUnderWay.set(comment, editsUnderWay.get(comment)! - 1))
    const settled = tracked(dishId, () => edited).then((saved): CommentResult => {
      if (!saved) return { comment, unsent: true }
      confirmed.set(comment, { text: saved.text, editedAt: saved.editedAt })
      // A later edit under way shows its own text until it settles.
      if (!editsUnderWay.get(comment)) Object.assign(comment, saved)
      return { comment }
    }, (error: unknown): CommentResult => {
      if (isGone(error)) {
        removeFrom(listOf(dishId), comment)
        return { comment }
      }
      if (!editsUnderWay.get(comment)) Object.assign(comment, confirmed.get(comment))
      return { comment, notice: isRefused(error) ? 'commentNotAllowed' : 'commentEditFailed' }
    })
    return { comment, settled }
  }

  // Puts a Comment back into its Dish's history, in time order, whatever
  // was written meanwhile, and counts it again.
  function putBack(dishId: string, comment: CommentView) {
    deletedHere.delete(comment.id)
    const list = listOf(dishId)
    if (list.includes(comment)) return
    count(dishId, 1)
    // As the server orders them: by time, then id.
    const at = list.findIndex(c => c.id && (c.createdAt > comment.createdAt || (c.createdAt === comment.createdAt && c.id > comment.id)))
    list.splice(at === -1 ? list.length : at, 0, comment)
  }

  // Deleting a Comment (stories 11–12): the Member's own, or as the Owner
  // any. It goes at once. If the delete fails, it is back with a notice;
  // one the server no longer has counts as deleted. Null for a Comment not
  // shown or still being written.
  function deleteComment(dishId: string, commentId: string): CommentResult | null {
    const found = commentId ? comments.get(dishId)?.find(c => c.id === commentId) : undefined
    if (!found) return null
    const comment: CommentView = found
    removeFrom(listOf(dishId), comment)
    count(dishId, -1)
    deletedHere.add(commentId)

    // The delete as an Unsent Change, while others wait or malkochen doesn't answer.
    let unsentId: string | undefined
    const keepUnsent = () => {
      unsentId = keep({ kind: 'commentDelete', dishId, commentId }, new Date().toISOString(), find(dishId)?.title ?? '')
    }
    const deleted = tracked(dishId, () => queued(commentId, async () => {
      if (anyUnsent()) return keepUnsent()
      try {
        await transport.deleteComment(commentId)
      }
      catch (error) {
        if (unsent && isUnanswered(error)) return keepUnsent()
        throw error
      }
    }, { moves: false })).then(() => true, (error: unknown) => {
      if (isGone(error)) return true
      putBack(dishId, comment)
      return false
    })
    const settled = deleted.then((ok): CommentResult => ok ? { comment, ...unsentId && { unsent: true as const } } : { comment, notice: 'commentDeleteFailed' })

    // "Rückgängig": once the delete has settled, the Comment is back at
    // once, and then as the server restored it. If that fails, it goes
    // again, with a notice. A delete still unsent is taken back without
    // sending anything.
    async function undo(): Promise<CommentResult> {
      if (!await deleted) return { comment } // Never deleted, and back already.
      if (unsent && unsentId && await unsent.cancel(unsentId)) {
        unsentId = undefined
        putBack(dishId, comment)
        return { comment }
      }
      putBack(dishId, comment)
      const restored = tracked(dishId, () => queued(commentId, () => transport.restoreComment(commentId), { moves: false })).then((saved): CommentResult => {
        Object.assign(comment, saved)
        return { comment }
      }, (): CommentResult => {
        removeFrom(listOf(dishId), comment)
        count(dishId, -1)
        deletedHere.add(commentId)
        return { comment, notice: 'commentRestoreFailed' }
      })
      return { comment, settled: restored }
    }

    return { comment, notice: 'commentDeleted', undo, settled }
  }

  return { openDish, historyLoaded, droppedChanges, historyOf, writeComment, editComment, deleteComment }
}

function removeFrom<T>(list: T[], item: T) {
  const at = list.indexOf(item)
  if (at !== -1) list.splice(at, 1)
}
