import { expect, inject, test } from 'vitest'

test('GET /api/health reports the app up with its database migrated', async () => {
  const res = await fetch(`${inject('apiBaseUrl')}/api/health`)

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ status: 'ok', database: 'ok' })
})
