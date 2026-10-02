import { boardModuleKey } from '~/board/board-module'

// The open Board's client Board module, which its page (b/[id].vue) provides
// to the forms under it: their writes go through it.
export function useBoardModule() {
  const boardModule = inject(boardModuleKey)
  if (!boardModule) throw new Error('No Board module: only under a Board page')
  return boardModule
}
