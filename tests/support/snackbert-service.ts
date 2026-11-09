import { createServer, type IncomingMessage, type Server } from 'node:http'
import { SNACKBERT_PORT, TEST_SNACKBERT_SECRET } from './test-auth-env'

// A stand-in for Snackbert's malkochen function (#423), for the tests of
// Snackbert in Your Settings: the test server, API or browser, asks it
// whether an email address has an account (POST /account-check), with
// SNACKBERT_URL pointed here (test-auth-env.ts). It keeps every request, and
// can be told to answer otherwise. Never Snackbert itself. POST /reports
// (#424) is answered with a placeholder for now.

export interface SnackbertRequest {
  path: string
  authorization: string
  // The parsed JSON of a JSON request, else the raw body.
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

export async function startSnackbertService(): Promise<SnackbertService> {
  const requests: SnackbertRequest[] = []
  const accounts = new Set<string>()
  let answering: number | 'silent' | null = null
  let reports = 0

  const parse = (raw: Buffer, req: IncomingMessage): unknown => {
    if (!String(req.headers['content-type'] ?? '').includes('application/json')) return raw
    try {
      return JSON.parse(raw.toString('utf8')) as unknown
    }
    catch {
      return raw
    }
  }

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks)
      const path = req.url ?? ''
      const authorization = String(req.headers.authorization ?? '')
      requests.push({ path, authorization, body: parse(raw, req) })
      if (answering === 'silent') return
      const send = (status: number, body: unknown) => {
        res.statusCode = status
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(body))
      }
      if (typeof answering === 'number') return send(answering, { error: 'test' })
      if (authorization !== `Bearer ${TEST_SNACKBERT_SECRET}`) return send(401, { error: 'unauthorized' })
      if (req.method === 'POST' && path === '/account-check') {
        const { email } = (requests[requests.length - 1]!.body ?? {}) as { email?: string }
        return send(200, { exists: typeof email === 'string' && accounts.has(email) })
      }
      if (req.method === 'POST' && path === '/reports') return send(201, { mealId: `meal-${++reports}` })
      send(404, { error: 'not_found' })
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
