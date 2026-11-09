import { expect, test } from 'vitest'
import { createSnackbertReports, type DishSnackbert } from '../../app/composables/useSnackbertReports'

// Snackbert Reports on the client (#424): the parts of the request, what each
// answer of the server turns into, and what the Dish History is told. The
// transport is faked, so nothing leaves the test.

const COOKING = '00000000-0000-4000-8000-0000000000c1'
const DISH = '00000000-0000-4000-8000-0000000000d1'

// An error as $fetch throws it for an HTTP status.
const status = (code: number) => Object.assign(new Error(`HTTP ${code}`), { statusCode: code })

function setup(answer: () => Promise<unknown> = async () => ({ reported: true }), state: DishSnackbert = { on: true, reported: [] }) {
  const sent: { cookingId: string, body: FormData }[] = []
  const reports = createSnackbertReports({
    state: async () => state,
    send: async (cookingId, body) => {
      sent.push({ cookingId, body })
      return answer()
    },
  })
  return { reports, sent }
}

const none = { text: '', photo: null, recording: null }

test('the text, the photo as photo.jpg and the recording under a name that fits its type are sent', async () => {
  const { reports, sent } = setup()
  const photo = new Blob(['jpeg'], { type: 'image/jpeg' })
  const recording = new Blob(['aac'], { type: 'audio/mp4;codecs=mp4a.40.2' })

  expect(await reports.send(COOKING, { text: '  eine halbe Portion  ', photo, recording })).toBe('sent')

  expect(sent).toHaveLength(1)
  expect(sent[0]!.cookingId).toBe(COOKING)
  const body = sent[0]!.body
  expect(body.get('text')).toBe('eine halbe Portion')
  expect((body.get('photo') as File).name).toBe('photo.jpg')
  expect((body.get('photo') as File).type).toBe('image/jpeg')
  expect((body.get('recording') as File).name).toBe('recording.m4a')
  expect((body.get('recording') as File).type).toBe('audio/mp4;codecs=mp4a.40.2')
})

test('a WebM recording is sent as .webm', async () => {
  const { reports, sent } = setup()
  await reports.send(COOKING, { ...none, recording: new Blob(['opus'], { type: 'audio/webm;codecs=opus' }) })
  expect((sent[0]!.body.get('recording') as File).name).toBe('recording.webm')
})

test('with nothing added, or only blanks, no part is sent at all', async () => {
  const { reports, sent } = setup()
  expect(await reports.send(COOKING, { ...none, text: '   \n ' })).toBe('sent')
  expect([...sent[0]!.body.keys()]).toEqual([])
})

test.each([
  [201, 'sent'],
  [409, 'noAccount'],
  [429, 'full'],
  [413, 'tooLarge'],
  [415, 'tooLarge'],
  [502, 'failed'],
  [500, 'failed'],
  [404, 'failed'],
] as const)('an answer of %i is %s', async (code, outcome) => {
  const { reports } = setup(async () => {
    if (code !== 201) throw status(code)
    return { reported: true }
  })
  expect(await reports.send(COOKING, none)).toBe(outcome)
})

test('a network error is a failure, not a thrown error', async () => {
  const { reports } = setup(async () => {
    throw new TypeError('Failed to fetch')
  })
  expect(await reports.send(COOKING, none)).toBe('failed')
})

test('the server says what was reported before; after a sent Report the Cooking counts as reported', async () => {
  const earlier = '00000000-0000-4000-8000-0000000000c0'
  const { reports } = setup(undefined, { on: true, reported: [earlier] })
  expect(reports.on.value).toBe(false)

  await reports.load(DISH)
  expect(reports.on.value).toBe(true)
  expect(reports.isReported(earlier)).toBe(true)
  expect(reports.isReported(COOKING)).toBe(false)

  await reports.send(COOKING, none)
  expect(reports.isReported(COOKING)).toBe(true)
})

test('a refused or failed Report leaves the Cooking unreported', async () => {
  const { reports } = setup(async () => {
    throw status(502)
  })
  await reports.send(COOKING, none)
  expect(reports.isReported(COOKING)).toBe(false)
})

test('Snackbert is off after an answer of 409: the server has switched him off', async () => {
  const { reports } = setup(async () => {
    throw status(409)
  })
  await reports.load(DISH)
  expect(reports.on.value).toBe(true)

  expect(await reports.send(COOKING, none)).toBe('noAccount')
  expect(reports.on.value).toBe(false)
})

test('when the state cannot be loaded, Snackbert counts as off', async () => {
  const reports = createSnackbertReports({
    state: async () => {
      throw status(500)
    },
    send: async () => ({}),
  })
  await reports.load(DISH)
  expect(reports.on.value).toBe(false)
})
