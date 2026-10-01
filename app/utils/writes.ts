// Changes the app is sending to the server. Polling (useBoardSync) drops an
// answer while one is under way or started after it asked: the change shows
// on the Board already, and an answer from before it would undo it for a
// moment. Browser only; the server never sends these.

let underWay = 0
let started = 0

// Sends a change through, counting it while it is under way.
export function trackWrite<T>(request: Promise<T>): Promise<T> {
  started++
  underWay++
  return request.finally(() => underWay--)
}

// A mark to ask writesSince() about later.
export function writeMark(): number {
  return started
}

// Whether a change is under way or started since `mark`.
export function writesSince(mark: number): boolean {
  return underWay > 0 || started !== mark
}
