import { boardVersion } from '../../../utils/boards'
import { countPoll } from '../../../utils/usage'

// GET /api/boards/:id/version — what an open Board asks every few seconds
// (ADR 0008): only the Board's version, so it loads the whole Board (POST
// /api/boards/:id/seen) only when the version moved. Writes nothing but,
// once in a while, the count of polls the Admin Page estimates function
// calls from (#348).
export default defineEventHandler(async (event): Promise<{ version: number }> => {
  const version = await boardVersion(boardIdParam(event), requireUser(event).id)
  if (version === null) throw boardNotFound()
  await countPoll()
  return { version }
})
