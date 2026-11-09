// What a Snackbert Report (CONTEXT.md, #424) may send along with the Cooking:
// the Member's words, a photo of their portion and a recording, checked here
// before anything is sent on. Pure: the route reads the multipart form and
// answers what this says (server/api/cookings/[id]/snackbert-report.post.ts).
// None of it is ever stored or logged by malkochen.

// A request larger than this is refused before it is read (Vercel's body
// cap is 4.5 MB, and the parts together come to less than this).
export const SNACKBERT_REPORT_MAX_BYTES = 4_400_000
// The Member's words, in characters (code points).
export const REPORT_TEXT_MAX_CHARS = 1000
// The client shrinks a photo to about 1000 px, so it is far below this.
export const REPORT_PHOTO_MAX_BYTES = 1_500_000
export const REPORT_RECORDING_MAX_BYTES = 2_500_000
// Snackbert takes these recording types, and no others.
export const REPORT_RECORDING_TYPES = ['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/webm', 'audio/mpeg', 'audio/wav'] as const
// The Dish's image, sent along when there is one (routes read it from the
// Image Store): the same image types as an Own Photo or Source image.
export const REPORT_DISH_IMAGE_MAX_BYTES = 5_000_000
export const REPORT_DISH_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// A part of the multipart form, as h3 reads it.
export interface ReportPart {
  name?: string
  filename?: string
  type?: string
  data: Uint8Array
}

// What the Member sent with the Report, checked.
export interface ReportInput {
  text: string
  photo: { bytes: Uint8Array, type: 'image/jpeg' } | null
  recording: { bytes: Uint8Array, type: (typeof REPORT_RECORDING_TYPES)[number] } | null
}

// Why the form was refused: the status and a short message for the answer.
export interface ReportRefusal {
  status: 400 | 413 | 415
  message: string
}

const refuse = (status: ReportRefusal['status'], message: string): ReportRefusal => ({ status, message })

const startsWith = (bytes: Uint8Array, signature: readonly number[], at = 0) =>
  signature.every((byte, i) => bytes[at + i] === byte)

const asciiAt = (bytes: Uint8Array, text: string, at: number) =>
  startsWith(bytes, [...text].map(c => c.charCodeAt(0)), at)

// The first bytes of a JPEG: FF D8 FF.
export function isJpeg(bytes: Uint8Array): boolean {
  return startsWith(bytes, [0xFF, 0xD8, 0xFF])
}

// Whether the bytes are of the recording type they are said to be (checked
// by the first bytes, never by the name or the type the part claims alone).
export function matchesRecordingType(bytes: Uint8Array, type: (typeof REPORT_RECORDING_TYPES)[number]): boolean {
  switch (type) {
    case 'audio/webm':
      return startsWith(bytes, [0x1A, 0x45, 0xDF, 0xA3])
    case 'audio/mp4':
    case 'audio/m4a':
    case 'audio/x-m4a':
      return asciiAt(bytes, 'ftyp', 4)
    case 'audio/mpeg':
      // An ID3 tag, or an MPEG frame: FF, then a byte whose top three bits are set.
      return asciiAt(bytes, 'ID3', 0) || (bytes[0] === 0xFF && (bytes[1] ?? 0) >= 0xE0)
    case 'audio/wav':
      return asciiAt(bytes, 'RIFF', 0) && asciiAt(bytes, 'WAVE', 8)
  }
}

// The media type of a part, lowercased and without parameters
// (`audio/webm;codecs=opus` is `audio/webm`).
function mediaTypeOf(type: string | undefined): string {
  return (type ?? '').split(';')[0]!.trim().toLowerCase()
}

const isRecordingType = (type: string): type is (typeof REPORT_RECORDING_TYPES)[number] =>
  (REPORT_RECORDING_TYPES as readonly string[]).includes(type)

// The parts of a Report's multipart form, checked: `text` (a field, no file),
// `photo` and `recording` (files), each at most once. Answers the input, or
// why it is refused (ReportRefusal).
export function parseReportParts(parts: ReportPart[]): ReportInput | ReportRefusal {
  const seen = new Set<string>()
  let text = ''
  let photo: ReportInput['photo'] = null
  let recording: ReportInput['recording'] = null

  for (const part of parts) {
    const name = part.name ?? ''
    if (!['text', 'photo', 'recording'].includes(name)) return refuse(400, 'Unknown part of the Report')
    if (seen.has(name)) return refuse(400, `The Report has more than one ${name}`)
    seen.add(name)
    const isFile = part.filename !== undefined
    if (name === 'text') {
      if (isFile) return refuse(400, 'The text of the Report is a field, not a file')
      try {
        text = new TextDecoder('utf-8', { fatal: true }).decode(part.data).trim()
      }
      catch {
        return refuse(400, 'The text of the Report is not UTF-8')
      }
      if ([...text].length > REPORT_TEXT_MAX_CHARS) return refuse(413, `The text is longer than ${REPORT_TEXT_MAX_CHARS} characters`)
      continue
    }
    if (!isFile || part.data.length === 0) return refuse(400, `The ${name} of the Report is missing or empty`)

    if (name === 'photo') {
      if (part.data.length > REPORT_PHOTO_MAX_BYTES) return refuse(413, 'The photo is too large')
      if (!isJpeg(part.data)) return refuse(415, 'The photo is not a JPEG')
      photo = { bytes: part.data, type: 'image/jpeg' }
      continue
    }

    if (part.data.length > REPORT_RECORDING_MAX_BYTES) return refuse(413, 'The recording is too large')
    const type = mediaTypeOf(part.type)
    if (!isRecordingType(type) || !matchesRecordingType(part.data, type)) return refuse(415, 'The recording is not an audio type Snackbert takes')
    recording = { bytes: part.data, type }
  }

  return { text, photo, recording }
}

// Whether the input is a Report's refusal (parseReportParts).
export function isRefusal(result: ReportInput | ReportRefusal): result is ReportRefusal {
  return 'status' in result
}
