import { landingBoard } from '../../utils/boards'

// Where the app opens: the last-used Board, creating "Meine Küche" on a
// first sign-in. Answers its id and the slug of its Address.
export default defineEventHandler(event => landingBoard(requireUser(event).id))
