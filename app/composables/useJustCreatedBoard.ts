// The Board just made with "Neues Board", until it has opened and
// celebrated (board-created): only then, not when it is opened later.
export function useJustCreatedBoard() {
  return useState<string | null>('just-created-board', () => null)
}
