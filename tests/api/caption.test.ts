import { expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'
import { testAuthEnv } from '../support/test-auth-env'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, signIn, type Caller } from './client'

// The Caption (CONTEXT.md, #393): the text a Source shows with its post. The
// server keeps a Caption only with the Source Ticket Source Lookup signed for
// the link and Caption it read (GET /api/source-lookup), so no Member can
// write their own. Kept with the Dish when it is added or its Source changes,
// shown with the Dish and found by search.

interface Dish {
  id: string
  title: string
  creator: string | null
  caption: string | null
  source: { link: string, kind: string } | null
}
interface Board {
  id: string
  columns: { dishes: Dish[] }[]
}

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const SHORT = 'https://www.youtube.com/shorts/tPEE9ZwTmy0'
const CAPTION = 'Zitronenthymian und Kichererbsen, dazu Tahini.\nAlles in einer Pfanne.'
const SECRET = testAuthEnv('http://127.0.0.1').BETTER_AUTH_SECRET ?? ''

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

async function me(caller: Caller): Promise<{ id: string }> {
  return (await caller.fetch('/api/me')).json() as Promise<{ id: string }>
}

// The Source Ticket Source Lookup signs for the Member it answers: the link
// Caption and playableVideo (false) it read (the facts server/utils/source-ticket.ts signs).
async function sourceTicket(issuedTo: Caller, link: string, caption: string | null): Promise<string> {
  const { id } = await me(issuedTo)
  return createImageTickets(SECRET, { purpose: 'source' }).issue(id, JSON.stringify({ link, caption, playableVideo: false }))
}

async function addDish(caller: Caller, body: Record<string, unknown>): Promise<Dish> {
  const board = await landingBoard(caller)
  const res = await postDish(caller, board.id, { title: 'Dal', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
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

async function onBoard(caller: Caller, dishId: string): Promise<Dish | undefined> {
  return (await landingBoard(caller)).columns.flatMap(c => c.dishes).find(d => d.id === dishId)
}

async function searchIds(caller: Caller, q: string): Promise<string[]> {
  const board = await landingBoard(caller)
  const res = await caller.fetch(`/api/boards/${board.id}/dishes?q=${encodeURIComponent(q)}`)
  expect(res.status).toBe(200)
  return ((await res.json()) as { dishes: Dish[] }).dishes.map(d => d.id)
}

test('a Caption sent without a Source Ticket is not kept: only what Source Lookup read is', async () => {
  const ada = await signIn(ALLOWLISTED[0])

  const dish = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION })

  expect(dish.caption).toBeNull()
  expect(await onBoard(ada, dish.id)).toEqual(dish)
})

test('a ticket for another Caption, or for another link, vouches for neither', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const otherCaption = await sourceTicket(ada, TIKTOK, 'Ein anderer Text.')
  const otherLink = await sourceTicket(ada, SHORT, CAPTION)

  expect((await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION, sourceTicket: otherCaption })).caption).toBeNull()
  expect((await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION, sourceTicket: otherLink })).caption).toBeNull()
})

test('a Caption with its Source Ticket is kept with the Dish, shown with it, and found by search', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const ticket = await sourceTicket(ada, TIKTOK, CAPTION)

  const added = await addDish(ada, { title: 'Eintopf', source: { link: TIKTOK }, creator: 'Suki Küche', caption: CAPTION, sourceTicket: ticket })

  expect(added.caption).toBe(CAPTION)
  expect(await onBoard(ada, added.id)).toEqual(added)
  expect(await searchIds(ada, 'zitronenthymian')).toContain(added.id)
  expect(await searchIds(ada, 'suki küche')).toContain(added.id)
  expect(await searchIds(ada, 'Eintopf')).toContain(added.id)
  expect(await searchIds(ada, 'Kartoffelsalat mit Speck')).not.toContain(added.id)
})

test('a Source Ticket issued to another Member does not count', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const grace = await signIn(ALLOWLISTED[1])
  const ticket = await sourceTicket(grace, TIKTOK, CAPTION)

  expect((await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION, sourceTicket: ticket })).caption).toBeNull()
})

test('Source Lookup answers with a Source Ticket, even for a link it knows nothing about', async () => {
  const ada = await signIn(ALLOWLISTED[0])

  const res = await ada.fetch('/api/source-lookup?link=http%3A%2F%2F127.0.0.1%2Frezept')
  const answer = await res.json() as { sourceTicket: string | null, canonicalLink: string }

  expect(answer.sourceTicket).toEqual(expect.any(String))
  expect(answer.canonicalLink).toBe('http://127.0.0.1/rezept')
})

test('editing with the same Source keeps its Caption, with or without a ticket', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION, sourceTicket: await sourceTicket(ada, TIKTOK, CAPTION) })

  expect((await (await editDish(ada, dish.id, { source: { link: TIKTOK }, caption: 'Anders.' })).json()).caption).toBe(CAPTION)
  expect((await (await editDish(ada, dish.id, { source: { link: TIKTOK } })).json()).caption).toBe(CAPTION)
  expect((await onBoard(ada, dish.id))?.caption).toBe(CAPTION)
})

test('a new Source keeps its Caption only with its own Source Ticket', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION, sourceTicket: await sourceTicket(ada, TIKTOK, CAPTION) })

  const withTicket = await (await editDish(ada, dish.id, { source: { link: SHORT }, caption: 'Vom Kurzvideo.', sourceTicket: await sourceTicket(ada, SHORT, 'Vom Kurzvideo.') })).json()
  expect(withTicket).toMatchObject({ source: { link: SHORT, kind: 'youtube-short' }, caption: 'Vom Kurzvideo.' })
  expect(await onBoard(ada, dish.id)).toEqual(withTicket)

  const withoutTicket = await (await editDish(ada, dish.id, { source: { link: TIKTOK }, caption: CAPTION })).json()
  expect(withoutTicket.caption).toBeNull()
})

test('removing the Source removes its Caption, and editing other fields leaves it', async () => {
  const ada = await signIn(ALLOWLISTED[0])
  const dish = await addDish(ada, { source: { link: TIKTOK }, caption: CAPTION, sourceTicket: await sourceTicket(ada, TIKTOK, CAPTION) })

  expect((await (await editDish(ada, dish.id, { title: 'Linsen-Dal' })).json()).caption).toBe(CAPTION)
  expect((await (await editDish(ada, dish.id, { source: null })).json()).caption).toBeNull()
})
