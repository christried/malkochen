import { expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'
import { testAuthEnv } from '../support/test-auth-env'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// Whether a Dish's Source has a video that plays in malkochen (#394): found
// when the Dish is added or its Source changes. TikTok and YouTube Shorts tell
// from their link alone; an Instagram post only with the Source Ticket Source
// Lookup signed for what it found; anything else never plays.

interface Dish {
  id: string
  playableVideo: boolean | null
  source: { link: string, kind: string } | null
}
interface Board {
  id: string
  columns: { dishes: Dish[] }[]
}

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const TIKTOK_PHOTO = 'https://www.tiktok.com/@scout2015/photo/6718335390845095173'
const SHORT = 'https://www.youtube.com/shorts/tPEE9ZwTmy0'
const REEL = 'https://www.instagram.com/reel/DFvsVH_OD9h/'
const POST = 'https://www.instagram.com/p/DFvsVH_OD9h/'
const BLOG = 'http://127.0.0.1/rezept'
const SECRET = testAuthEnv('http://127.0.0.1').BETTER_AUTH_SECRET ?? ''

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

// The Source Ticket Source Lookup signs for the Member it answers, for a Source
// it found to play (or not) in malkochen.
async function sourceTicket(issuedTo: Caller, link: string, playableVideo: boolean): Promise<string> {
  const { id } = await (await issuedTo.fetch('/api/me')).json() as { id: string }
  return createImageTickets(SECRET, { purpose: 'source' }).issue(id, JSON.stringify({ link, caption: null, playableVideo }))
}

async function addDish(caller: Caller, body: Record<string, unknown>): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title: 'Dal', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  return await res.json() as Dish
}

function editDish(caller: Caller, dishId: string, body: unknown) {
  return caller.fetch(`/api/dishes/${dishId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function onBoard(caller: Caller, dishId: string): Promise<Dish | undefined> {
  return (await landingBoard(caller)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)
}

test('a TikTok video or a YouTube Short plays, a TikTok photo post does not: no ticket needed', async () => {
  const ada = await signIn(ALLOWLISTED[136])

  expect((await addDish(ada, { source: { link: TIKTOK } })).playableVideo).toBe(true)
  expect((await addDish(ada, { source: { link: SHORT } })).playableVideo).toBe(true)
  expect((await addDish(ada, { source: { link: TIKTOK_PHOTO } })).playableVideo).toBe(false)
})

test('what a client claims for a TikTok video does not matter: the link decides', async () => {
  const ada = await signIn(ALLOWLISTED[136])

  expect((await addDish(ada, { source: { link: TIKTOK_PHOTO }, playableVideo: true })).playableVideo).toBe(false)
  expect((await addDish(ada, { source: { link: TIKTOK }, playableVideo: false })).playableVideo).toBe(true)
})

test('an Instagram post stores what Source Lookup said, vouched for by its Source Ticket', async () => {
  const ada = await signIn(ALLOWLISTED[136])

  const playing = await addDish(ada, { source: { link: REEL }, playableVideo: true, sourceTicket: await sourceTicket(ada, REEL, true) })
  const notPlaying = await addDish(ada, { source: { link: POST }, playableVideo: false, sourceTicket: await sourceTicket(ada, POST, false) })

  expect(playing.playableVideo).toBe(true)
  expect(notPlaying.playableVideo).toBe(false)
})

test('an Instagram post without a valid ticket is not known to play', async () => {
  const ada = await signIn(ALLOWLISTED[136])
  const grace = await signIn(ALLOWLISTED[137])

  expect((await addDish(ada, { source: { link: REEL }, playableVideo: true })).playableVideo).toBeNull()
  // Signed for "does not play", sent as "plays".
  expect((await addDish(ada, { source: { link: REEL }, playableVideo: true, sourceTicket: await sourceTicket(ada, REEL, false) })).playableVideo).toBeNull()
  // Signed for another Member.
  expect((await addDish(ada, { source: { link: REEL }, playableVideo: true, sourceTicket: await sourceTicket(grace, REEL, true) })).playableVideo).toBeNull()
})

test('a blog never plays, a Dish without a Source has nothing known', async () => {
  const ada = await signIn(ALLOWLISTED[136])

  expect((await addDish(ada, { source: { link: BLOG }, playableVideo: true })).playableVideo).toBe(false)
  expect((await addDish(ada, {})).playableVideo).toBeNull()
})

test('Source Lookup\'s answer says it, and its Source Ticket vouches for it', async () => {
  const ada = await signIn(ALLOWLISTED[136])

  const answer = await (await ada.fetch(`/api/source-lookup?link=${encodeURIComponent(BLOG)}`)).json() as { playableVideo: boolean, sourceTicket: string }

  expect(answer.playableVideo).toBe(false)
  expect(answer.sourceTicket).toBe(await sourceTicket(ada, BLOG, false))
})

test('a new Source is checked again, the same Source keeps the value, no Source has none', async () => {
  const ada = await signIn(ALLOWLISTED[138])
  const dish = await addDish(ada, { source: { link: TIKTOK_PHOTO } })
  expect(dish.playableVideo).toBe(false)

  const toVideo = await (await editDish(ada, dish.id, { source: { link: TIKTOK } })).json() as Dish
  expect(toVideo.playableVideo).toBe(true)

  // The same link, whatever is sent with it, keeps it.
  expect((await (await editDish(ada, dish.id, { source: { link: TIKTOK }, playableVideo: false })).json() as Dish).playableVideo).toBe(true)
  expect((await (await editDish(ada, dish.id, { title: 'Linsen-Dal' })).json() as Dish).playableVideo).toBe(true)

  const toReel = await (await editDish(ada, dish.id, { source: { link: REEL }, playableVideo: false, sourceTicket: await sourceTicket(ada, REEL, false) })).json() as Dish
  expect(toReel.playableVideo).toBe(false)
  const toPost = await (await editDish(ada, dish.id, { source: { link: POST }, playableVideo: true })).json() as Dish
  expect(toPost.playableVideo).toBeNull()

  expect((await (await editDish(ada, dish.id, { source: null })).json() as Dish).playableVideo).toBeNull()
})

test('the Board shows what is stored', async () => {
  const ada = await signIn(ALLOWLISTED[139])
  const video = await addDish(ada, { source: { link: TIKTOK } })
  const photo = await addDish(ada, { source: { link: TIKTOK_PHOTO } })
  const none = await addDish(ada, {})

  expect((await onBoard(ada, video.id))?.playableVideo).toBe(true)
  expect((await onBoard(ada, photo.id))?.playableVideo).toBe(false)
  expect((await onBoard(ada, none.id))?.playableVideo).toBeNull()
})
