import { expect, test } from 'vitest'
import { createFoundImageStore } from '../../server/image-store/found-image'
import { createImageTickets } from '../../server/image-store/tickets'

// Seam 3: storing a found image for a Dish, what creating and editing a Dish do
// with the image Source Lookup found. Membership is faked and the Image Store
// is a recorder; the Image Store itself is covered in image-store.test.ts.

const SECRET = 'test-secret-test-secret-test-secret-0123'
const COVER = 'https://p16-sign.tiktokcdn-eu.com/obj/cover.jpeg?x-expires=1700000000'
const STORED = 'https://store.example/dishes/cover.jpg'

function storeFor(members: [boardId: string, userId: string][], copyResult: string | null = STORED) {
  const tickets = createImageTickets(SECRET)
  const copied: string[] = []
  const store = createFoundImageStore({
    isMember: async (boardId, userId) => members.some(([b, u]) => b === boardId && u === userId),
    copyImage: async (imageUrl) => {
      copied.push(imageUrl)
      return copyResult
    },
    tickets,
  })
  return { store, copied, tickets }
}

test('a Member’s found image is copied, and its stored URL comes back', async () => {
  const { store, copied, tickets } = storeFor([['board-1', 'ada']])

  expect(await store('ada', 'board-1', COVER, tickets.issue('ada', COVER))).toBe(STORED)
  expect(copied).toEqual([COVER])
})

test('nothing is copied for a Board the user is not a Member of', async () => {
  const { store, copied, tickets } = storeFor([['board-1', 'ada']])

  expect(await store('linus', 'board-1', COVER, tickets.issue('linus', COVER))).toBeNull()
  expect(copied).toEqual([])
})

test.each([
  ['no Image Ticket', () => undefined],
  ['a forged Image Ticket', () => `${Date.now() + 60_000}.AAAA`],
  ['another Member’s Image Ticket', (tickets: ReturnType<typeof createImageTickets>) => tickets.issue('grace', COVER)],
])('an image with %s is not copied', async (_, ticket) => {
  const { store, copied, tickets } = storeFor([['board-1', 'ada']])

  expect(await store('ada', 'board-1', COVER, ticket(tickets))).toBeNull()
  expect(copied).toEqual([])
})

test('an image the Image Store could not copy is not stored', async () => {
  const { store, copied, tickets } = storeFor([['board-1', 'ada']], null)

  expect(await store('ada', 'board-1', COVER, tickets.issue('ada', COVER))).toBeNull()
  expect(copied).toEqual([COVER])
})
