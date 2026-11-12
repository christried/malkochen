import { waitUntil } from '@vercel/functions'
import type { H3Event } from 'h3'

// Work a request starts and lets finish after its answer is sent (#503), such
// as the Recipe Finder's search after a Dish was added. It starts at once and
// can never fail the answer or reject unhandled: an error is logged under
// `what`.
//
// The promise is registered twice. Nitro's `event.waitUntil` is the framework's
// own way, but the Vercel Node preset doesn't hand it to Vercel, so a function
// would be frozen after the answer. Vercel's `waitUntil` keeps the function
// alive until the work is done, and does nothing where there is no Vercel
// request (locally, in the tests), where the promise simply runs on.
export function afterAnswering(event: H3Event, work: () => Promise<void>, what: string): void {
  const promise = work().catch((error) => {
    console.error(`[${what}] failed after answering`, error)
  })
  event.waitUntil(promise)
  waitUntil(promise)
}
