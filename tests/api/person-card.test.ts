import { expect, test } from 'vitest'
import { landingBoard, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'

// The user popover (#213): GET /api/boards/:id/people/:userId answers what
// the popover shows about someone, seen from one of the caller's Boards:
// their Username and Profile Picture, since when they are on malkochen, how
// many Dishes they added to that Board, and the Boards both belong to. Only
// for someone the caller shares a Board with. Easley, Keller and Granville
// are used by this file only.

const EASLEY = ALLOWLISTED[60]
const KELLER = ALLOWLISTED[61]
const GRANVILLE = ALLOWLISTED[62]

interface PersonCard {
  id: string
  name: string
  image: string | null
  accountCreatedAt: string
  dishesAdded: number
  sharedBoards: { id: string, name: string, emoji: string }[]
  isYou: boolean
}
interface Board { id: string, name: string, inviteToken: string, members: { id: string, name: string }[] }

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const personCard = (caller: Caller, boardId: string, userId: string) => caller.fetch(`/api/boards/${boardId}/people/${userId}`)

async function getBoard(caller: Caller, id: string): Promise<Board> {
  return (await caller.fetch(`/api/boards/${id}`)).json()
}

async function newBoard(owner: Caller, name: string, emoji: string, ...joiners: Caller[]): Promise<Board> {
  const res = await owner.fetch('/api/boards', { method: 'POST', ...json({ name, emoji }) })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(owner, id)
  for (const joiner of joiners) {
    expect((await joiner.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  }
  return getBoard(owner, id)
}

async function addDishes(caller: Caller, boardId: string, ...titles: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const title of titles) {
    const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
    expect(res.status).toBe(201)
    ids.push((await res.json() as { id: string }).id)
  }
  return ids
}

async function idOf(caller: Caller): Promise<string> {
  return (await (await caller.fetch('/api/me')).json() as { id: string }).id
}

// Easley and Keller, each with a Username of their own (not their Google
// name), and fresh Boards: two they share, and one of Keller's alone.
async function setUp() {
  const easley = await signIn(EASLEY, { name: 'Annie Easley' })
  const keller = await signIn(KELLER, { name: 'Evelyn Keller', image: 'https://lh3.googleusercontent.com/a/keller' })
  for (const [caller, username] of [[easley, 'Easley'], [keller, 'Kellerküche']] as const) {
    const { name } = await (await caller.fetch('/api/me')).json() as { name: string }
    if (name === username) continue
    const res = await caller.fetch('/api/me/username', { method: 'PUT', ...json({ username }) })
    expect(res.status).toBe(200)
  }
  const shared = await newBoard(easley, 'Mittagstisch', '🥗', keller)
  const alsoShared = await newBoard(keller, 'Grillabend', '🔥', easley)
  const kellersOwn = await newBoard(keller, 'Geheimrezepte', '🤫')
  return { easley, keller, shared, alsoShared, kellersOwn, kellerId: await idOf(keller), easleyId: await idOf(easley) }
}

test('a Member sees another Member: Username, picture, since when, the Dishes they added here, and the Boards both are on', async () => {
  const { easley, keller, shared, alsoShared, kellersOwn, kellerId } = await setUp()
  const [, deleted] = await addDishes(keller, shared.id, 'Linsensalat', 'Ofengemüse', 'Hummus')
  await addDishes(keller, alsoShared.id, 'Maiskolben')
  await addDishes(keller, kellersOwn.id, 'Tantan-Ramen')
  await addDishes(easley, shared.id, 'Couscous')
  expect((await keller.fetch(`/api/dishes/${deleted}`, { method: 'DELETE' })).status).toBe(204)

  const res = await personCard(easley, shared.id, kellerId)

  expect(res.status).toBe(200)
  const card = await res.json() as PersonCard
  expect(card).toMatchObject({
    id: kellerId,
    name: 'Kellerküche',
    image: 'https://lh3.googleusercontent.com/a/keller',
    // Only what is on this Board now: not the deleted one, nor those on
    // other Boards, nor Easley's.
    dishesAdded: 2,
    isYou: false,
  })
  // The Google name shows nowhere.
  expect(JSON.stringify(card)).not.toContain('Evelyn')
  // When the account was made: just now.
  expect(Math.abs(Date.parse(card.accountCreatedAt) - Date.now())).toBeLessThan(10 * 60_000)
  // Both Boards they share, never Keller's own.
  expect(card.sharedBoards).toEqual(expect.arrayContaining([
    { id: shared.id, name: 'Mittagstisch', emoji: '🥗' },
    { id: alsoShared.id, name: 'Grillabend', emoji: '🔥' },
  ]))
  expect(card.sharedBoards.map(b => b.id)).not.toContain(kellersOwn.id)
  // Nothing about cooking.
  expect(Object.keys(card).sort()).toEqual(['accountCreatedAt', 'dishesAdded', 'id', 'image', 'isYou', 'name', 'sharedBoards'])
})

test('one’s own card shows one’s own Boards and the Dishes one added here', async () => {
  const { easley, shared, easleyId } = await setUp()
  await addDishes(easley, shared.id, 'Bratkartoffeln')

  const res = await personCard(easley, shared.id, easleyId)

  expect(res.status).toBe(200)
  const card = await res.json() as PersonCard
  expect(card).toMatchObject({ id: easleyId, name: 'Easley', dishesAdded: 1, isYou: true })
  const own = await (await easley.fetch('/api/boards')).json() as { id: string }[]
  expect(card.sharedBoards.map(b => b.id).sort()).toEqual(own.map(b => b.id).sort())
})

test('someone who left the Board but still shares another one is shown, with the Dishes they added here', async () => {
  const { easley, keller, shared, kellerId } = await setUp()
  await addDishes(keller, shared.id, 'Kartoffelsuppe')
  expect((await keller.fetch(`/api/boards/${shared.id}/members/${kellerId}`, { method: 'DELETE' })).status).toBe(204)

  const res = await personCard(easley, shared.id, kellerId)

  expect(res.status).toBe(200)
  const card = await res.json() as PersonCard
  expect(card.dishesAdded).toBe(1)
  expect(card.sharedBoards.map(b => b.id)).not.toContain(shared.id)
})

test('someone who shares no Board with the caller is refused, like an unknown user', async () => {
  const { keller, kellersOwn } = await setUp()
  const granville = await signIn(GRANVILLE)
  const granvilleId = await idOf(granville)

  // Keller asks from her own Board about Granville, with whom she shares nothing.
  const res = await personCard(keller, kellersOwn.id, granvilleId)
  expect(res.status).toBe(404)
  const unknown = await personCard(keller, kellersOwn.id, 'no-such-user')
  expect(unknown.status).toBe(404)
  expect(await res.json()).toMatchObject({ statusMessage: (await unknown.json() as { statusMessage: string }).statusMessage })
})

test('a non-Member of the Board gets nothing, even about someone they share another Board with', async () => {
  const { easley, kellersOwn, kellerId } = await setUp()

  expect((await personCard(easley, kellersOwn.id, kellerId)).status).toBe(404)
})

test('only a signed-in user may ask', async () => {
  const easley = await signIn(EASLEY)
  const board = await landingBoard(easley)

  expect((await personCard(anonymous(), board.id, await idOf(easley))).status).toBe(401)
})
