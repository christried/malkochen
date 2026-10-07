import { expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'
import { testAuthEnv } from '../support/test-auth-env'
import { landingBoard as landingBoardOf, postDish as addDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

interface Dish {
  id: string
  title: string
  note: string | null
  placeholder: string
  imageUrl: string | null
  source: { link: string, kind: string } | null
  creator: string | null
  addedBy: { name: string, image: string | null } | null
}
interface Board {
  id: string
  columns: { id: string, name: string, dishes: Dish[] }[]
}
// What adding a Dish answers: the Dish, and where it was placed.
type Placed = Dish & { placement: { boardId: string, columnId: string, index: number } }

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

const titles = (board: Board, column = 0) => board.columns[column]!.dishes.map(d => d.title)

test('a Dish added without a Source lands at the top of the first Column', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const res = await addDish(ada, board.id, { title: '  Omas Linsensuppe ', note: 'mit Räuchertofu und Frühlingszwiebeln', placeholder: 'eintopf' })

  expect(res.status).toBe(201)
  const { placement, ...created } = await res.json() as Placed
  expect(created).toMatchObject({ title: 'Omas Linsensuppe', note: 'mit Räuchertofu und Frühlingszwiebeln', placeholder: 'eintopf', imageUrl: null, source: null })

  const after = await landingBoard(ada)
  expect(after.columns[0]!.dishes[0]).toEqual(created)
  expect(placement).toEqual({ boardId: board.id, columnId: after.columns[0]!.id, index: 0 })
  expect(created.addedBy).toMatchObject({ name: expect.any(String) })
  expect(after.columns.slice(1).flatMap(c => c.dishes)).toEqual([])
})

test('the newest Dish goes on top and the others keep their order', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  for (const title of ['Dal', 'Pad Thai', 'Chana Masala']) {
    expect((await addDish(grace, board.id, { title, placeholder: 'bowl' })).status).toBe(201)
  }

  expect(titles(await landingBoard(grace)).slice(0, 3)).toEqual(['Chana Masala', 'Pad Thai', 'Dal'])
})

test('the note is optional, and a blank note is no note', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  const without = await (await addDish(grace, board.id, { title: 'Porridge', placeholder: 'breakfast' })).json()
  const blank = await (await addDish(grace, board.id, { title: 'Brot', note: '   ', placeholder: 'bread' })).json()

  expect(without.note).toBeNull()
  expect(blank.note).toBeNull()
})

test('a Dish keeps the Creator it was added with; without one, or a blank one, it has none', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  const withCreator = await (await addDish(grace, board.id, { title: 'Brownies', placeholder: 'bread', creator: '  Love and Lemons ' })).json() as Placed
  const without = await (await addDish(grace, board.id, { title: 'Porridge', placeholder: 'breakfast' })).json() as Placed
  const blank = await (await addDish(grace, board.id, { title: 'Brot', placeholder: 'bread', creator: '  ' })).json() as Placed

  expect(withCreator.creator).toBe('Love and Lemons')
  expect(without.creator).toBeNull()
  expect(blank.creator).toBeNull()
  const shown = (await landingBoard(grace)).columns[0]!.dishes
  expect(shown.find(d => d.id === withCreator.id)?.creator).toBe('Love and Lemons')
})

test('a Creator longer than 100 characters is refused', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  expect((await addDish(grace, board.id, { title: 'Dal', placeholder: 'bowl', creator: 'x'.repeat(101) })).status).toBe(400)
})

test('a Dish needs a title and a known Placeholder Image', async () => {
  const linus = await signIn(ALLOWLISTED[2])
  const board = await landingBoard(linus)

  expect((await addDish(linus, board.id, { placeholder: 'pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: '   ', placeholder: 'pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: 'Pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: 'Pasta', placeholder: 'not-a-placeholder' })).status).toBe(400)

  expect((await landingBoard(linus)).columns.flatMap(c => c.dishes)).toEqual([])
})

test('only Members can add Dishes to a Board', async () => {
  const adasBoard = await landingBoard(await signIn(ALLOWLISTED[0]))
  const linus = await signIn(ALLOWLISTED[2])

  expect((await addDish(linus, adasBoard.id, { title: 'Eindringling', placeholder: 'bread' })).status).toBe(404)
  expect(titles(await landingBoard(await signIn(ALLOWLISTED[0])))).not.toContain('Eindringling')
})

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'

test('a Dish from a link keeps its Source: the canonical link and its kind', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const res = await addDish(ada, board.id, {
    title: 'Crispy Tofu',
    placeholder: 'wok',
    source: { link: `${TIKTOK}?is_from_webapp=1&utm_source=copy` },
  })

  expect(res.status).toBe(201)
  const { placement: _, ...created } = await res.json() as Placed
  expect(created.source).toEqual({ link: TIKTOK, kind: 'tiktok' })
  // No image was asked for, so none failed to be stored.
  expect(created).not.toHaveProperty('imageNotStored')
  expect((await landingBoard(ada)).columns[0]!.dishes[0]).toEqual(created)
})

test('the Source kind comes from the link, except that a web page may be a blog', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const sourceOf = async (source: unknown) =>
    ((await (await addDish(ada, board.id, { title: 'Dal', placeholder: 'bowl', source })).json()) as Dish).source

  expect(await sourceOf({ link: TIKTOK, kind: 'pinterest-pin' })).toEqual({ link: TIKTOK, kind: 'tiktok' })
  expect(await sourceOf({ link: TIKTOK, kind: 'blog' })).toEqual({ link: TIKTOK, kind: 'tiktok' })
  expect(await sourceOf({ link: 'https://www.chefkoch.de/rezepte/123/dal.html', kind: 'blog' }))
    .toEqual({ link: 'https://www.chefkoch.de/rezepte/123/dal.html', kind: 'blog' })
  expect(await sourceOf({ link: 'https://www.chefkoch.de/rezepte/123/dal.html' }))
    .toEqual({ link: 'https://www.chefkoch.de/rezepte/123/dal.html', kind: 'other' })
})

// Tickets as GET /api/source-lookup issues them (same secret as the server).
const tickets = createImageTickets(testAuthEnv('').BETTER_AUTH_SECRET!)
const me = async (caller: Caller) => ((await (await caller.fetch('/api/me')).json()) as { id: string }).id

test('if the image cannot be copied, the Dish is saved with its Placeholder Image, and says so', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  // A private address: the Image Store never fetches it, so the copy fails.
  const imageUrl = 'http://127.0.0.1/cover.jpeg'

  const res = await addDish(ada, board.id, {
    title: 'Ramen',
    placeholder: 'ramen',
    source: { link: TIKTOK },
    imageUrl,
    imageTicket: tickets.issue(await me(ada), imageUrl),
  })

  expect(res.status).toBe(201)
  const { placement: _, imageNotStored, ...created } = await res.json() as Placed & { imageNotStored?: true }
  expect(imageNotStored).toBe(true)
  expect(created).toMatchObject({ title: 'Ramen', placeholder: 'ramen', imageUrl: null, source: { kind: 'tiktok' } })
  expect((await landingBoard(ada)).columns[0]!.dishes[0]).toEqual(created)
})

test.each([
  ['no Image Ticket', () => undefined],
  ['a forged Image Ticket', () => `${Date.now() + 60_000}.AAAA`],
  ['another Member’s Image Ticket', () => tickets.issue('someone-else', 'https://cdn.example/cover.jpg')],
])('an image with %s is not copied', async (_, ticket) => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const res = await addDish(ada, board.id, {
    title: 'Pho',
    placeholder: 'ramen',
    source: { link: TIKTOK },
    imageUrl: 'https://cdn.example/cover.jpg',
    imageTicket: ticket(),
  })

  expect(res.status).toBe(201)
  expect(await res.json()).toMatchObject({ imageUrl: null, placeholder: 'ramen', imageNotStored: true })
})

test.each([
  ['a Source that is not a web link', { source: { link: 'javascript:alert(1)' } }],
  ['a Source without a link', { source: {} }],
  ['an image that is not a web link', { imageUrl: 'data:image/png;base64,AAAA' }],
  ['an unknown Source kind', { source: { link: TIKTOK, kind: 'myspace' } }],
])('%s is refused', async (_, extra) => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  expect((await addDish(ada, board.id, { title: 'Pasta', placeholder: 'pasta', ...extra })).status).toBe(400)
})
