import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn } from './client'

// The endpoint the Add Dish flow calls. What Source Lookup finds for each kind
// of link is covered at Seam 2 (tests/source-lookup); here only the wiring,
// with links that never leave the machine.

function lookupPath(link: string) {
  return `/api/source-lookup?${new URLSearchParams({ link })}`
}

test('looking up a link needs a session', async () => {
  const res = await anonymous().fetch(lookupPath('https://www.tiktok.com/@scout2015/video/6718335390845095173'))

  expect(res.status).toBe(401)
})

test.each([
  ['no link', '/api/source-lookup'],
  ['not a link', lookupPath('Crispy Tofu')],
  ['not a web link', lookupPath('javascript:alert(1)')],
])('%s is refused', async (_, path) => {
  const ada = await signIn(ALLOWLISTED[0])

  expect((await ada.fetch(path)).status).toBe(400)
})

test('a link answers with what Source Lookup knows about it, even when that is nothing', async () => {
  const ada = await signIn(ALLOWLISTED[0])

  // A private address: Source Lookup never fetches it, so it knows nothing.
  const res = await ada.fetch(lookupPath('http://127.0.0.1/rezept?utm_source=chat#top'))

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({
    kind: 'other',
    canonicalLink: 'http://127.0.0.1/rezept',
    suggestedTitle: '',
    creator: null,
    caption: null,
    imageUrl: null,
    // Only a found image comes with an Image Ticket.
    imageTicket: null,
  })
})
