import { isUnanswered } from './write-failed'

// The shape every write that can wait as an Unsent Change (ADR 0012) has:
// where changes already wait, this one joins them without trying the
// network; otherwise it is sent, and if malkochen gives no answer it is kept
// instead. Any other failure is the caller's to handle, as it rejects.
// `canKeep`: this write may be kept at all (the module has Unsent Changes, and
// the write is one that works offline); `waiting`: changes wait already.
export async function sendOrKeep<Sent, Kept>({ canKeep, waiting, send, keep }: {
  canKeep: boolean
  waiting: boolean
  send: () => Promise<Sent>
  keep: () => Kept
}): Promise<Sent | Kept> {
  if (canKeep && waiting) return keep()
  try {
    return await send()
  }
  catch (error) {
    if (canKeep && isUnanswered(error)) return keep()
    throw error
  }
}
