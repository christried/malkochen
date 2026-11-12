import { spawn, type ChildProcess } from 'node:child_process'
import { appendFileSync } from 'node:fs'
import { testAuthEnv } from '../support/test-auth-env'
import { CRON_SECRET, IMAGE_DIR, SERVER_LOG } from './server-env'
import { TEST_VERSION } from '../support/test-version'

// Boots the built app (`pnpm build` has run) as a production server on a port
// of its own, against the given database, with the test settings
// (testAuthEnv) and whatever `env` changes of them. The API tests' one server
// is started this way by global-setup.ts; a test that needs a server set up
// otherwise (no Anthropic key) starts a second, and stops it when done.

async function waitForServer(url: string, server: ChildProcess) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`API server exited with code ${server.exitCode}`)
    try {
      await fetch(url)
      return
    }
    catch {
      await new Promise(r => setTimeout(r, 200))
    }
  }
  throw new Error(`API server did not start at ${url}`)
}

export interface RunningServer {
  baseUrl: string
  stop: () => Promise<void>
}

export async function startApiServer({ port, databaseUrl, env = {} }: { port: number, databaseUrl: string, env?: Record<string, string> }): Promise<RunningServer> {
  const baseUrl = `http://127.0.0.1:${port}`
  // Node itself, not a shell: on Windows killing a `shell: true` child only
  // kills cmd.exe and leaves the server running, which hangs teardown.
  // NODE_ENV as on Vercel, so what runs in production only runs here too:
  // Better Auth's rate limit.
  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    // stderr is shown as before and kept in SERVER_LOG as well.
    stdio: ['inherit', 'inherit', 'pipe'],
    env: { ...process.env, ...testAuthEnv(baseUrl), IMAGE_DIR, CRON_SECRET, MALKOCHEN_VERSION: TEST_VERSION, NODE_ENV: 'production', DATABASE_URL: databaseUrl, PORT: String(port), HOST: '127.0.0.1', ...env },
  })
  server.stderr!.on('data', (chunk: Buffer) => {
    process.stderr.write(chunk)
    appendFileSync(SERVER_LOG, chunk)
  })
  const stop = async () => {
    server.kill()
    await new Promise(r => server.exitCode !== null ? r(null) : server.once('exit', r))
  }
  try {
    await waitForServer(baseUrl, server)
  }
  catch (err) {
    await stop()
    throw err
  }
  return { baseUrl, stop }
}
