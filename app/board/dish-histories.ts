import { reactive } from 'vue'
// Relative imports, not `~~`, as in board-module.ts.
import type { CommentView } from '../../server/utils/comments'
import type { DishHistory, DishHistoryEntry } from '../../server/utils/dish-history'
import type { DishAdder, DishView } from '../../server/utils/dishes'
import { commentText } from '../utils/comment-text'

// The Board module's part for the Dish History ("Verlauf", #332) of the
// Dishes whose detail opens: loaded from the server as the detail opens,
// and its Comments written, edited and deleted as optimistic writes, like
// the Board's own (board-module.ts). Its Cookings are the Board's: the
// module changes those as Dishes are cooked and Cookings deleted, so the
// history shows them from there, never a copy that could lag behind.

// What the page tells the Member about a Comment, as a key in its UI
// strings. `commentDeleted` comes with an undo; the others say a write
// failed (`commentFailed`: writing it, whose text the page gives back to
// the field).
export type CommentNotice = 'commentDeleted' | 'commentFailed' | 'commentEditFailed' | 'commentDeleteFailed' | 'commentRestoreFailed'

export interface CommentResult {
  comment: CommentView
  notice?: CommentNotice
  undo?: () => Promise<CommentResult>
  settled?: Promise<CommentResult>
}

// How the Dish History reaches the server (BoardTransport).
export interface HistoryTransport {
  dishHistory: (dishId: string) => Promise<DishHistory>
  writeComment: (dishId: string, text: string) => Promise<CommentView>
  editComment: (commentId: string, text: string) => Promise<CommentView>
  deleteComment: (commentId: string) => Promise<void>
  restoreComment: (commentId: string) => Promise<CommentView>
}

interface Needs {
  transport: HistoryTransport
  // The Dish as the Board shows it, if it is on the Board.
  find: (dishId: string) => DishView | undefined
  // Runs `write` after the writes queued before it under the same key
  // (board-module.ts).
  queued: <T>(key: string, write: () => Promise<T>, options: { moves: false }) => Promise<T>
  // Whether a failed write failed because the server no longer has it (404).
  isGone: (error: unknown) => boolean
}

export function createDishHistories({ transport, find, queued, isGone }: Needs) {
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
  const loadedOnce = new Set<string>()
  const deletedHere = new Set<string>()

  // The Dish's Comments, as the reactive copy, so changes to it show.
  function listOf(dishId: string): CommentView[] {
    if (!comments.has(dishId)) comments.set(dishId, [])
    return comments.get(dishId)!
  }

  // Loads a Dish's history from the server, as its detail opens. If a
  // Comment write of the Dish was under way or started meanwhile, the
  // server may have answered without it, so the answer is dropped, unless
  // it is the first to load: then the Comments shown that it doesn't have
  // (the Member's own, written meanwhile) stay beside it. False if it
  // couldn't load.
  async function loadHistory(dishId: string): Promise<boolean> {
    const asked = writes.get(dishId) ?? 0
    const quiet = !underWay.get(dishId)
    let history: DishHistory
    try {
      history = await transport.dishHistory(dishId)
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
    shown.splice(0, shown.length, ...merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt)))
    return true
  }

  // The Dish History as the detail shows it: when the Dish was added and by
  // whom, its Cookings and its Comments, oldest first (as the server builds
  // it, server/utils/dish-history.ts). Before it has loaded, without
  // Comments. Empty if the Dish isn't on the Board.
  function historyOf(dishId: string): DishHistoryEntry[] {
    const dish = find(dishId)
    if (!dish) return []
    const rest: DishHistoryEntry[] = [
      ...dish.cookings.toReversed().map(cooking => ({ kind: 'cooking' as const, at: cooking.cookedAt, cooking })),
      ...(comments.get(dishId) ?? []).map(comment => ({ kind: 'comment' as const, at: comment.createdAt, comment })),
    ]
    return [
      { kind: 'added', at: dish.createdAt, by: dish.addedBy },
      ...rest.sort((a, b) => Date.parse(a.at) - Date.parse(b.at)),
    ]
  }

  // Writing a Comment (PRD #318 stories 6–8), by `author` (the Member
  // writing it): it shows at the end of the Dish History at once, and is
  // filled in once the server has it. If the write fails, it goes again,
  // with a notice, and the result's Comment holds the text for the field.
  // Null for a text the server would refuse.
  function writeComment(dishId: string, text: string, author: DishAdder): CommentResult | null {
    const said = commentText(text)
    if (!said) return null
    const list = listOf(dishId)
    list.push({ id: '', text: said, createdAt: new Date().toISOString(), editedAt: null, author })
    const pending = list.at(-1)!
    const settled = tracked(dishId, () => transport.writeComment(dishId, said)).then((saved): CommentResult => {
      Object.assign(pending, saved)
      return { comment: pending }
    }, (): CommentResult => {
      removeFrom(listOf(dishId), pending)
      return { comment: pending, notice: 'commentFailed' }
    })
    return { comment: pending, settled }
  }

  // Editing the Member's own Comment (stories 9–10): the new text shows at
  // once, marked "bearbeitet", then as the server saved it. If the edit
  // fails, the Comment is back as it was, with a notice; one the server no
  // longer has (deleted meanwhile) goes. Null for a Comment not shown, still
  // being written, or a text the server would refuse.
  function editComment(dishId: string, commentId: string, text: string): CommentResult | null {
    const said = commentText(text)
    const comment = commentId ? comments.get(dishId)?.find(c => c.id === commentId) : undefined
    if (!said || !comment) return null
    if (said === comment.text) return { comment }
    const before = { text: comment.text, editedAt: comment.editedAt }
    Object.assign(comment, { text: said, editedAt: new Date().toISOString() })
    const settled = tracked(dishId, () => queued(commentId, () => transport.editComment(commentId, said), { moves: false })).then((saved): CommentResult => {
      Object.assign(comment, saved)
      return { comment }
    }, (error: unknown): CommentResult => {
      if (isGone(error)) {
        removeFrom(listOf(dishId), comment)
        return { comment }
      }
      Object.assign(comment, before)
      return { comment, notice: 'commentEditFailed' }
    })
    return { comment, settled }
  }

  // Puts a Comment back into its Dish's history, in time order, whatever
  // was written meanwhile.
  function putBack(dishId: string, comment: CommentView) {
    deletedHere.delete(comment.id)
    const list = listOf(dishId)
    if (list.includes(comment)) return
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
    deletedHere.add(commentId)

    const deleted = tracked(dishId, () => queued(commentId, () => transport.deleteComment(commentId), { moves: false })).then(() => true, (error: unknown) => {
      if (isGone(error)) return true
      putBack(dishId, comment)
      return false
    })
    const settled = deleted.then((ok): CommentResult => ok ? { comment } : { comment, notice: 'commentDeleteFailed' })

    // "Rückgängig": once the delete has settled, the Comment is back at
    // once, and then as the server restored it. If that fails, it goes
    // again, with a notice.
    async function undo(): Promise<CommentResult> {
      if (!await deleted) return { comment } // Never deleted, and back already.
      putBack(dishId, comment)
      const restored = tracked(dishId, () => queued(commentId, () => transport.restoreComment(commentId), { moves: false })).then((saved): CommentResult => {
        Object.assign(comment, saved)
        return { comment }
      }, (): CommentResult => {
        removeFrom(listOf(dishId), comment)
        deletedHere.add(commentId)
        return { comment, notice: 'commentRestoreFailed' }
      })
      return { comment, settled: restored }
    }

    return { comment, notice: 'commentDeleted', undo, settled }
  }

  return { loadHistory, historyOf, writeComment, editComment, deleteComment }
}

function removeFrom<T>(list: T[], item: T) {
  const at = list.indexOf(item)
  if (at !== -1) list.splice(at, 1)
}
