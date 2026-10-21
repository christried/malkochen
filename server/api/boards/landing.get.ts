import { landingBoard, landingToAdd } from '../../utils/boards'

// Where the app opens: the last-used Board, creating "Meine Küche" on a
// first sign-in. Answers its id and the slug of its Address. With
// `?adding`, for something shared to malkochen: the last-used Board the
// user may add Dishes to, and whether there is one (`canAdd`).
export default defineEventHandler((event) => {
  const user = requireUser(event)
  return getQuery(event).adding === undefined
    ? landingBoard(user.id, callerLanguage(event))
    : landingToAdd(user.id, callerLanguage(event))
})
