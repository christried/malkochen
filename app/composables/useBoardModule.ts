import { boardModuleKey, type BoardModule } from '~/board/board-module'

// The open Board's client Board module, which its page (BoardScreen.vue) provides
// to the forms under it: their writes go through it.
export function useBoardModule() {
  const boardModule = inject(boardModuleKey)
  if (!boardModule) throw new Error('No Board module: only under a Board page')
  return boardModule
}

// NeedsNet's `allowed` for a change that needs the server to have the Dish: a
// Dish added offline and not sent yet (#462) is greyed out for it, like what
// needs a connection; else nothing is said (the connection decides).
export function allowedOnceSent(boardModule: Pick<BoardModule, 'isUnsentAdd'>, dishId: string): false | undefined {
  return boardModule.isUnsentAdd(dishId) ? false : undefined
}
