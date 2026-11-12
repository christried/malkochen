import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { ANTHROPIC_PORT } from './test-auth-env'

// A stand-in for Anthropic's Messages API (#501), for the tests of the Recipe
// Finder reading a Caption: the test server asks it (POST /v1/messages), with
// ANTHROPIC_BASE_URL pointed here (test-auth-env.ts). It keeps every request,
// and can be told how to answer from now on. Never Anthropic itself. Without
// being told, it answers that the text holds no recipe.

// The lines of a recipe, as the model answers them.
export interface AnthropicRecipe {
  ingredients: string[]
  steps: string[]
}

export interface AnthropicRequest {
  // The API key the request carried (in `x-api-key` or as a bearer token).
  apiKey: string
  // The parsed JSON body, as the SDK sent it.
  body: Record<string, unknown>
}

// How the stand-in answers: with a recipe; 'empty' (both lists empty, the
// default); 'refusal' (the model declined: no content); 'malformed' (text that
// is no JSON); 'dropped' (the connection is cut without an answer, which
// fails at once where a hang would hold a test for the client's timeout); or
// an HTTP status, answered with Anthropic's error body.
export type AnthropicAnswer = AnthropicRecipe | 'empty' | 'refusal' | 'malformed' | 'dropped' | number

export interface AnthropicService {
  // Every request, oldest first, whatever it was answered.
  requests: AnthropicRequest[]
  // From now on, every request is answered like this.
  answer: (next: AnthropicAnswer) => void
  forget: () => void
  close: () => Promise<void>
}

function message(model: unknown, content: unknown[], stopReason: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  }
}

export async function startAnthropicService(): Promise<AnthropicService> {
  const requests: AnthropicRequest[] = []
  let answering: AnthropicAnswer = 'empty'

  const respond = (req: IncomingMessage, res: ServerResponse, raw: Buffer) => {
    let body: Record<string, unknown> = {}
    try {
      body = JSON.parse(raw.toString('utf8')) as Record<string, unknown>
    }
    catch {
      // Kept as an empty body: the test sees what the SDK sent was no JSON.
    }
    // This SDK sends the key as a bearer token; the API takes `x-api-key` too.
    const apiKey = String(req.headers['x-api-key'] ?? '') || String(req.headers.authorization ?? '').replace(/^Bearer /, '')
    requests.push({ apiKey, body })

    if (answering === 'dropped') {
      req.socket.destroy()
      return
    }
    const send = (status: number, answer: unknown) => {
      res.statusCode = status
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(answer))
    }
    if (typeof answering === 'number') return send(answering, { type: 'error', error: { type: 'api_error', message: 'test' } })
    if (req.method !== 'POST' || req.url !== '/v1/messages') return send(404, { type: 'error', error: { type: 'not_found_error', message: 'test' } })
    if (answering === 'refusal') return send(200, message(body.model, [], 'refusal'))
    if (answering === 'malformed') return send(200, message(body.model, [{ type: 'text', text: 'Hier ist das Rezept: [Linsen' }], 'end_turn'))
    const recipe = answering === 'empty' ? { ingredients: [], steps: [] } : answering
    send(200, message(body.model, [{ type: 'text', text: JSON.stringify(recipe) }], 'end_turn'))
  }

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        respond(req, res, Buffer.concat(chunks))
      }
      catch {
        res.statusCode = 500
        res.end()
      }
    })
  })
  await new Promise<void>(resolve => server.listen(ANTHROPIC_PORT, '127.0.0.1', resolve))

  return {
    requests,
    answer: (next) => {
      answering = next
    },
    forget: () => {
      requests.splice(0)
      answering = 'empty'
    },
    close: () => new Promise((resolve) => {
      server.close(() => resolve())
      server.closeAllConnections()
    }),
  }
}
