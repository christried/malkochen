import { landingBoardId } from '../../utils/boards'

// Where the app opens: the last-used Board, creating "Meine Küche" on a
// first sign-in.
export default defineEventHandler(async event => ({ boardId: await landingBoardId(requireUser(event).id) }))
