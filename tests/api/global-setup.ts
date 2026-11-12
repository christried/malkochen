import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { TestProject } from 'vitest/node'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'
import { IMAGE_DIR, SERVER_LOG } from './server-env'
import { startApiServer } from './server-boot'

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

export default async function setup(project: TestProject) {
  const database = await createThrowawayDatabase(readAdminUrl())

  const build = spawnSync('pnpm build', { stdio: 'inherit', shell: true })
  if (build.status !== 0) {
    await database.drop()
    throw new Error('nuxt build failed')
  }

  // Its images start empty each run, like its database.
  await rm(IMAGE_DIR, { recursive: true, force: true })
  await mkdir(dirname(SERVER_LOG), { recursive: true })
  await writeFile(SERVER_LOG, '')

  let server
  try {
    server = await startApiServer({ port: PORT, databaseUrl: database.url })
  }
  catch (err) {
    await database.drop()
    throw err
  }

  project.provide('apiBaseUrl', server.baseUrl)
  project.provide('databaseUrl', database.url)

  return async () => {
    await server.stop()
    await database.drop()
  }
}
