import { restoreBoard } from '../../../utils/archived-boards'
import type { BoardSummary } from '../../../utils/boards'

// POST /api/boards/:id/restore — "Wiederherstellen" under "Archiv" in the
// Board Switcher: the Owner brings an Archived Board back, with its Members.
// Anyone else, and a Board that isn't archived, gets "not found".
export default defineEventHandler(async (event): Promise<BoardSummary> => {
  const restored = await restoreBoard(boardIdParam(event), requireUser(event).id)
  if (!restored) throw boardNotFound()
  return restored
})
