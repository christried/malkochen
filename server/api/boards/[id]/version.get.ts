import { boardVersion } from '../../../utils/boards'

// GET /api/boards/:id/version — what an open Board asks every few seconds
// (ADR 0008): only the Board's version, so it loads the whole Board (POST
// /api/boards/:id/seen) only when the version moved. Writes nothing.
export default defineEventHandler(async (event): Promise<{ version: number }> => {
  const version = await boardVersion(boardIdParam(event), requireUser(event).id)
  if (version === null) throw boardNotFound()
  return { version }
})
