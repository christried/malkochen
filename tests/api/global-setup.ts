import 'dotenv/config'
import { spawn, spawnSync, type ChildProcess } from 'node:child_process'
import { rm } from 'node:fs/promises'
import type { TestProject } from 'vitest/node'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { testAuthEnv } from '../support/test-auth-env'
import { CRON_SECRET, IMAGE_DIR } from './server-env'

// Seam 1 (the server API): builds the app once, boots the production server
// against a throwaway local Postgres, and hands its base URL to the tests.
// Tests talk to it over HTTP only, exactly like a real client would, except
// to change what no client can: how long ago something happened
// (time-travel.ts).
const PORT = 3199

declare module 'vitest' {
  export interface ProvidedContext {
    apiBaseUrl: string
    databaseUrl: string
  }
}

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

export default async function setup(project: TestProject) {
  const database = await createThrowawayDatabase(readAdminUrl())

  const build = spawnSync('pnpm build', { stdio: 'inherit', shell: true })
  if (build.status !== 0) {
    await database.drop()
    throw new Error('nuxt build failed')
  }

  const baseUrl = `http://127.0.0.1:${PORT}`
  // Node itself, not a shell: on Windows killing a `shell: true` child only
  // kills cmd.exe and leaves the server running, which hangs teardown.
  // NODE_ENV as on Vercel, so what runs in production only runs here too:
  // Better Auth's rate limit.
  // Its images start empty each run, like its database.
  await rm(IMAGE_DIR, { recursive: true, force: true })
  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, ...testAuthEnv(baseUrl), IMAGE_DIR, CRON_SECRET, NODE_ENV: 'production', DATABASE_URL: database.url, PORT: String(PORT), HOST: '127.0.0.1' },
  })
  try {
    await waitForServer(baseUrl, server)
  }
  catch (err) {
    server.kill()
    await database.drop()
    throw err
  }

  project.provide('apiBaseUrl', baseUrl)
  project.provide('databaseUrl', database.url)

  return async () => {
    server.kill()
    await new Promise(r => server.exitCode !== null ? r(null) : server.once('exit', r))
    await database.drop()
  }
}
