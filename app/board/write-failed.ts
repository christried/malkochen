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

// Whether a failed request got no answer from malkochen: no response at all,
// or Vercel's own error page (a 5xx with x-vercel-error), as the connection
// plugin and the service worker count it. What `$fetch` rejects with.
export function gotNoAnswer(error: unknown): boolean {
  const { statusCode, status, response } = (error ?? {}) as { statusCode?: number, status?: number, response?: { status?: number, headers?: Headers } }
  const code = statusCode ?? response?.status ?? status
  if (code === undefined) return true
  return code >= 500 && !!response?.headers?.has('x-vercel-error')
}
