import { archivedBoards, type ArchivedBoardView } from '../../utils/archived-boards'

// GET /api/boards/archived — the user's Archived Boards, for "Archiv" at the
// end of their Board Switcher: those they archived as Owner, the newest first.
export default defineEventHandler(async (event): Promise<ArchivedBoardView[]> => {
  return archivedBoards(requireUser(event).id)
})
