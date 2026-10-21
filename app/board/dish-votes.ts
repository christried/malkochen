// Relative imports, not `~~`, as in board-module.ts.
import type { DishAdder, DishView } from '../../server/utils/dishes'
import type { VoteView } from '../../server/utils/votes'

// The Board module's part for Votes (CONTEXT.md: Vote, #334): the Member's
// thumb on a Cooked Dish, from "Wie war's?" in its detail and the Gekocht
// toast, as an optimistic write like the Board's own (board-module.ts). A
// Dish's Votes are part of it on the Board, so the card, the detail and the
// Dish History all show them from there.

// What the page tells the Member about a Vote, as a key in its UI strings:
// the write failed (`voteNotAllowed`: refused as the user's Permissions no
// longer allow it).
export type VoteNotice = 'voteFailed' | 'voteNotAllowed'

export interface VoteResult {
  // The Member's Vote now: null once taken back.
  vote: VoteView | null
  notice?: VoteNotice
  undo?: () => Promise<VoteResult>
  settled?: Promise<VoteResult>
}

// How Votes reach the server (BoardTransport).
export interface VoteTransport {
  setVote: (dishId: string, up: boolean) => Promise<VoteView>
  takeBackVote: (dishId: string) => Promise<void>
}

// What the Board module lends it.
interface VoteHost {
  transport: VoteTransport
  // The Dish as the Board shows it, if it is on the Board.
  find: (dishId: string) => DishView | undefined
  // Runs `write` after the writes queued before it under the same key
  // (board-module.ts).
  queued: <T>(key: string, write: () => Promise<T>, options: { moves: false }) => Promise<T>
  // Whether a failed write was refused for the user's Permissions (403).
  isRefused: (error: unknown) => boolean
  // Whether the user may vote on the Board ("comment and vote").
  mayVote: () => boolean
}

export function createDishVotes({ transport, find, queued, isRefused, mayVote }: VoteHost) {
  // Each Dish's Vote of the Member's as the server last had it, while a
  // Vote of theirs on it is under way: where a failed one goes back to,
  // also when one before it is still unconfirmed.
  const confirmed = new Map<string, VoteView | null>()
  const underWay = new Map<string, number>()

  // Shows `vote` as the Member's (`voterId`) on the Dish, wherever it is now:
  // after the others, as it was set last. Null takes theirs off.
  function show(dishId: string, voterId: string, vote: VoteView | null) {
    const dish = find(dishId)
    if (!dish) return
    const others = dish.votes.filter(v => v.voter.id !== voterId)
    dish.votes = vote ? [...others, vote] : others
  }

  // The Member's Vote on a Cooked Dish (PRD #318 stories 14–17), by `voter`
  // (the Member voting): a thumb up or down (`up`), or null to take theirs
  // back. It shows on the Dish at once, after the others, then as the
  // server saved it. It waits for the Dish's writes before it, so a Vote
  // right after "Gekocht ✓" reaches the server once that Cooking is
  // recorded. If it fails, the Member's Vote is back to what the server
  // has, with a notice. Null for a Dish not shown, never Cooked, the Vote
  // it has already, or without "comment and vote".
  function vote(dishId: string, up: boolean | null, voter: DishAdder): VoteResult | null {
    const dish = find(dishId)
    if (!dish || dish.cookings.length === 0 || !mayVote()) return null
    const before = dish.votes.find(v => v.voter.id === voter.id) ?? null
    if ((before?.up ?? null) === up) return null
    const now: VoteView | null = up === null ? null : { voter, up, votedAt: new Date().toISOString() }
    if (!underWay.get(dishId)) confirmed.set(dishId, before)
    underWay.set(dishId, (underWay.get(dishId) ?? 0) + 1)
    show(dishId, voter.id, now)

    const write = () => up === null ? transport.takeBackVote(dishId).then(() => null) : transport.setVote(dishId, up)
    const settled = queued(dishId, write, { moves: false }).then((saved): VoteResult => {
      confirmed.set(dishId, saved)
      // A later Vote under way shows its own thumb until it settles.
      if (underWay.get(dishId) === 1 && now && saved) Object.assign(now, saved)
      return { vote: now }
    }, (error: unknown): VoteResult => {
      if (underWay.get(dishId) === 1) show(dishId, voter.id, confirmed.get(dishId) ?? null)
      return { vote: confirmed.get(dishId) ?? null, notice: isRefused(error) ? 'voteNotAllowed' : 'voteFailed' }
    }).finally(() => underWay.set(dishId, underWay.get(dishId)! - 1))

    // "Rückgängig": once the Vote has settled, the Member's Vote is back to
    // the one they had before, as a Vote of its own.
    async function undo(): Promise<VoteResult> {
      const ended = await settled
      if (ended.notice) return ended // Never saved, and back already.
      return vote(dishId, before?.up ?? null, voter) ?? { vote: before }
    }

    return { vote: now, undo, settled }
  }

  return { vote }
}
