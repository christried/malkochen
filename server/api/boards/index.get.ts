import { listBoards } from '../../utils/boards'

export default defineEventHandler(event => listBoards(requireUser(event).id))
