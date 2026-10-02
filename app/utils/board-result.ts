import type { BoardListing } from '~~/server/utils/boards'
import type { BoardModule } from '~/board/board-module'

// What the Board page needs, besides a result of the client Board module,
// to show it (showResult in b/[id].vue): where the Gekocht confetti bursts
// from (`origin`; null if it was set off already), and, for a Dish moved
// with "Verschieben nach…", that a Toast says where to (`moved`: to a Column
// of this Board, or of `toBoard`).
export interface ResultContext {
  origin?: Point | null
  moved?: { toBoard: BoardListing | null }
}

// "Verschieben nach…" (MoveTargetPicker), from a card's menu or the Dish
// detail: to the top of a Column of this Board, or of `toBoard`.
export function moveToPicked(boardModule: BoardModule, dishId: string, columnId: string, toBoard: BoardListing | null) {
  return toBoard
    ? boardModule.moveToBoard(dishId, { boardId: toBoard.id, columnId })
    : boardModule.moveDish(dishId, { columnId })
}
