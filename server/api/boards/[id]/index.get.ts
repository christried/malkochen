import { getBoard } from '../../../utils/boards'

export default defineEventHandler(async (event) => {
  const found = await getBoard(boardIdParam(event), requireUser(event).id, callerLanguage(event))
  if (!found) throw boardNotFound()
  return found
})
