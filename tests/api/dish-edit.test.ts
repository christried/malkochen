import { expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'
import { testAuthEnv } from '../support/test-auth-env'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Editing a Dish from its detail (PRD stories 43–45): PATCH /api/dishes/:id
// changes only the fields it is sent.

interface Dish {
  id: string
  title: string
  note: string | null
  placeholder: string
  imageUrl: string | null
  source: { link: string, kind: string } | null
  creator: string | null
}
interface Board {
  id: string
  columns: { dishes: Dish[] }[]
}

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function addDish(caller: Caller, body: Record<string, unknown>): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title: 'Dal', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  // Without where it was placed, as the Board shows it.
  const { placement: _, ...dish } = await res.json() as Dish & { placement: unknown }
  return dish
}

function editDish(caller: Caller, dishId: string, body: unknown) {
  return caller.fetch(`/api/dishes/${dishId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// The Dish as the Board shows it now.
async function onBoard(caller: Caller, dishId: string): Promise<Dish | undefined> {
  return (await landingBoard(caller)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)
}

test('a Member can change a Dish’s title and note', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { title: 'Dal', note: 'mit Kokosmilch' })

  const res = await editDish(ada, dish.id, { title: '  Rote Linsen Dal ', note: 'mit Spinat' })

  expect(res.status).toBe(200)
  const edited = await res.json()
  expect(edited).toMatchObject({ id: dish.id, title: 'Rote Linsen Dal', note: 'mit Spinat', placeholder: 'bowl' })
  expect(await onBoard(ada, dish.id)).toEqual(edited)
})

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const SHORT = 'https://www.youtube.com/shorts/editDal0001'

test('changing the Source stores its canonical link and kind, and leaves the image as it is', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { placeholder: 'ramen', source: { link: TIKTOK } })

  const res = await editDish(ada, dish.id, { source: { link: `${SHORT}?feature=share` } })

  expect(res.status).toBe(200)
  const edited = await res.json()
  expect(edited).toMatchObject({ source: { link: SHORT, kind: 'youtube-short' }, placeholder: 'ramen', imageUrl: null, title: 'Dal' })
  expect(await onBoard(ada, dish.id)).toEqual(edited)
})

test('a Source can be removed, and a web page may stay a blog', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const blog = 'https://www.chefkoch.de/rezepte/123/dal.html'
  const dish = await addDish(ada, { source: { link: TIKTOK } })

  expect(await (await editDish(ada, dish.id, { source: { link: blog, kind: 'blog' } })).json())
    .toMatchObject({ source: { link: blog, kind: 'blog' } })
  expect(await (await editDish(ada, dish.id, { source: { link: TIKTOK, kind: 'blog' } })).json())
    .toMatchObject({ source: { link: TIKTOK, kind: 'tiktok' } })
  expect(await (await editDish(ada, dish.id, { source: null })).json()).toMatchObject({ source: null })
  expect((await onBoard(ada, dish.id))?.source).toBeNull()
})

test('a Member can change and clear the Creator, and nothing else changes with it', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { note: 'scharf', source: { link: TIKTOK }, creator: 'Scout, Suki & Stella' })

  const changed = await (await editDish(ada, dish.id, { creator: ' @veganschnitzel ' })).json()
  expect(changed).toEqual({ ...dish, creator: '@veganschnitzel' })
  expect(await onBoard(ada, dish.id)).toEqual(changed)

  const cleared = await (await editDish(ada, dish.id, { creator: '' })).json()
  expect(cleared).toEqual({ ...dish, creator: null })
  expect(await onBoard(ada, dish.id)).toEqual(cleared)
})

test('editing other fields leaves the Creator as it is', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { source: { link: TIKTOK }, creator: 'Scout, Suki & Stella' })

  const edited = await (await editDish(ada, dish.id, { title: 'Linsen-Dal', source: { link: SHORT } })).json()

  expect(edited.creator).toBe('Scout, Suki & Stella')
})

test('choosing a Placeholder Image changes only the image', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { note: 'scharf', placeholder: 'bowl', source: { link: TIKTOK } })

  const edited = await (await editDish(ada, dish.id, { placeholder: 'bread', imageUrl: null })).json()

  expect(edited).toEqual({ ...dish, placeholder: 'bread', imageUrl: null })
  expect(await onBoard(ada, dish.id)).toEqual(edited)
})

// Tickets as GET /api/source-lookup issues them (same secret as the server).
const tickets = createImageTickets(testAuthEnv('').BETTER_AUTH_SECRET!)
const me = async (caller: Caller) => ((await (await caller.fetch('/api/me')).json()) as { id: string }).id

// "Bild neu laden": the image Source Lookup found again, with its Image
// Ticket. A private address is never fetched, so here the copy always fails
// and the Dish keeps the image it had, saying so; a stored copy (and keeping
// one) is covered by the Image Store tests and the browser tests.
test('a reloaded image that cannot be stored leaves the image as it was, and says so', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { placeholder: 'wok', source: { link: TIKTOK } })
  const imageUrl = 'http://127.0.0.1/reloaded.jpeg'

  const res = await editDish(ada, dish.id, { imageUrl, imageTicket: tickets.issue(await me(ada), imageUrl) })

  expect(res.status).toBe(200)
  const edited = await res.json()
  expect(edited).toMatchObject({ imageUrl: null, placeholder: 'wok', imageNotStored: true })
  expect(await onBoard(ada, dish.id)).toEqual({ ...edited, imageNotStored: undefined })
})

test.each([
  ['no Image Ticket', () => undefined],
  ['a forged Image Ticket', () => `${Date.now() + 60_000}.AAAA`],
  ['another Member’s Image Ticket', () => tickets.issue('someone-else', 'https://cdn.example/cover.jpg')],
])('a reloaded image with %s is not copied', async (_, ticket) => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { placeholder: 'wok', source: { link: TIKTOK } })

  const res = await editDish(ada, dish.id, { imageUrl: 'https://cdn.example/cover.jpg', imageTicket: ticket() })

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ imageUrl: null, placeholder: 'wok', imageNotStored: true })
})

test('only Members of its Board can edit a Dish, and a missing Dish looks the same', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { title: 'Adas Dal' })
  const linus = await signIn(ALLOWLISTED[2])

  expect((await editDish(linus, dish.id, { title: 'Eindringling' })).status).toBe(404)
  expect((await editDish(linus, dish.id, { imageUrl: 'https://cdn.example/x.jpg', imageTicket: 'x' })).status).toBe(404)
  expect((await editDish(ada, '00000000-0000-4000-8000-000000000000', { title: 'Nichts' })).status).toBe(404)
  expect((await editDish(ada, 'not-a-dish', { title: 'Nichts' })).status).toBe(404)
  expect((await onBoard(ada, dish.id))?.title).toBe('Adas Dal')
})

test.each([
  ['a blank title', { title: '   ' }],
  ['no title at all', { title: null }],
  ['an unknown Placeholder Image', { placeholder: 'not-a-placeholder' }],
  ['a Source that is not a web link', { source: { link: 'javascript:alert(1)' } }],
  ['an image that is not a web link', { imageUrl: 'data:image/png;base64,AAAA' }],
])('%s is refused', async (_, changes) => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, {})

  expect((await editDish(ada, dish.id, changes)).status).toBe(400)
  expect(await onBoard(ada, dish.id)).toEqual(dish)
})
