import type { BoardModule } from './board-module'

// NeedsNet's `allowed` for a change that needs the server to have the Dish: a
// Dish added offline and not sent yet (#462) is greyed out for it, like what
// needs a connection; else nothing is said (the connection decides).
export function allowedOnceSent(boardModule: Pick<BoardModule, 'isUnsentAdd'>, dishId: string): false | undefined {
  return boardModule.isUnsentAdd(dishId) ? false : undefined
}
