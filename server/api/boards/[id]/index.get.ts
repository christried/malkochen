import { getBoard } from '../../../utils/boards'

export default defineEventHandler(async (event) => {
  const found = await getBoard(boardIdParam(event), requireUser(event).id)
  if (!found) throw boardNotFound()
  return found
})
