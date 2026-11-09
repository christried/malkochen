// A write the server refused or never answered; `status` is its HTTP status
// if there was one (404: the Dish is gone there). Without one, malkochen gave
// no answer: the write may or may not have arrived (ADR 0012). Apart from the
// Board module, so the Unsent Changes can tell the two apart without a loop
// of imports.
export class WriteFailed extends Error {
  constructor(readonly status?: number) {
    super(status === undefined ? 'Write failed' : `Write failed (${status})`)
  }
}

// Whether `error` is a write that got no answer.
export function isUnanswered(error: unknown): boolean {
  return error instanceof WriteFailed && error.status === undefined
}
