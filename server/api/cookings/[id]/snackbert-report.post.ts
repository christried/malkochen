import { isRefusal, parseReportParts, SNACKBERT_REPORT_MAX_BYTES } from '../../../snackbert/report-input'
import { forgetSnackbertAccount, sendSnackbertReport, snackbertOn } from '../../../utils/snackbert'
import { dishImageFor, recordSnackbertReport, reportableCooking } from '../../../utils/snackbert-reports'

// POST /api/cookings/:id/snackbert-report — "Snackbert melden" (#424): sends
// Snackbert a Report of the Cooking, as multipart/form-data: optionally the
// text (`text`), a photo of the portion (`photo`, a JPEG) and a recording
// (`recording`), checked by server/snackbert/report-input.ts. The Dish's
// details and image go along. Nothing of the portion is kept here: only that
// the user reported the Cooking. For a Member who has Snackbert on (#423).
//
// Answers:
//   201 { reported: true }      sent, and recorded as reported to the user
//   400                         a part unknown, repeated, empty or unreadable
//   403 Snackbert is off        the user has it off, or Snackbert isn't set up
//   404                         the Cooking is not one the user may report (gone, archived, not theirs)
//   409 No Snackbert account    Snackbert has no account for their address; Snackbert is switched off
//   413                         the request, the text (over 1000 characters), the photo or the recording is too large
//   415                         not multipart, or a photo that isn't a JPEG, or a recording Snackbert doesn't take
//   429 Snackbert is full for today   Snackbert's own daily limit (or ours, rate-limits.ts)
//   502 Snackbert is not reachable    Snackbert failed or didn't answer in time; nothing recorded
export default defineEventHandler(async (event): Promise<{ reported: true }> => {
  const cookingId = cookingIdParam(event)
  const user = requireUser(event)

  // Refused before anything is read: Vercel would cut a larger body anyway.
  const length = getRequestHeader(event, 'content-length')
  if (length !== undefined && Number(length) > SNACKBERT_REPORT_MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'The Report is too large' })

  if (!await snackbertOn(user.id)) throw createError({ statusCode: 403, statusMessage: 'Snackbert is off' })
  const cooked = await reportableCooking(cookingId, user.id)
  if (!cooked) throw cookingNotFound()

  const parts = await readMultipartFormData(event).catch(() => {
    throw createError({ statusCode: 400, statusMessage: 'The Report is not a readable form' })
  })
  if (!parts) throw createError({ statusCode: 415, statusMessage: 'The Report must be multipart/form-data' })
  const input = parseReportParts(parts)
  if (isRefusal(input)) throw createError({ statusCode: input.status, statusMessage: input.message })

  // Each Report is a Gemini analysis on the Operator's bill (rate-limits.ts).
  await spendRateLimit(user.id, 'snackbert-report')

  // A Placeholder Dish has no image, so none is sent; one that can't be read is left out.
  const dishImage = await dishImageFor(cooked.dish)
  const answer = await sendSnackbertReport({
    email: user.email,
    cookedAt: cooked.cookedAt.toISOString(),
    text: input.text,
    dish: {
      title: cooked.dish.title,
      sourceUrl: cooked.dish.sourceLink,
      platform: cooked.dish.sourceKind,
      creator: cooked.dish.creator,
      caption: cooked.dish.caption,
    },
    photo: input.photo,
    recording: input.recording,
    dishImage,
  })

  if (answer === 'sent') {
    await recordSnackbertReport(cookingId, user.id)
    setResponseStatus(event, 201)
    return { reported: true }
  }
  if (answer === 'no-account') {
    await forgetSnackbertAccount(user.id)
    throw createError({ statusCode: 409, statusMessage: 'No Snackbert account' })
  }
  if (answer === 'daily-limit') throw createError({ statusCode: 429, statusMessage: 'Snackbert is full for today' })
  throw createError({ statusCode: 502, statusMessage: 'Snackbert is not reachable' })
})
