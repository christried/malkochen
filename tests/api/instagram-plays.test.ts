import { expect, test } from 'vitest'
import { ALLOWLISTED, anonymous, signIn } from './client'

// The endpoint the Dish detail asks whether Instagram plays a post's video
// in place (#279). What the check finds on Instagram's embed page is covered
// at Seam 2 (tests/source-lookup); here only the wiring, with links that
// never leave the machine.

function playsPath(link: string) {
  return `/api/instagram-plays?${new URLSearchParams({ link })}`
}

test('asking needs a session', async () => {
  const res = await anonymous().fetch(playsPath('https://www.instagram.com/reel/DFvsVH_OD9h/'))

  expect(res.status).toBe(401)
})

test.each([
  ['no link', '/api/instagram-plays'],
  ['not a link', playsPath('Crispy Tofu')],
  ['not a web link', playsPath('javascript:alert(1)')],
])('%s is refused', async (_, path) => {
  const ada = await signIn(ALLOWLISTED[0])

  expect((await ada.fetch(path)).status).toBe(400)
})

test('a link that is no Instagram post is unknown, and the answer may be kept a while', async () => {
  const ada = await signIn(ALLOWLISTED[0])

  const res = await ada.fetch(playsPath('http://127.0.0.1/reel/DFvsVH_OD9h/'))

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ playsInPlace: null })
  expect(res.headers.get('cache-control')).toBe('private, max-age=3600')
})
