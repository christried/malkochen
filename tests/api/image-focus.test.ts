import sharp from 'sharp'
import { expect, test } from 'vitest'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// A Dish's focus point: which part of its image shows in a frame that crops
// it (the card's thumb, the detail's header, search results). Stored as a
// point in percent of the image, shared by all Members; the centre unless a
// Member shifted it. Only a Source image or an own photo has one: a new
// image starts in the centre, and so does a Placeholder.

interface Focus { x: number, y: number }
interface Dish { id: string, imageUrl: string | null, imageFocus: Focus }
interface Board { id: string, columns: { dishes: Dish[] }[] }
interface Uploaded { url: string, ticket: string }

const CENTRE = { x: 50, y: 50 }

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

// A portrait phone photo, uploaded as "Eigenes Foto".
async function uploaded(caller: Caller, boardId: string): Promise<Uploaded> {
  const bytes = await sharp({ create: { width: 900, height: 1600, channels: 3, background: '#7a4' } }).jpeg().toBuffer()
  const res = await caller.fetch(`/api/boards/${boardId}/photos`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: new Uint8Array(bytes) })
  expect(res.status).toBe(201)
  return res.json()
}

async function addDish(caller: Caller, body: Record<string, unknown>): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title: 'Tofu-Bowl', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  return res.json()
}

function editDish(caller: Caller, dishId: string, body: unknown) {
  return caller.fetch(`/api/dishes/${dishId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const onBoard = async (caller: Caller, dishId: string) =>
  (await landingBoard(caller)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)

test('a Dish’s image is centred unless a Member shifts it', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const dish = await addDish(ada, { photo: await uploaded(ada, board.id) })

  expect(dish.imageFocus).toEqual(CENTRE)
  expect((await onBoard(ada, dish.id))?.imageFocus).toEqual(CENTRE)
})

test('a photo added with a focus point keeps it, and the Board shows it', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)

  const dish = await addDish(ada, { photo: await uploaded(ada, board.id), imageFocus: { x: 50, y: 20 } })

  expect(dish.imageFocus).toEqual({ x: 50, y: 20 })
  expect((await onBoard(ada, dish.id))?.imageFocus).toEqual({ x: 50, y: 20 })
})

test('a Member shifts a Dish’s image, and nothing else changes', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const dish = await addDish(ada, { photo: await uploaded(ada, board.id) })

  const res = await editDish(ada, dish.id, { imageFocus: { x: 0, y: 87.6 } })

  expect(res.status).toBe(200)
  // Whole percent are plenty for any frame.
  expect(await res.json()).toMatchObject({ imageUrl: dish.imageUrl, imageFocus: { x: 0, y: 88 } })
  expect((await onBoard(ada, dish.id))?.imageFocus).toEqual({ x: 0, y: 88 })
})

test.each([
  ['beyond the image', { x: 50, y: 101 }],
  ['before it', { x: -1, y: 50 }],
  ['without both coordinates', { y: 20 }],
  ['not a number', { x: '50%', y: 20 }],
])('a focus point %s is refused (400)', async (_, imageFocus) => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const dish = await addDish(ada, { photo: await uploaded(ada, board.id) })

  expect((await editDish(ada, dish.id, { imageFocus })).status).toBe(400)
  expect((await postDish(ada, board.id, { title: 'Tofu-Bowl', placeholder: 'bowl', imageFocus })).status).toBe(400)
})

test('a new photo starts in the centre, unless its focus point comes with it', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const dish = await addDish(ada, { photo: await uploaded(ada, board.id), imageFocus: { x: 50, y: 20 } })

  const replaced = await (await editDish(ada, dish.id, { photo: await uploaded(ada, board.id) })).json() as Dish
  expect(replaced.imageFocus).toEqual(CENTRE)

  const shifted = await (await editDish(ada, dish.id, { photo: await uploaded(ada, board.id), imageFocus: { x: 30, y: 70 } })).json() as Dish
  expect(shifted.imageFocus).toEqual({ x: 30, y: 70 })
})

test('a Placeholder has no focus point: picking one puts it back in the centre', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const dish = await addDish(ada, { photo: await uploaded(ada, board.id), imageFocus: { x: 50, y: 20 } })

  const res = await editDish(ada, dish.id, { imageUrl: null, placeholder: 'ramen', imageFocus: { x: 10, y: 10 } })

  expect(await res.json()).toMatchObject({ imageUrl: null, imageFocus: CENTRE })
  // Nor does a Dish added without an image take one.
  expect((await addDish(ada, { imageFocus: { x: 10, y: 10 } })).imageFocus).toEqual(CENTRE)
})

test('a photo that isn’t used doesn’t move the image the Dish keeps', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const board = await landingBoard(ada)
  const dish = await addDish(ada, { photo: await uploaded(ada, board.id), imageFocus: { x: 50, y: 20 } })
  const forged = { ...await uploaded(ada, board.id), ticket: '9999999999999.AAAA' }

  const res = await editDish(ada, dish.id, { photo: forged, imageFocus: { x: 90, y: 90 } })

  expect(await res.json()).toMatchObject({ imageUrl: dish.imageUrl, imageFocus: { x: 50, y: 20 }, imageNotStored: true })
})
