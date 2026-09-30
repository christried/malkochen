import { markOpened } from '../../../utils/boards'

// The Board page calls this when it's shown, so the app reopens it next time.
export default defineEventHandler(async (event) => {
  if (!await markOpened(boardIdParam(event), requireUser(event).id)) {
    throw boardNotFound()
  }
  setResponseStatus(event, 204)
  return null
})
