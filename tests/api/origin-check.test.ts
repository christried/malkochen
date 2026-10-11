import { expect, inject, test } from 'vitest'
import { landingBoard } from './boards'
import { ALLOWLISTED, signIn } from './client'

// Writes to /api/** from another origin are refused (#193). SameSite=Lax only
// separates sites, and every *.christried.me subdomain is the same site, so a
// page there could otherwise post to malkochen with the visitor's session.
// Hertha is used by this file only.

interface Board {
  id: string
  inviteToken: string
}

const hertha = () => signIn(ALLOWLISTED[21])

const reset = (headers: Record<string, string>) => async () => {
  const caller = await hertha()
  const board = await landingBoard<Board>(caller)
  const res = await caller.fetch(`/api/boards/${board.id}/invite/reset`, { method: 'POST', headers })
  const after = await landingBoard<Board>(caller)
  return { status: res.status, changed: after.inviteToken !== board.inviteToken }
}

test('a write from a sibling subdomain is refused and changes nothing', async () => {
  const { status, changed } = await reset({ origin: 'https://other.christried.me' })()

  expect(status).toBe(403)
  expect(changed).toBe(false)
})

test('a write without Origin that the browser marks as cross-site is refused', async () => {
  const { status, changed } = await reset({ 'sec-fetch-site': 'same-site' })()

  expect(status).toBe(403)
  expect(changed).toBe(false)
})

test('a write from the app\'s own origin goes through', async () => {
  const { status, changed } = await reset({ 'origin': inject('apiBaseUrl'), 'sec-fetch-site': 'same-origin' })()

  expect(status).toBe(200)
  expect(changed).toBe(true)
})

test('a write marked same-origin without Origin goes through', async () => {
  const { status, changed } = await reset({ 'sec-fetch-site': 'same-origin' })()

  expect(status).toBe(200)
  expect(changed).toBe(true)
})

test('a public write (remembering an invite) from another origin is refused too', async () => {
  const caller = await hertha()
  const board = await landingBoard<Board>(caller)

  const res = await fetch(`${inject('apiBaseUrl')}/api/invites/${board.inviteToken}/remember`, {
    method: 'POST',
    headers: { origin: 'https://other.christried.me' },
  })

  expect(res.status).toBe(403)
  expect(res.headers.getSetCookie()).toEqual([])
})

test('reads from another origin are not refused', async () => {
  const caller = await hertha()

  const res = await caller.fetch('/api/boards', { headers: { origin: 'https://other.christried.me' } })

  expect(res.status).toBe(200)
})
