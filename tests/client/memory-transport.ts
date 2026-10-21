import type { BoardTransport } from '../../app/board/board-module'
import { WriteFailed } from '../../app/board/board-module'
import type { BoardView } from '../../server/utils/boards'
import type { ColumnView } from '../../server/utils/columns'
import type { CommentView } from '../../server/utils/comments'
import type { CookingView } from '../../server/utils/cookings'
import type { DishEditBody, AddDishBody } from '../../server/utils/dish-input'
import type { DishHistory } from '../../server/utils/dish-history'
import type { AddedDish, DishPlace, DishView, MovedDish, PlacedDish, SavedDish } from '../../server/utils/dishes'
import type { VoteView } from '../../server/utils/votes'
import { columnForNewDishes, landingIndex, recordsCooking } from '../../shared/placement'

// The in-memory transport for the client Board module's tests: a small fake
// of the server, holding its own copy of the Board, and of the Member's
// other Boards a Dish can be moved to. Tests change that copy
// as another Member would (deleting a Dish or a Column elsewhere), and can
// tell the next call of a write to fail with a status or to stay pending
// until they settle it.

type Write = keyof BoardTransport

// A call held pending: it does nothing on the server until it succeeds.
interface Held {
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
  // Each Dish's Comments on the server, oldest first, deleted ones too.
  comments: Map<string, (CommentView & { deleted?: true })[]>
  // Another Member writes a Comment on a Dish, or deletes one.
  writeCommentElsewhere: (dishId: string, text: string) => CommentView
  deleteCommentElsewhere: (commentId: string) => void
}

export function memoryTransport(board: BoardView, otherBoards: BoardView[] = []): MemoryTransport {
  const server = structuredClone(board)
  const others = structuredClone(otherBoards)
  const sent: string[] = []
  const replies = new Map<Write, Reply[]>()
  // Deleted Dishes keep their Column and index, so restoring puts them back.
  const deleted = new Map<string, { dish: DishView, columnId: string, index: number }>()
  // Deleted Cookings keep their Dish, so restoring puts them back.
  const deletedCookings = new Map<string, { cooking: CookingView, dishId: string }>()
  let cookings = 0
  let commentsWritten = 0
  const comments = new Map<string, (CommentView & { deleted?: true })[]>()
  let added = 0
  let addedColumns = 0

  // The Dish on the server that `matches`, and its Column: on this Board, or
  // on another of the Member's Boards it was moved to.
  function located(matches: (dish: DishView) => boolean) {
    for (const column of [server, ...others].flatMap(b => b.columns)) {
      const dish = column.dishes.find(matches)
      if (dish) return { dish, column }
    }
    return null
  }

  // Moves a Dish as the server does (shared/placement.ts), recording a
  // Cooking where the rules say so; without a Column, to the Gekocht Column
  // ("Gekocht ✓"). A Column on another of the Member's Boards takes it
  // there. Null for a Dish the server doesn't have.
  function moveOnServer(dishId: string, columnId: string | undefined, index: number | undefined, cook: boolean): MovedDish | null {
    const found = located(d => d.id === dishId)
    const isTarget = (c: BoardView['columns'][number]) => columnId === undefined ? c.isGekocht : c.id === columnId
    const onto = [server, ...others].find(b => b.columns.some(isTarget))
    const target = onto?.columns.find(isTarget)
    if (!found) return null
    if (!onto || !target) throw new WriteFailed(400)
    const to = landingIndex(target, dishId, index)
    found.column.dishes.splice(found.column.dishes.indexOf(found.dish), 1)
    target.dishes.splice(to, 0, found.dish)
    const placed = { ...structuredClone(found.dish), placement: { boardId: onto.id, columnId: target.id, index: to } }
    if (!recordsCooking(found.column, target, { cook })) return placed
    const cooking = { id: `cooking-${++cookings}`, cookedAt: new Date().toISOString(), recordedBy: null }
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
  // image without its Image Ticket isn't stored, as on the server; nor is an
  // own photo without its photo ticket.
  function addOnServer(boardId: string, input: AddDishBody): AddedDish {
    const dish: DishView = {
      id: `added-${++added}`,
      code: `new${added}`,
      title: input.title,
      source: input.source ? { link: input.source.link, kind: input.source.kind ?? 'other' } : null,
      creator: input.creator?.trim() || null,
      imageUrl: input.photo
        ? (input.photo.ticket ? input.photo.url : null)
        : input.imageUrl && input.imageTicket ? `/images/added-${added}.jpg` : null,
      imageFocus: { x: 50, y: 50 },
      placeholder: input.placeholder,
      addedBy: null,
      createdAt: new Date().toISOString(),
      cookings: [],
      votes: [],
      commentCount: 0,
    }
    const column = boardId === server.id ? columnForNewDishes(server.columns)! : { id: 'elsewhere', dishes: [] as DishView[] }
    column.dishes.unshift(dish)
    if (dish.imageUrl && input.imageFocus) dish.imageFocus = { ...input.imageFocus }
    const placed = { ...structuredClone(dish), placement: { boardId, columnId: column.id, index: 0 } }
    const refused = input.photo ? !input.photo.ticket : input.imageUrl && !input.imageTicket
    return refused ? { ...placed, imageNotStored: true } : placed
  }

  // Saves the fields sent, as the server reads them (trimmed; a blank
  // Creator is none). A new image without its Image Ticket isn't stored: the Dish
  // keeps the one it had. A new image starts in the centre unless its focus
  // point comes with it. Null for a Dish the server doesn't have.
  function editOnServer(dishId: string, changes: DishEditBody): SavedDish | null {
    const dish = located(d => d.id === dishId)?.dish
    if (!dish) return null
    const { title, source, creator, placeholder, imageUrl, imageTicket, imageFocus } = changes
    if (title !== undefined) dish.title = title.trim()
    if (source !== undefined) dish.source = source && { link: source.link, kind: source.kind ?? 'other' }
    if (creator !== undefined) dish.creator = creator?.trim() || null
    if (placeholder !== undefined) dish.placeholder = placeholder
    const refused = Boolean(imageUrl && !imageTicket)
    if (imageUrl === null || (imageUrl && imageTicket)) {
      dish.imageUrl = imageUrl && `/images/${dishId}-${Date.now()}.jpg`
      dish.imageFocus = { x: 50, y: 50 }
    }
    if (imageFocus && dish.imageUrl && !refused) dish.imageFocus = { ...imageFocus }
    const saved = structuredClone(dish)
    return refused ? { ...saved, imageNotStored: true } : saved
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

  // Several Dishes at once (#218), all or nothing as on the server: one
  // the server doesn't have refuses all (404), so does a Column it doesn't
  // have, or a Gekocht Column to move several into (400).
  function columnOnServer(columnId: string) {
    const onto = [server, ...others].find(b => b.columns.some(c => c.id === columnId))
    const column = onto?.columns.find(c => c.id === columnId)
    return onto && column ? { onto, column } : null
  }

  function allLocated(ids: string[]) {
    const found = ids.map(id => located(d => d.id === id))
    return found.every(f => f !== null) ? found as NonNullable<ReturnType<typeof located>>[] : null
  }

  function placedOnServer(ids: string[]): PlacedDish[] {
    return ids.map((id) => {
      const { dish, column } = located(d => d.id === id)!
      const onto = [server, ...others].find(b => b.columns.includes(column))!
      return { ...structuredClone(dish), placement: { boardId: onto.id, columnId: column.id, index: column.dishes.indexOf(dish) } }
    })
  }

  function moveManyOnServer(ids: string[], columnId: string): PlacedDish[] | null {
    const found = allLocated(ids)
    if (!found) return null
    const target = columnOnServer(columnId)
    if (!target || target.column.isGekocht) throw new WriteFailed(400)
    const moving = found.filter(f => f.column !== target.column)
    for (const { dish, column } of moving) column.dishes.splice(column.dishes.indexOf(dish), 1)
    target.column.dishes.unshift(...moving.map(f => f.dish))
    return placedOnServer(ids)
  }

  function placeManyOnServer(places: DishPlace[]): PlacedDish[] | null {
    const found = allLocated(places.map(p => p.dishId))
    if (!found) return null
    if (places.some(p => !columnOnServer(p.columnId))) throw new WriteFailed(400)
    const ordered = places.map((place, i) => ({ place, ...found[i]! }))
      .sort((a, b) => a.place.columnId.localeCompare(b.place.columnId) || a.place.index - b.place.index)
    for (const { place, dish } of ordered) {
      const now = located(d => d.id === dish.id)!
      now.column.dishes.splice(now.column.dishes.indexOf(dish), 1)
      const into = columnOnServer(place.columnId)!.column
      into.dishes.splice(Math.min(place.index, into.dishes.length), 0, dish)
    }
    return placedOnServer(places.map(p => p.dishId))
  }

  // Each keeps the index it had before any of them went, so restoring them
  // from the top puts each back at its own.
  function deleteManyOnServer(ids: string[]): true | null {
    const found = ids.map(id => server.columns.find(c => c.dishes.some(d => d.id === id)))
    if (found.some(c => !c)) return null
    const indexes = ids.map((id, i) => found[i]!.dishes.findIndex(d => d.id === id))
    ids.forEach((id, i) => {
      const column = found[i]!
      const [dish] = column.dishes.splice(column.dishes.findIndex(d => d.id === id), 1)
      deleted.set(id, { dish: dish!, columnId: column.id, index: indexes[i]! })
    })
    return true
  }

  function restoreManyOnServer(ids: string[]): PlacedDish[] | null {
    if (ids.some(id => !deleted.has(id))) return null
    const gone = ids.map(id => deleted.get(id)!).sort((a, b) => a.index - b.index)
    for (const id of ids) deleted.delete(id)
    for (const { dish, columnId, index } of gone) {
      const column = server.columns.find(c => c.id === columnId)!
      column.dishes.splice(Math.min(index, column.dishes.length), 0, dish)
    }
    return placedOnServer(ids)
  }

  // Adds a Column at the end of the Board, as the server does.
  function addColumnOnServer(boardId: string, name: string): ColumnView | null {
    if (boardId !== server.id) return null
    const column = { id: `column-${++addedColumns}`, name, subtitle: null, isGekocht: false }
    server.columns.push({ ...column, dishes: [] })
    return { ...column }
  }

  // The Dish History as the server builds it: added, then its Cookings and
  // Votes and Comments oldest first. Null for a Dish the server doesn't have.
  function historyOnServer(dishId: string): DishHistory | null {
    const dish = server.columns.flatMap(c => c.dishes).find(d => d.id === dishId)
    if (!dish) return null
    const rest = [
      ...dish.cookings.toReversed().map(cooking => ({ kind: 'cooking' as const, at: cooking.cookedAt, cooking })),
      ...dish.votes.map(vote => ({ kind: 'vote' as const, at: vote.votedAt, vote })),
      ...(comments.get(dishId) ?? []).filter(c => !c.deleted).map(({ deleted: _, ...comment }) => ({ kind: 'comment' as const, at: comment.createdAt, comment })),
    ].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    return structuredClone({ dishId, entries: [{ kind: 'added' as const, at: dish.createdAt, by: dish.addedBy }, ...rest] })
  }

  // Opening a Dish as the server records it: it has nothing new for the
  // Member any more. Answers its history.
  function openOnServer(dishId: string): DishHistory | null {
    const history = historyOnServer(dishId)
    if (history) server.newInHistoryDishIds = server.newInHistoryDishIds.filter(id => id !== dishId)
    return history
  }

  // Counts a Comment more (or fewer) on its Dish on the server.
  function countOnServer(dishId: string, by: number) {
    const dish = server.columns.flatMap(c => c.dishes).find(d => d.id === dishId)
    if (dish) dish.commentCount += by
  }

  // A Comment as the server keeps it: trimmed. By nobody in particular (the
  // tests don't sign in). Null for a Dish the server doesn't have.
  function writeCommentOnServer(dishId: string, text: string): CommentView | null {
    if (!server.columns.some(c => c.dishes.some(d => d.id === dishId))) return null
    const comment = { id: `comment-${++commentsWritten}`, text: text.trim(), createdAt: new Date().toISOString(), editedAt: null, author: { id: 'me', name: 'Ich', image: null } }
    comments.set(dishId, [...comments.get(dishId) ?? [], comment])
    countOnServer(dishId, 1)
    return structuredClone(comment)
  }

  function commentOnServer(commentId: string) {
    return [...comments.values()].flat().find(c => c.id === commentId) ?? null
  }

  function dishOfComment(commentId: string) {
    return [...comments].find(([, list]) => list.some(c => c.id === commentId))?.[0] ?? ''
  }

  function editCommentOnServer(commentId: string, text: string): CommentView | null {
    const comment = commentOnServer(commentId)
    if (!comment || comment.deleted) return null
    if (comment.text !== text.trim()) Object.assign(comment, { text: text.trim(), editedAt: new Date().toISOString() })
    return structuredClone(comment)
  }

  function deleteCommentOnServer(commentId: string): true | null {
    const comment = commentOnServer(commentId)
    if (!comment || comment.deleted) return null
    comment.deleted = true
    countOnServer(dishOfComment(commentId), -1)
    return true
  }

  function restoreCommentOnServer(commentId: string): CommentView | null {
    const comment = commentOnServer(commentId)
    if (!comment) return null
    if (comment.deleted) countOnServer(dishOfComment(commentId), 1)
    delete comment.deleted
    return structuredClone(comment)
  }

  // A Vote as the server keeps it: one per Member (the tests don't sign in,
  // so always "Ich"), only on a Dish with a Cooking (409 otherwise); the
  // same thumb again changes nothing. Null for a Dish the server doesn't
  // have.
  function setVoteOnServer(dishId: string, up: boolean): VoteView | null {
    const dish = located(d => d.id === dishId)?.dish
    if (!dish) return null
    if (dish.cookings.length === 0) throw new WriteFailed(409)
    const mine = dish.votes.find(v => v.voter?.id === 'me')
    if (mine?.up === up) return structuredClone(mine)
    const vote = { voter: { id: 'me', name: 'Ich', image: null }, up, votedAt: new Date().toISOString() }
    dish.votes = [...dish.votes.filter(v => v !== mine), vote]
    return structuredClone(vote)
  }

  function takeBackVoteOnServer(dishId: string): true | null {
    const dish = located(d => d.id === dishId)?.dish
    if (!dish) return null
    dish.votes = dish.votes.filter(v => v.voter?.id !== 'me')
    return true
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
    moveDishes: (ids, columnId) => answer('moveDishes', `${ids.join()} ${columnId}`, () => moveManyOnServer(ids, columnId)),
    placeDishes: places => answer('placeDishes', places.map(p => `${p.dishId}:${p.columnId}:${p.index}`).join(), () => placeManyOnServer(places)),
    deleteDishes: ids => answer('deleteDishes', ids.join(), () => deleteManyOnServer(ids)).then(() => undefined),
    restoreDishes: ids => answer('restoreDishes', ids.join(), () => restoreManyOnServer(ids)),
    addColumn: (boardId, name) => answer('addColumn', `${boardId} ${name}`, () => addColumnOnServer(boardId, name)),
    openDish: dishId => answer('openDish', dishId, () => openOnServer(dishId)),
    writeComment: (dishId, text) => answer('writeComment', `${dishId} ${text}`, () => writeCommentOnServer(dishId, text)),
    editComment: (commentId, text) => answer('editComment', `${commentId} ${text}`, () => editCommentOnServer(commentId, text)),
    deleteComment: commentId => answer('deleteComment', commentId, () => deleteCommentOnServer(commentId)).then(() => undefined),
    restoreComment: commentId => answer('restoreComment', commentId, () => restoreCommentOnServer(commentId)),
    setVote: (dishId, up) => answer('setVote', `${dishId} ${up}`, () => setVoteOnServer(dishId, up)),
    takeBackVote: dishId => answer('takeBackVote', dishId, () => takeBackVoteOnServer(dishId)).then(() => undefined),
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
    comments,
    writeCommentElsewhere: (dishId, text) => writeCommentOnServer(dishId, text)!,
    deleteCommentElsewhere: commentId => void deleteCommentOnServer(commentId),
  }
}
