import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { databaseRows } from './time-travel'
import { startSnackbertService, type SnackbertService, type SnackbertSentReport } from '../support/snackbert-service'
import { TEST_SNACKBERT_SECRET } from '../support/test-auth-env'

// Snackbert Reports (CONTEXT.md: Snackbert Report, #424): a Member with
// Snackbert on sends Snackbert a Report of a Cooking, with the Dish's details,
// its image and, if they like, a photo, a recording and their words. What is
// forwarded, what is refused, what is kept (only that the Cooking was
// reported), and what it does to the Cooking's Snackbert answer. Snackbert is
// the stand-in (snackbert-service.ts). The users below are used by this file
// only, and reused when a test is done with them.

const VOLTA = ALLOWLISTED[184]
const AVOGADRO = ALLOWLISTED[185]
const GOLGI = ALLOWLISTED[186]
const MARCONI = ALLOWLISTED[187]
const NATTA = ALLOWLISTED[188]
const SEGRE = ALLOWLISTED[189]
const RUBBIA = ALLOWLISTED[190]
const MAJORANA = ALLOWLISTED[191]
const FERMI_LAURA = ALLOWLISTED[192]
const GIACCONI = ALLOWLISTED[193]

const MISSING = '00000000-0000-4000-8000-000000000000'
const SECRET = `Bearer ${TEST_SNACKBERT_SECRET}`

interface Board { id: string, inviteToken: string, columns: { id: string, isGekocht: boolean, dishes: { id: string }[] }[] }
interface Dish { id: string, imageUrl: string | null }
interface Cooking { id: string, cookedAt: string }
interface CookedDish { boardId: string, dishId: string, cookingId: string, cookedAt: string }

let snackbert: SnackbertService

beforeAll(async () => {
  snackbert = await startSnackbertService()
})

afterAll(() => snackbert.close())

beforeEach(() => snackbert.forget())

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

// Signs in, with Snackbert on: the account is there, and the switch is thrown.
async function snackbertCaller(email: string): Promise<Caller> {
  const caller = await signIn(email)
  snackbert.accounts.add(email)
  expect((await caller.fetch('/api/me/snackbert', { method: 'PUT' })).status).toBe(204)
  return caller
}

// A Dish added to the caller's landing Board and cooked, with the Cooking it recorded.
async function cookedDish(caller: Caller, title = 'Linsensuppe', { photo }: { photo?: { url: string, ticket: string } } = {}): Promise<CookedDish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title, placeholder: 'bowl', ...photo && { photo } })
  expect(res.status).toBe(201)
  const dish = await res.json() as Dish
  const cooked = await caller.fetch(`/api/dishes/${dish.id}/cook`, { method: 'POST' })
  expect(cooked.status).toBe(200)
  const { cooking } = await cooked.json() as { cooking: Cooking }
  return { boardId: board.id, dishId: dish.id, cookingId: cooking.id, cookedAt: cooking.cookedAt }
}

// A multipart form: a text field, or a file with its name.
type Part = [name: string, value: string | Blob, filename?: string]
function formOf(...parts: Part[]): FormData {
  const body = new FormData()
  for (const [name, value, filename] of parts) {
    if (typeof value === 'string') body.append(name, value)
    else body.append(name, value, filename)
  }
  return body
}

const blobOf = (bytes: Uint8Array, type: string) => new Blob([new Uint8Array(bytes)], { type })

const sendReport = (caller: Caller, cookingId: string, body: FormData | string, headers: Record<string, string> = {}) =>
  caller.fetch(`/api/cookings/${cookingId}/snackbert-report`, { method: 'POST', headers, body })

// The Reports Snackbert received, oldest first.
const sent = () => snackbert.requests.filter(r => r.path === '/reports').map(r => r.body as SnackbertSentReport)

async function reportsKept(cookingId: string): Promise<number> {
  const [row] = await databaseRows<{ n: number }>('select count(*)::int as n from snackbert_report where cooking_id = $1', [cookingId])
  return row?.n ?? 0
}

// Nothing reached Snackbert, and nothing was kept, for a refused Report.
async function expectRefused(cookingId: string, res: Response, status: number) {
  expect(res.status).toBe(status)
  expect(sent()).toEqual([])
  expect(await reportsKept(cookingId)).toBe(0)
}

const jpegHead = Buffer.from([0xFF, 0xD8, 0xFF])
// A small real JPEG, as the client sends one: shrunk, and a JPEG all the way.
const smallPhoto = () => sharp({ create: { width: 300, height: 200, channels: 3, background: '#c84' } }).jpeg().toBuffer()
// The start of a WebM recording (EBML header), and some bytes after it.
const webm = Buffer.concat([Buffer.from([0x1A, 0x45, 0xDF, 0xA3]), Buffer.alloc(1000, 1)])

test('a text-only Report goes to Snackbert as the Cooking and Dish say, and is answered 201', async () => {
  const volta = await snackbertCaller(VOLTA)
  const cooked = await cookedDish(volta)

  const res = await sendReport(volta, cooked.cookingId, formOf(['text', 'Mit viel Parmesan']))

  expect(res.status).toBe(201)
  expect(await res.json()).toEqual({ reported: true })
  expect(sent()).toEqual([{
    report: {
      email: VOLTA,
      cookedAt: cooked.cookedAt,
      text: 'Mit viel Parmesan',
      dish: { title: 'Linsensuppe', sourceUrl: null, platform: null, creator: null, caption: null, imageKind: null },
    },
    files: {},
  }])
  expect(snackbert.requests.filter(r => r.path === '/reports')[0]!.authorization).toBe(SECRET)
})

test('a photo and a recording go to Snackbert too, the recording with its type made plain', async () => {
  const avogadro = await snackbertCaller(AVOGADRO)
  const cooked = await cookedDish(avogadro)
  const photo = await smallPhoto()

  const res = await sendReport(avogadro, cooked.cookingId, formOf(
    ['text', 'Lecker'],
    ['photo', blobOf(photo, 'image/jpeg'), 'photo.jpg'],
    ['recording', blobOf(webm, 'audio/webm;codecs=opus'), 'recording.webm'],
  ))

  expect(res.status).toBe(201)
  const [report] = sent()
  expect(report!.report.text).toBe('Lecker')
  expect(report!.files.photo).toEqual({ type: 'image/jpeg', size: photo.length, bytes: expect.any(Buffer) })
  expect(report!.files.recording).toEqual({ type: 'audio/webm', size: webm.length, bytes: expect.any(Buffer) })
  expect(report!.files.dishImage).toBeUndefined()
})

test('a Dish with its own photo sends that photo as its dish image, of kind ownPhoto; without an image, none is sent', async () => {
  const golgi = await snackbertCaller(GOLGI)
  const board = await landingBoard(golgi)
  const upload = await golgi.fetch(`/api/boards/${board.id}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(await smallPhoto()) })
  expect(upload.status).toBe(201)
  const photo = await upload.json() as { url: string, ticket: string }
  const cooked = await cookedDish(golgi, 'Shakshuka', { photo })

  expect((await sendReport(golgi, cooked.cookingId, formOf(['text', '']))).status).toBe(201)

  const [withPhoto] = sent()
  expect(withPhoto!.report.dish.imageKind).toBe('ownPhoto')
  expect(withPhoto!.files.dishImage).toEqual({ type: 'image/jpeg', size: expect.any(Number), bytes: expect.any(Buffer) })
  expect(withPhoto!.files.dishImage!.size).toBeGreaterThan(0)
  const [flagged] = await databaseRows<{ flag: boolean }>('select image_is_own_photo as flag from dish where id = $1', [cooked.dishId])
  expect(flagged?.flag).toBe(true)

  // The Member takes the photo away: the Dish is a Placeholder again, its flag
  // cleared, and the next Report sends no image.
  const edited = await golgi.fetch(`/api/dishes/${cooked.dishId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageUrl: null, placeholder: 'ramen' }) })
  expect(edited.status).toBe(200)
  const [cleared] = await databaseRows<{ flag: boolean }>('select image_is_own_photo as flag from dish where id = $1', [cooked.dishId])
  expect(cleared?.flag).toBe(false)

  expect((await sendReport(golgi, cooked.cookingId, formOf(['text', '']))).status).toBe(201)
  const again = sent()[1]!
  expect(again.report.dish.imageKind).toBeNull()
  expect(again.files.dishImage).toBeUndefined()
})

test('nothing of the portion stays in malkochen: the Report kept is only that the Cooking was reported', async () => {
  const marconi = await snackbertCaller(MARCONI)
  const cooked = await cookedDish(marconi)
  const needle = 'Schnipsel-Geheimtext-4711'

  const res = await sendReport(marconi, cooked.cookingId, formOf(
    ['text', `${needle} sehr geheim`],
    ['photo', blobOf(await smallPhoto(), 'image/jpeg'), 'photo.jpg'],
    ['recording', blobOf(webm, 'audio/webm'), 'recording.webm'],
  ))
  expect(res.status).toBe(201)

  const columns = await databaseRows<{ column_name: string }>(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'snackbert_report' order by column_name`)
  expect(columns.map(c => c.column_name)).toEqual(['cooking_id', 'id', 'reported_at', 'user_id'])
  const kept = await databaseRows('select * from snackbert_report where cooking_id = $1', [cooked.cookingId])
  expect(kept).toHaveLength(1)

  // Every table of the database, row by row: none holds the text.
  const tables = await databaseRows<{ table_name: string }>(`select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'`)
  for (const { table_name } of tables) {
    const [row] = await databaseRows<{ n: number }>(`select count(*)::int as n from "${table_name}" t where t::text like $1`, [`%${needle}%`])
    expect({ table: table_name, n: row?.n ?? 0 }).toEqual({ table: table_name, n: 0 })
  }
})

test('a Report is refused while Snackbert is off, and Snackbert is not asked', async () => {
  const rubbia = await signIn(RUBBIA)

  const res = await sendReport(rubbia, MISSING, formOf(['text', 'Hallo']))

  expect(res.status).toBe(403)
  expect(snackbert.requests).toEqual([])
})

test('a Cooking of someone else\'s Board is not found, and nothing is sent', async () => {
  const natta = await snackbertCaller(NATTA)
  const cooked = await cookedDish(natta, 'Kichererbsen')
  const majorana = await snackbertCaller(MAJORANA)

  const res = await sendReport(majorana, cooked.cookingId, formOf(['text', 'Hallo']))

  await expectRefused(cooked.cookingId, res, 404)
})

test('a Cooking of an archived Dish is not found, and nothing is sent', async () => {
  const natta = await snackbertCaller(NATTA)
  const cooked = await cookedDish(natta, 'Ramen')
  expect((await natta.fetch(`/api/dishes/${cooked.dishId}`, { method: 'DELETE' })).status).toBe(204)

  const res = await sendReport(natta, cooked.cookingId, formOf(['text', 'Hallo']))

  await expectRefused(cooked.cookingId, res, 404)
})

test('a text of 1000 characters is sent, counted by characters and not by bytes or UTF-16 units', async () => {
  const marconi = await snackbertCaller(MARCONI)
  const cooked = await cookedDish(marconi)

  const res = await sendReport(marconi, cooked.cookingId, formOf(['text', '🍜'.repeat(1000)]))

  expect(res.status).toBe(201)
  expect(sent()[0]!.report.text).toBe('🍜'.repeat(1000))
})

test('a text of more than 1000 characters is too large, and nothing is sent', async () => {
  const natta = await snackbertCaller(NATTA)
  const cooked = await cookedDish(natta)

  const res = await sendReport(natta, cooked.cookingId, formOf(['text', '🍜'.repeat(1001)]))

  await expectRefused(cooked.cookingId, res, 413)
})

test('a photo of exactly 1.5 MB is sent, one byte more is too large', async () => {
  const giacconi = await snackbertCaller(GIACCONI)
  const cooked = await cookedDish(giacconi)
  const largest = Buffer.concat([jpegHead, Buffer.alloc(1_500_000 - jpegHead.length)])

  expect((await sendReport(giacconi, cooked.cookingId, formOf(['photo', blobOf(largest, 'image/jpeg'), 'photo.jpg']))).status).toBe(201)
  expect(sent()[0]!.files.photo!.size).toBe(1_500_000)

  const tooLarge = Buffer.concat([jpegHead, Buffer.alloc(1_500_001 - jpegHead.length)])
  const res = await sendReport(giacconi, cooked.cookingId, formOf(['photo', blobOf(tooLarge, 'image/jpeg'), 'photo.jpg']))
  expect(res.status).toBe(413)
  expect(sent()).toHaveLength(1)
})

test('a recording of a type Snackbert does not take is refused, and nothing is sent', async () => {
  const natta = await snackbertCaller(NATTA)
  const cooked = await cookedDish(natta)

  const res = await sendReport(natta, cooked.cookingId, formOf(['recording', blobOf(webm, 'audio/ogg'), 'recording.ogg']))

  await expectRefused(cooked.cookingId, res, 415)
})

test('a photo that is not a JPEG is refused, and nothing is sent', async () => {
  const natta = await snackbertCaller(NATTA)
  const cooked = await cookedDish(natta)

  const res = await sendReport(natta, cooked.cookingId, formOf(['photo', blobOf(Buffer.from('a PNG, say, or a text file'), 'image/jpeg'), 'photo.jpg']))

  await expectRefused(cooked.cookingId, res, 415)
})

test('a part that is not text, photo or recording is refused, and so is a body that is not multipart', async () => {
  const natta = await snackbertCaller(NATTA)
  const cooked = await cookedDish(natta)

  const unknown = await sendReport(natta, cooked.cookingId, formOf(['extra', 'Hallo']))
  await expectRefused(cooked.cookingId, unknown, 400)

  const notMultipart = await sendReport(natta, cooked.cookingId, '{"text":"Hallo"}', { 'content-type': 'application/json' })
  await expectRefused(cooked.cookingId, notMultipart, 415)
})

test('when Snackbert has no account for the address, the Report is refused, Snackbert is switched off and nothing is recorded', async () => {
  const giacconi = await snackbertCaller(GIACCONI)
  const cooked = await cookedDish(giacconi)
  const log = await watchEvents()
  snackbert.accounts.delete(GIACCONI)

  const res = await sendReport(giacconi, cooked.cookingId, formOf(['text', 'Hallo']))

  expect(res.status).toBe(409)
  expect(await reportsKept(cooked.cookingId)).toBe(0)
  expect(await (await giacconi.fetch('/api/me/snackbert')).json()).toEqual({ available: false, on: false })
  expect(await (await giacconi.fetch(`/api/dishes/${cooked.dishId}/snackbert`)).json()).toEqual({ on: false, reported: [] })
  const events = await log.recorded()
  expect(events.filter(e => e.kind === 'snackbert_switched')).toEqual([
    expect.objectContaining({ kind: 'snackbert_switched', details: { on: false } }),
  ])
  expect(events.filter(e => e.kind === 'snackbert_report_sent')).toEqual([])
})

test('when Snackbert is full for the day, the Report is refused with 429, and nothing is recorded', async () => {
  const segre = await snackbertCaller(SEGRE)
  const cooked = await cookedDish(segre)
  const log = await watchEvents()
  snackbert.answer(429)

  const res = await sendReport(segre, cooked.cookingId, formOf(['text', 'Hallo']))

  expect(res.status).toBe(429)
  expect(await reportsKept(cooked.cookingId)).toBe(0)
  expect((await log.recorded()).filter(e => e.kind === 'snackbert_report_sent')).toEqual([])
  snackbert.answer(null)
})

test('when Snackbert fails, the Report is refused with 502, and nothing is recorded', async () => {
  const segre = await snackbertCaller(SEGRE)
  const cooked = await cookedDish(segre)
  const log = await watchEvents()
  snackbert.answer(500)

  const res = await sendReport(segre, cooked.cookingId, formOf(['text', 'Hallo']))

  expect(res.status).toBe(502)
  expect(await reportsKept(cooked.cookingId)).toBe(0)
  expect((await log.recorded()).filter(e => e.kind === 'snackbert_report_sent')).toEqual([])
  snackbert.answer(null)
})

test('when Snackbert doesn\'t answer at all, the Report is refused with 502, and nothing is recorded', async () => {
  const segre = await snackbertCaller(SEGRE)
  const cooked = await cookedDish(segre)
  const log = await watchEvents()
  snackbert.answer('silent')

  const res = await sendReport(segre, cooked.cookingId, formOf(['text', 'Hallo']))

  expect(res.status).toBe(502)
  expect(await reportsKept(cooked.cookingId)).toBe(0)
  expect((await log.recorded()).filter(e => e.kind === 'snackbert_report_sent')).toEqual([])
  snackbert.answer(null)
}, 30_000)

test('a Member sees only their own Reports of a Dish; several Reports of one Cooking are kept', async () => {
  const volta = await snackbertCaller(VOLTA)
  const cooked = await cookedDish(volta, 'Pad Thai')
  expect((await sendReport(volta, cooked.cookingId, formOf(['text', 'Erstes Mal']))).status).toBe(201)
  expect((await sendReport(volta, cooked.cookingId, formOf(['text', 'Zweite Portion']))).status).toBe(201)

  expect(await (await volta.fetch(`/api/dishes/${cooked.dishId}/snackbert`)).json()).toEqual({ on: true, reported: [cooked.cookingId] })

  const fermi = await snackbertCaller(FERMI_LAURA)
  const joined = await fermi.fetch(`/api/invites/${(await landingBoard(volta)).inviteToken}/join`, { method: 'POST' })
  expect(joined.status).toBe(200)
  expect(await (await fermi.fetch(`/api/dishes/${cooked.dishId}/snackbert`)).json()).toEqual({ on: true, reported: [] })

  expect(await reportsKept(cooked.cookingId)).toBe(2)
})

test('undoing the Cooking takes its Reports with it', async () => {
  const volta = await snackbertCaller(VOLTA)
  const cooked = await cookedDish(volta, 'Chili')
  expect((await sendReport(volta, cooked.cookingId, formOf(['text', 'Scharf']))).status).toBe(201)
  expect(await reportsKept(cooked.cookingId)).toBe(1)

  const columns = (await landingBoard(volta)).columns
  const undone = await volta.fetch(`/api/cookings/${cooked.cookingId}/undo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ columnId: columns[0]!.id, index: 0 }),
  })

  expect(undone.status).toBe(200)
  expect(await reportsKept(cooked.cookingId)).toBe(0)
})

test('a sent Report is recorded in the Event Log with its Board, Dish, user and Cooking, and nothing of its content', async () => {
  const golgi = await snackbertCaller(GOLGI)
  const cooked = await cookedDish(golgi, 'Kürbissuppe')
  const { id } = await (await golgi.fetch('/api/me')).json() as { id: string }
  const log = await watchEvents()

  expect((await sendReport(golgi, cooked.cookingId, formOf(['text', 'Geheim, nur für Snackbert']))).status).toBe(201)

  expect((await log.recorded()).filter(e => e.kind === 'snackbert_report_sent')).toEqual([{
    kind: 'snackbert_report_sent',
    boardId: cooked.boardId,
    dishId: cooked.dishId,
    userId: id,
    details: { cooking: cooked.cookingId },
  }])
})
