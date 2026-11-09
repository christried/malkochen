import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { SNACKBERT_PORT, TEST_SNACKBERT_SECRET } from './test-auth-env'

// A stand-in for Snackbert's malkochen function (#423, #424), for the tests of
// Snackbert in Your Settings and of Snackbert Reports: the test server, API or
// browser, asks it whether an email address has an account (POST
// /account-check), and sends it Reports (POST /reports), with SNACKBERT_URL
// pointed here (test-auth-env.ts). It keeps every request, and can be told to
// answer otherwise. Never Snackbert itself. A Report is answered as Snackbert
// answers one: 404 no_account for an address without an account, else 201.

// A file of a multipart request, as it arrived.
export interface SnackbertFile {
  type: string
  size: number
  bytes: Buffer
}

// A Snackbert Report as it arrived: its `report` JSON and its files by name.
export interface SnackbertSentReport {
  report: {
    email: string
    cookedAt: string
    text: string
    dish: { title: string, sourceUrl: string | null, platform: string | null, creator: string | null, caption: string | null, imageKind: 'post' | 'ownPhoto' | null }
  }
  files: Record<string, SnackbertFile>
}

export interface SnackbertRequest {
  path: string
  authorization: string
  // The parsed JSON of a JSON request, the report and its files of a
  // multipart one (SnackbertSentReport), else the raw body.
  body: unknown
}

export interface SnackbertService {
  // Every request, oldest first, whatever it was answered.
  requests: SnackbertRequest[]
  // The email addresses with a Snackbert account.
  accounts: Set<string>
  // From now on, every request is answered with this status (the body says
  // 'test'). 'silent': never answered at all. null: answered as Snackbert
  // would.
  answer: (next: number | 'silent' | null) => void
  forget: () => void
  close: () => Promise<void>
}

// The parsed request body: the JSON of a JSON request, the report and files
// of a multipart one, else the raw bytes.
async function parse(raw: Buffer, req: IncomingMessage): Promise<unknown> {
  const contentType = String(req.headers['content-type'] ?? '')
  if (contentType.includes('multipart/form-data')) {
    try {
      const form = await new Request('http://snackbert.test/', { method: 'POST', headers: { 'content-type': contentType }, body: new Uint8Array(raw) }).formData()
      const files: Record<string, SnackbertFile> = {}
      for (const [name, value] of form.entries()) {
        if (typeof value === 'string') continue
        files[name] = { type: value.type, size: value.size, bytes: Buffer.from(await value.arrayBuffer()) }
      }
      return { report: JSON.parse(String(form.get('report'))) as unknown, files }
    }
    catch {
      return raw
    }
  }
  if (!contentType.includes('application/json')) return raw
  try {
    return JSON.parse(raw.toString('utf8')) as unknown
  }
  catch {
    return raw
  }
}

export async function startSnackbertService(): Promise<SnackbertService> {
  const requests: SnackbertRequest[] = []
  const accounts = new Set<string>()
  let answering: number | 'silent' | null = null
  let reports = 0

  const respond = async (req: IncomingMessage, res: ServerResponse, raw: Buffer) => {
    const path = req.url ?? ''
    const authorization = String(req.headers.authorization ?? '')
    const body = await parse(raw, req)
    requests.push({ path, authorization, body })
    if (answering === 'silent') return
    const send = (status: number, answer: unknown) => {
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(answer))
    }
    if (typeof answering === 'number') return send(answering, { error: 'test' })
    if (authorization !== `Bearer ${TEST_SNACKBERT_SECRET}`) return send(401, { error: 'unauthorized' })
    if (req.method === 'POST' && path === '/account-check') {
      const { email } = (body ?? {}) as { email?: string }
      return send(200, { exists: typeof email === 'string' && accounts.has(email) })
    }
    if (req.method === 'POST' && path === '/reports') {
      const { email } = (body as SnackbertSentReport).report
      if (!accounts.has(email)) return send(404, { error: 'no_account' })
      return send(201, { mealId: `meal-${++reports}` })
    }
    send(404, { error: 'not_found' })
  }

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      respond(req, res, Buffer.concat(chunks)).catch(() => {
        res.statusCode = 500
        res.end()
      })
    })
  })
  await new Promise<void>(resolve => server.listen(SNACKBERT_PORT, '127.0.0.1', resolve))

  return {
    requests,
    accounts,
    answer: (next) => {
      answering = next
    },
    forget: () => {
      requests.splice(0)
      accounts.clear()
      answering = null
    },
    close: () => new Promise((resolve) => {
      // A 'silent' request hangs until its client gives up; the server must not wait for it.
      server.close(() => resolve())
      server.closeAllConnections()
    }),
  }
}
