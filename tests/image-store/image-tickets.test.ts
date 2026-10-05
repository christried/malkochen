import { expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'

// An Image Ticket proves that Source Lookup found this image for this Member,
// so the save endpoint copies nothing else.

const SECRET = 'test-secret-test-secret-test-secret-0123'
const IMAGE = 'https://p16-sign.tiktokcdn-eu.com/obj/cover.jpeg?x-expires=1700000000'

function ticketsAt(now: { value: number }) {
  return createImageTickets(SECRET, { ttlMs: 60_000, now: () => now.value })
}

test('a ticket is accepted for the Member and image it was issued for', () => {
  const tickets = ticketsAt({ value: 1_000 })

  expect(tickets.check('user-1', IMAGE, tickets.issue('user-1', IMAGE))).toBe(true)
})

test.each([
  ['another Member', 'user-2', IMAGE],
  ['another image', 'user-1', 'https://evil.example/cat.jpg'],
])('a ticket is refused for %s', (_, user, image) => {
  const tickets = ticketsAt({ value: 1_000 })

  expect(tickets.check(user, image, tickets.issue('user-1', IMAGE))).toBe(false)
})

test('a ticket expires', () => {
  const now = { value: 1_000 }
  const tickets = ticketsAt(now)
  const ticket = tickets.issue('user-1', IMAGE)

  now.value += 60_000
  expect(tickets.check('user-1', IMAGE, ticket)).toBe(true)
  now.value += 1
  expect(tickets.check('user-1', IMAGE, ticket)).toBe(false)
})

test('a ticket signed with another secret, or tampered with, is refused', () => {
  const tickets = ticketsAt({ value: 1_000 })
  const foreign = createImageTickets('another-secret-another-secret-0123456789', { ttlMs: 60_000, now: () => 1_000 })
  const ticket = tickets.issue('user-1', IMAGE)
  const [expiry, signature] = ticket.split('.')

  expect(tickets.check('user-1', IMAGE, foreign.issue('user-1', IMAGE))).toBe(false)
  // A later expiry with the old signature.
  expect(tickets.check('user-1', IMAGE, `${Number(expiry) + 1_000_000}.${signature}`)).toBe(false)
  for (const junk of ['', '.', 'abc', `${expiry}.`, `${expiry}.${signature}x`, `x.${signature}`]) {
    expect(tickets.check('user-1', IMAGE, junk)).toBe(false)
  }
})

// "Eigenes Foto" gets its own kind of ticket for the photo it stored, so a
// found image's ticket never passes for a photo, nor the other way round.
test('a ticket of one purpose is refused for another', () => {
  const found = createImageTickets(SECRET)
  const photos = createImageTickets(SECRET, { purpose: 'photo' })

  expect(photos.check('user-1', IMAGE, found.issue('user-1', IMAGE))).toBe(false)
  expect(found.check('user-1', IMAGE, photos.issue('user-1', IMAGE))).toBe(false)
  expect(photos.check('user-1', IMAGE, photos.issue('user-1', IMAGE))).toBe(true)
})
