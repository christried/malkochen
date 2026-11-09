import { reactive, ref } from 'vue'

// Snackbert Reports on the client (#424): what the Dish History needs to
// know (whether the viewer has Snackbert on, and which Cookings they have
// reported) and sending a Report (POST /api/cookings/:id/snackbert-report).
// Plain Vue reactivity, and the transport is replaced with a fake in the
// tests, so it runs in Node (the "client" Vitest project).

// What `send` answers; it never throws. 'noAccount': Snackbert has no account
// for the user any more (the server has switched him off). 'full': Snackbert
// has had enough for today. 'tooLarge': the server refused the size or type.
export type ReportOutcome = 'sent' | 'noAccount' | 'full' | 'tooLarge' | 'failed'

export interface ReportContent {
  text: string
  photo: Blob | null
  recording: Blob | null
}

export interface DishSnackbert { on: boolean, reported: string[] }

export interface SnackbertTransport {
  // GET /api/dishes/:id/snackbert.
  state: (dishId: string) => Promise<DishSnackbert>
  // POST /api/cookings/:id/snackbert-report; rejects with the HTTP status code
  // ($fetch's statusCode) if refused.
  send: (cookingId: string, body: FormData) => Promise<unknown>
}

const defaultTransport: SnackbertTransport = {
  // The route's typing runs too deep for Nitro here (as in useSnackbert).
  state: (dishId: string) => {
    const path: string = `/api/dishes/${dishId}/snackbert`
    return $fetch<DishSnackbert>(path)
  },
  send: (cookingId: string, body: FormData) => {
    const path: string = `/api/cookings/${cookingId}/snackbert-report`
    return $fetch<unknown>(path, { method: 'POST', body })
  },
}

// The file name a recording is sent under: its extension matches its type,
// which the server checks.
function recordingName(type: string): string {
  if (type.startsWith('audio/webm')) return 'recording.webm'
  if (type.startsWith('audio/mpeg')) return 'recording.mp3'
  if (type.startsWith('audio/wav')) return 'recording.wav'
  return 'recording.m4a'
}

function outcomeOf(error: unknown): ReportOutcome {
  const code = (error as { statusCode?: number, status?: number } | null)?.statusCode ?? (error as { status?: number } | null)?.status
  if (code === 409) return 'noAccount'
  if (code === 429) return 'full'
  if (code === 413 || code === 415) return 'tooLarge'
  return 'failed'
}

export function createSnackbertReports(transport: SnackbertTransport = defaultTransport) {
  // Whether the viewer has Snackbert on, as the server last said.
  const on = ref(false)
  // The Cookings the viewer has reported. A Cooking's id is unique, so one set
  // serves every Dish.
  const reported = reactive(new Set<string>())
  // Counts the loads; only the latest answer counts.
  let latest = 0

  // Asks for a Dish's state; a failed ask changes nothing (no pills then).
  async function load(dishId: string): Promise<void> {
    const run = ++latest
    try {
      const state = await transport.state(dishId)
      if (run !== latest) return
      on.value = state.on
      for (const id of state.reported) reported.add(id)
    }
    catch {
      if (run === latest) on.value = false
    }
  }

  async function send(cookingId: string, content: ReportContent): Promise<ReportOutcome> {
    const body = new FormData()
    const text = content.text.trim()
    if (text) body.append('text', text)
    if (content.photo) body.append('photo', content.photo, 'photo.jpg')
    if (content.recording) body.append('recording', content.recording, recordingName(content.recording.type))
    try {
      await transport.send(cookingId, body)
      reported.add(cookingId)
      return 'sent'
    }
    catch (error) {
      const outcome = outcomeOf(error)
      if (outcome === 'noAccount') on.value = false
      return outcome
    }
  }

  return { on, isReported: (cookingId: string) => reported.has(cookingId), load, send }
}

// The one the sheet and the Dish History share.
let shared: ReturnType<typeof createSnackbertReports> | undefined
export function useSnackbertReports() {
  return shared ??= createSnackbertReports()
}
