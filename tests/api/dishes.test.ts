import { expect, test } from 'vitest'
import { ALLOWLISTED, signIn, type Caller } from './client'

interface Dish {
  id: string
  title: string
  note: string | null
  placeholder: string
  imageUrl: string | null
  source: { link: string, kind: string } | null
  addedBy: { name: string, image: string | null } | null
}
interface Board {
  id: string
  columns: { id: string, name: string, dishes: Dish[] }[]
}

async function landingBoard(caller: Caller): Promise<Board> {
  const { boardId } = await (await caller.fetch('/api/boards/landing')).json() as { boardId: string }
  return (await caller.fetch(`/api/boards/${boardId}`)).json()
}

function addDish(caller: Caller, boardId: string, body: unknown) {
  return caller.fetch(`/api/boards/${boardId}/dishes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const titles = (board: Board, column = 0) => board.columns[column]!.dishes.map(d => d.title)

test('a Dish added without a Source lands at the top of the first Column', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const res = await addDish(ada, board.id, { title: '  Omas Linsensuppe ', note: 'mit Räuchertofu statt Speck', placeholder: 'eintopf' })

  expect(res.status).toBe(201)
  const created = await res.json() as Dish
  expect(created).toMatchObject({ title: 'Omas Linsensuppe', note: 'mit Räuchertofu statt Speck', placeholder: 'eintopf', imageUrl: null, source: null })

  const after = await landingBoard(ada)
  expect(after.columns[0]!.dishes[0]).toEqual(created)
  expect(created.addedBy).toMatchObject({ name: expect.any(String) })
  expect(after.columns.slice(1).flatMap(c => c.dishes)).toEqual([])
})

test('the newest Dish goes on top and the others keep their order', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  for (const title of ['Dal', 'Pad Thai', 'Shakshuka']) {
    expect((await addDish(grace, board.id, { title, placeholder: 'curry' })).status).toBe(201)
  }

  expect(titles(await landingBoard(grace)).slice(0, 3)).toEqual(['Shakshuka', 'Pad Thai', 'Dal'])
})

test('the note is optional, and a blank note is no note', async () => {
  const grace = await signIn(ALLOWLISTED[1])
  const board = await landingBoard(grace)

  const without = await (await addDish(grace, board.id, { title: 'Porridge', placeholder: 'porridge' })).json()
  const blank = await (await addDish(grace, board.id, { title: 'Brot', note: '   ', placeholder: 'bread' })).json()

  expect(without.note).toBeNull()
  expect(blank.note).toBeNull()
})

test('a Dish needs a title and a known Placeholder Image', async () => {
  const linus = await signIn(ALLOWLISTED[2])
  const board = await landingBoard(linus)

  expect((await addDish(linus, board.id, { placeholder: 'pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: '   ', placeholder: 'pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: 'Pasta' })).status).toBe(400)
  expect((await addDish(linus, board.id, { title: 'Pasta', placeholder: 'steak' })).status).toBe(400)

  expect((await landingBoard(linus)).columns.flatMap(c => c.dishes)).toEqual([])
})

test('only Members can add Dishes to a Board', async () => {
  const adasBoard = await landingBoard(await signIn(ALLOWLISTED[0]))
  const linus = await signIn(ALLOWLISTED[2])

  expect((await addDish(linus, adasBoard.id, { title: 'Eindringling', placeholder: 'pizza' })).status).toBe(404)
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
  const created = await res.json() as Dish
  expect(created.source).toEqual({ link: TIKTOK, kind: 'tiktok' })
  expect((await landingBoard(ada)).columns[0]!.dishes[0]).toEqual(created)
})

test('the Source kind comes from the link, except that a web page may be a blog', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const sourceOf = async (source: unknown) =>
    ((await (await addDish(ada, board.id, { title: 'Dal', placeholder: 'curry', source })).json()) as Dish).source

  expect(await sourceOf({ link: TIKTOK, kind: 'pinterest-pin' })).toEqual({ link: TIKTOK, kind: 'tiktok' })
  expect(await sourceOf({ link: TIKTOK, kind: 'blog' })).toEqual({ link: TIKTOK, kind: 'tiktok' })
  expect(await sourceOf({ link: 'https://www.chefkoch.de/rezepte/123/dal.html', kind: 'blog' }))
    .toEqual({ link: 'https://www.chefkoch.de/rezepte/123/dal.html', kind: 'blog' })
  expect(await sourceOf({ link: 'https://www.chefkoch.de/rezepte/123/dal.html' }))
    .toEqual({ link: 'https://www.chefkoch.de/rezepte/123/dal.html', kind: 'other' })
})

test('if the image cannot be copied, the Dish is saved with its Placeholder Image', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  // A private address: the Image Store never fetches it, so the copy fails.
  const res = await addDish(ada, board.id, {
    title: 'Ramen',
    placeholder: 'ramen',
    source: { link: TIKTOK },
    imageUrl: 'http://127.0.0.1/cover.jpeg',
  })

  expect(res.status).toBe(201)
  expect(await res.json()).toMatchObject({ title: 'Ramen', placeholder: 'ramen', imageUrl: null, source: { kind: 'tiktok' } })
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
