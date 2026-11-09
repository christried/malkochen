// Snackbert (CONTEXT.md, #423, #424), the Operator's nutrition app, as
// malkochen talks to it: whether an email address has an account there, and
// the Snackbert Reports a Member sends about a Cooking. Pure apart from those
// requests, and no database: who is asked, and what the answer does, is
// server/utils/snackbert.ts and server/utils/snackbert-reports.ts. Snackbert's
// function is in another repo (christried/snackbert).

// A file of a Snackbert Report: its bytes and media type.
export interface SnackbertReportFile {
  bytes: Uint8Array
  type: string
}

// A Snackbert Report as Snackbert's malkochen function takes it (#424). The
// photo and recording are the Member's portion, the dish image the Dish's.
export interface SnackbertReportRequest {
  email: string
  // ISO, from Date#toISOString().
  cookedAt: string
  // The Member's words about it, may be empty.
  text: string
  dish: { title: string, sourceUrl: string | null, platform: string | null, creator: string | null, caption: string | null }
  photo: SnackbertReportFile | null
  recording: SnackbertReportFile | null
  // Sent as its kind says: the Dish's own photo or the Source's post image.
  dishImage: (SnackbertReportFile & { kind: 'post' | 'ownPhoto' }) | null
}

// What Snackbert made of a Report: 'sent'; 'no-account' for the address;
// 'daily-limit' for the day's Reports (Snackbert's own limit); 'failed' for
// anything else, the Report not sent.
export type SnackbertReportAnswer = 'sent' | 'no-account' | 'daily-limit' | 'failed'

export interface SnackbertClient {
  // Whether Snackbert has an account for `email`. Throws when it can't say:
  // a status other than 200, no answer in time, or an answer without
  // `exists`. The error names the status or the error, never the address.
  hasAccount: (email: string) => Promise<boolean>
  // Sends a Snackbert Report (#424) as Snackbert's malkochen function takes
  // it. Never throws. Its log line names the status or error, never the
  // email, text or any content.
  report: (report: SnackbertReportRequest) => Promise<SnackbertReportAnswer>
}

// A file as a Blob for the form: copied, as Blob takes only ArrayBuffer-backed bytes.
const blobOf = ({ bytes, type }: SnackbertReportFile) => new Blob([new Uint8Array(bytes)], { type })

export function createSnackbertClient({ url, secret, timeoutMs = 5000, reportTimeoutMs = 15_000 }: { url: string, secret: string, timeoutMs?: number, reportTimeoutMs?: number }): SnackbertClient {
  // A base address without its trailing slash would drop the last segment
  // of its path when resolving the endpoint against it.
  const endpointOf = (path: string) => new URL(path, url.endsWith('/') ? url : `${url}/`)
  const authorization = `Bearer ${secret}`
  return {
    async hasAccount(email) {
      const res = await fetch(endpointOf('account-check'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': authorization },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(timeoutMs),
      }).catch((err: unknown) => {
        throw new Error(`Snackbert is not reachable (${err instanceof Error ? err.name : 'error'})`)
      })
      if (res.status !== 200) throw new Error(`Snackbert answered ${res.status}`)
      const body = await res.json().catch(() => null) as { exists?: unknown } | null
      if (body?.exists === true) return true
      if (body?.exists === false) return false
      throw new Error('Snackbert answered without exists')
    },

    async report(report) {
      try {
        // fetch sets the multipart boundary itself, so no content-type here.
        const form = new FormData()
        form.append('report', JSON.stringify({
          email: report.email,
          cookedAt: report.cookedAt,
          text: report.text,
          dish: { ...report.dish, imageKind: report.dishImage?.kind ?? null },
        }))
        if (report.photo) form.append('photo', blobOf(report.photo), 'photo.jpg')
        if (report.recording) form.append('recording', blobOf(report.recording), 'recording')
        if (report.dishImage) form.append('dishImage', blobOf(report.dishImage), 'dish-image')

        const res = await fetch(endpointOf('reports'), {
          method: 'POST',
          headers: { authorization },
          body: form,
          signal: AbortSignal.timeout(reportTimeoutMs),
        })
        if (res.status === 201) return 'sent'
        if (res.status === 429) return 'daily-limit'
        if (res.status === 404 && (await res.json().catch(() => null) as { error?: unknown } | null)?.error === 'no_account') return 'no-account'
        console.warn(`[snackbert] report failed: ${res.status}`)
        return 'failed'
      }
      catch (err) {
        console.warn(`[snackbert] report failed: ${err instanceof Error ? err.name : 'error'}`)
        return 'failed'
      }
    },
  }
}

// The client for the env's Snackbert, or null when it is off (either of the
// two variables empty): then no account is ever asked about.
export function snackbertClientFrom(env: { SNACKBERT_URL: string, SNACKBERT_SECRET: string }): SnackbertClient | null {
  if (env.SNACKBERT_URL === '' || env.SNACKBERT_SECRET === '') return null
  return createSnackbertClient({ url: env.SNACKBERT_URL, secret: env.SNACKBERT_SECRET })
}
