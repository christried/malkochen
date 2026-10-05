import { expect, test } from 'vitest'
import { usePhotoUpload, type UploadedPhoto } from '../../app/composables/usePhotoUpload'

// Seam 4: "Eigenes Foto" on the client. A picked file goes to the Board's
// photo upload (faked here); the tests look at what comes back, what was
// sent, and the problem the Member is told about.

const BOARD_PHOTOS = '/api/boards/00000000-0000-4000-8000-000000000001/photos'

// A file of `size` bytes; only its size and type matter here.
const file = (size: number, type = 'image/jpeg') => new Blob([new Uint8Array(size)], { type })

// An error as $fetch throws it for an HTTP status.
const status = (code: number) => Object.assign(new Error(`HTTP ${code}`), { statusCode: code })

function setup(answer: (body: Blob) => Promise<UploadedPhoto>, shrink: (file: Blob) => Promise<Blob | null> = async () => null) {
  const sent: { to: string, body: Blob }[] = []
  const upload = usePhotoUpload(async (to, body) => {
    sent.push({ to, body })
    return answer(body)
  }, shrink)
  return { upload, sent }
}

const STORED: UploadedPhoto = { url: '/images/dishes/foto.jpg', ticket: 'ticket' }

test('a picked photo is uploaded to the Board and where it was stored comes back', async () => {
  const { upload, sent } = setup(async () => STORED)
  const photo = file(1000)

  const pending = upload.upload(BOARD_PHOTOS, photo)
  expect(upload.uploading.value).toBe(true)

  expect(await pending).toEqual(STORED)
  expect(sent).toEqual([{ to: BOARD_PHOTOS, body: photo }])
  expect(upload.uploading.value).toBe(false)
  expect(upload.problem.value).toBeNull()
})

// The host refuses request bodies above ~4.5 MB.
test('a file too large to send that the browser can’t shrink (HEIC, or no image) is refused as too large without uploading it', async () => {
  const { upload, sent } = setup(async () => STORED, async () => null)

  expect(await upload.upload(BOARD_PHOTOS, file(6_000_000, 'image/heic'))).toBeNull()
  expect(upload.problem.value).toBe('too-large')
  expect(sent).toEqual([])
})

test('a file larger than the browser should even try to read is refused as too large', async () => {
  const shrinks: Blob[] = []
  const { upload, sent } = setup(async () => STORED, async (f) => {
    shrinks.push(f)
    return file(10)
  })

  expect(await upload.upload(BOARD_PHOTOS, file(40_000_001))).toBeNull()
  expect(upload.problem.value).toBe('too-large')
  expect([shrinks, sent]).toEqual([[], []])
})

test.each([
  [415, 'not-an-image'],
  [413, 'too-large'],
  [500, 'failed'],
  [undefined, 'failed'],
] as const)('a refusal with status %s tells the Member "%s"', async (code, problem) => {
  const { upload } = setup(async () => {
    throw code ? status(code) : new Error('offline')
  })

  expect(await upload.upload(BOARD_PHOTOS, file(1000))).toBeNull()
  expect(upload.problem.value).toBe(problem)
  expect(upload.uploading.value).toBe(false)
})

test('a new pick clears the last problem', async () => {
  const { upload } = setup(async () => STORED)
  await upload.upload(BOARD_PHOTOS, file(1000, 'text/plain'))
  await upload.upload(BOARD_PHOTOS, file(50_000_000))
  expect(upload.problem.value).toBe('too-large')

  await upload.upload(BOARD_PHOTOS, file(1000))

  expect(upload.problem.value).toBeNull()
})

// So a large photo is made smaller in the browser first, even one over the
// server's own limit (a 50 MP phone photo); the server still checks and
// scales it.
test.each([6_000_000, 25_000_000])('a %i byte photo is sent shrunk', async (size) => {
  const small = file(500)
  const { upload, sent } = setup(async () => STORED, async () => small)

  expect(await upload.upload(BOARD_PHOTOS, file(size))).toEqual(STORED)
  expect(sent[0]!.body).toBe(small)
})

test('a photo small enough is sent untouched, metadata and all, for the server to clean', async () => {
  const shrinks: Blob[] = []
  const photo = file(3_000_000)
  const { upload, sent } = setup(async () => STORED, async (f) => {
    shrinks.push(f)
    return file(10)
  })

  await upload.upload(BOARD_PHOTOS, photo)

  expect(shrinks).toEqual([])
  expect(sent[0]!.body).toBe(photo)
})

test('only the latest pick counts', async () => {
  const answers: ((photo: UploadedPhoto) => void)[] = []
  const { upload } = setup(() => new Promise(resolve => answers.push(resolve)))

  const first = upload.upload(BOARD_PHOTOS, file(1000))
  const second = upload.upload(BOARD_PHOTOS, file(2000))
  answers[1]!({ url: '/images/dishes/zweites.jpg', ticket: 't2' })
  answers[0]!(STORED)

  expect(await second).toEqual({ url: '/images/dishes/zweites.jpg', ticket: 't2' })
  expect(await first).toBeNull()
  expect(upload.uploading.value).toBe(false)
})
