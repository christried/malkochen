import { getBoard } from '../../../utils/boards'

export default defineEventHandler(async (event) => {
  const found = await getBoard(boardIdParam(event), requireUser(event).id)
  if (!found) throw createError({ statusCode: 404, statusMessage: 'Board not found' })
  return found
})
