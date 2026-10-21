import { createServer, type Server } from 'node:http'
import { RESEND_PORT } from './test-auth-env'

// A stand-in for Resend's API, for the tests of the emails malkochen sends
// (the Email Digest, the sign-in code): the test server, API or browser,
// sends its emails here (RESEND_BASE_URL, test-auth-env.ts), and it keeps
// them. It can be told to refuse them. Never Resend itself.

export interface SentEmail {
  from: string
  to: string[]
  subject: string
  html: string
  text: string
}

export interface ResendService {
  // Every email accepted so far, oldest first.
  sent: SentEmail[]
  // The API key each request came with.
  keys: string[]
  // From now on, requests are answered with this status (200: accepted).
  answer: (status: number) => void
  forget: () => void
  close: () => Promise<void>
}

export async function startResendService(): Promise<ResendService> {
  const sent: SentEmail[] = []
  const keys: string[] = []
  let status = 200
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      keys.push(String(req.headers.authorization ?? ''))
      if (req.method !== 'POST' || req.url !== '/emails/batch') {
        res.statusCode = 404
        res.end()
        return
      }
      const emails = JSON.parse(Buffer.concat(chunks).toString('utf8')) as SentEmail[]
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      if (status === 200) {
        sent.push(...emails)
        res.end(JSON.stringify({ data: emails.map((_, i) => ({ id: `email-${sent.length + i}` })) }))
      }
      else {
        res.end(JSON.stringify({ statusCode: status, name: 'application_error', message: 'Refused by the test' }))
      }
    })
  })
  await new Promise<void>(resolve => server.listen(RESEND_PORT, '127.0.0.1', resolve))
  return {
    sent,
    keys,
    answer: (next) => {
      status = next
    },
    forget: () => {
      sent.splice(0)
      keys.splice(0)
      status = 200
    },
    close: () => new Promise(resolve => server.close(() => resolve())),
  }
}
