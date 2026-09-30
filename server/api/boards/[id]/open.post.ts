import { markOpened } from '../../../utils/boards'

// The Board page calls this when it's shown, so the app reopens it next time.
export default defineEventHandler(async (event) => {
  if (!await markOpened(boardIdParam(event), requireUser(event).id)) {
    throw createError({ statusCode: 404, statusMessage: 'Board not found' })
  }
  setResponseStatus(event, 204)
  return null
})
