import { afterAll, beforeAll, expect, test } from 'vitest'
import { createImageTickets } from '../../server/image-store/tickets'
import { testAuthEnv } from '../support/test-auth-env'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, browser, signIn, type Caller } from './client'
import { watchEvents } from './event-log'
import { startPushService, type PushService } from './push-service'

// Copy from a Dish Link (#403; CONTEXT.md: Dish Link, Copy). A signed-in user
// with the link copies the Dish to one of their Boards where they may add
// Dishes: POST /api/dish-links/:link/copy { boardId }, the same Copy as #402's
// (copies.test.ts), with no access to the source needed. Signed out, the link
// is remembered in a cookie (malkochen.dish-link, an hour) through sign-in
// and sign-up, and the landing answers it as `dishLink`. [164] owns the Boards
// made here, [165] copies, [166] is a Member of the target without "add
// Dishes", [167] is brand new: its first sign-in is in this file. This file only.

const owner = () => signIn(ALLOWLISTED[164])
const copier = () => signIn(ALLOWLISTED[165])
const quiet = () => signIn(ALLOWLISTED[166])

const TIKTOK = 'https://www.tiktok.com/@kochmeister/video/7300000000000002'
const SECRET = testAuthEnv('http://127.0.0.1').BETTER_AUTH_SECRET ?? ''
const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) => caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })
const patch = (caller: Caller, path: string, body: unknown) => caller.fetch(path, { method: 'PATCH', ...json(body) })
const REMEMBERED = 'malkochen.dish-link'

let pushService: PushService
beforeAll(async () => {
  pushService = await startPushService()
  await Promise.all([owner(), copier(), quiet()])
})
afterAll(() => pushService.close())

interface Column { id: string, name: string, isGekocht: boolean, dishes: { id: string }[] }
interface Board { id: string, slug: string, name: string, emoji: string, inviteToken: string, columns: Column[] }
interface Dish {
  id: string
  title: string
  creator: string | null
  caption: string | null
  source: { link: string, kind: string } | null
  placement?: { boardId: string, columnId: string, index: number }
  addedBy: { id: string } | null
}

const getBoard = (caller: Caller, id: string): Promise<Board> => caller.fetch(`/api/boards/${id}`).then(res => res.json())
const idOf = async (caller: Caller): Promise<string> => (await (await caller.fetch('/api/me')).json() as { id: string }).id

async function newBoard(ada: Caller, name: string, members: Caller[]): Promise<Board> {
  const res = await post(ada, '/api/boards', { name, emoji: '🥘' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(ada, id)
  for (const member of members) expect((await post(member, `/api/invites/${inviteToken}/join`)).status).toBe(200)
  return getBoard(ada, id)
}

// The source: the owner's Board, which the copier is not on. The target: the
// owner's and the copier's, with the quiet Member on it without "add Dishes".
async function boards(name: string) {
  const [ada, grace, linus] = await Promise.all([owner(), copier(), quiet()])
  const source = await newBoard(ada, `${name} Quelle`, [])
  const target = await newBoard(ada, `${name} Ziel`, [grace, linus])
  const linusId = await idOf(linus)
  expect((await patch(ada, `/api/boards/${target.id}/members/${linusId}/permissions`, { addDishes: false, editDishes: false })).status).toBe(200)
  return { source, target, ada, grace, linus }
}

async function sourceTicket(issuedTo: Caller, link: string, caption: string | null, playableVideo: boolean): Promise<string> {
  return createImageTickets(SECRET, { purpose: 'source' }).issue(await idOf(issuedTo), JSON.stringify({ link, caption, playableVideo }))
}

async function addDish(caller: Caller, boardId: string, body: Record<string, unknown>): Promise<Dish> {
  const res = await postDish(caller, boardId, { title: 'Linsensuppe', placeholder: 'bowl', ...body })
  expect(res.status).toBe(201)
  return res.json()
}

// The Dish's link as a Member shares it: the part after /d/.
async function linkOf(ada: Caller, dishId: string): Promise<string> {
  const res = await post(ada, `/api/dishes/${dishId}/link`)
  expect(res.status).toBe(200)
  return (await res.json() as { path: string }).path.replace('/d/', '')
}

const copyFromLink = (caller: Caller, link: string, boardId: string) => post(caller, `/api/dish-links/${link}/copy`, { boardId })
const remember = (caller: Caller, link: string) => post(caller, `/api/dish-links/${link}/remember`)
const landing = async (caller: Caller) => await (await caller.fetch('/api/boards/landing')).json() as Record<string, unknown>

test('a Copy from a Dish Link by someone not on the source Board: first non-Gekocht Column, added by the copier, a viaLink event', async () => {
  const { source, target, ada, grace } = await boards('Link')
  const caption = 'Die beste Linsensuppe der Welt'
  const original = await addDish(ada, source.id, {
    title: 'Omas Linsensuppe',
    creator: 'Oma Gerda',
    caption,
    playableVideo: true,
    source: { link: TIKTOK },
    sourceTicket: await sourceTicket(ada, TIKTOK, caption, true),
  })
  const link = await linkOf(ada, original.id)
  const events = await watchEvents()

  const res = await copyFromLink(grace, link, target.id)
  expect(res.status).toBe(201)
  const { dish, board, imageCopied } = await res.json() as { dish: Dish, board: { id: string, slug: string, name: string, emoji: string }, imageCopied: boolean }

  expect(dish).toMatchObject({
    title: 'Omas Linsensuppe',
    creator: 'Oma Gerda',
    caption,
    source: { link: TIKTOK, kind: 'tiktok' },
    addedBy: { id: await idOf(grace) },
    placement: { boardId: target.id },
  })
  expect(board).toEqual({ id: target.id, slug: target.slug, name: target.name, emoji: target.emoji })
  expect(imageCopied).toBe(true)
  const first = (await getBoard(ada, target.id)).columns.find(c => !c.isGekocht)!
  expect(dish.placement).toMatchObject({ columnId: first.id })

  const recorded = (await events.recorded()).filter(e => e.kind === 'dish_copied' || e.kind === 'dish_added')
  expect(recorded).toEqual([{
    kind: 'dish_copied',
    boardId: target.id,
    dishId: dish.id,
    userId: await idOf(grace),
    details: { from: original.id, source: 'tiktok', viaLink: true },
  }])
})

test('refused: a dead Dish Link (archived, or purged) is 404; a made-up secret is 404', async () => {
  const { source, target, ada, grace } = await boards('Tot')
  const archived = await addDish(ada, source.id, { title: 'Archiviert' })
  const archivedLink = await linkOf(ada, archived.id)
  expect((await ada.fetch(`/api/dishes/${archived.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await copyFromLink(grace, archivedLink, target.id)).status).toBe(404)

  const purged = await addDish(ada, source.id, { title: 'Gelöscht' })
  const purgedLink = await linkOf(ada, purged.id)
  expect((await ada.fetch(`/api/dishes/${purged.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await post(ada, `/api/dishes/${purged.id}/purge`)).status).toBe(204)
  expect((await copyFromLink(grace, purgedLink, target.id)).status).toBe(404)
  expect((await copyFromLink(grace, 'x-0123456789abcdef0123456789abcdef', target.id)).status).toBe(404)
})

test('refused: a target without "add Dishes" is 403, a target the copier is not on is 404, the same Board is 400, signed out is 401', async () => {
  const { source, target, ada, grace, linus } = await boards('Abgelehnt')
  const original = await addDish(ada, source.id, { title: 'Nein' })
  const link = await linkOf(ada, original.id)
  const before = (await getBoard(ada, target.id)).columns.flatMap(c => c.dishes).length

  expect((await copyFromLink(linus, link, target.id)).status).toBe(403)
  const elsewhere = await newBoard(ada, 'Abgelehnt Fremd', [])
  expect((await copyFromLink(grace, link, elsewhere.id)).status).toBe(404)
  expect((await copyFromLink(ada, link, source.id)).status).toBe(400)
  expect((await copyFromLink(anonymous(), link, target.id)).status).toBe(401)

  expect((await getBoard(ada, target.id)).columns.flatMap(c => c.dishes).length).toBe(before)
})

test('remembered through sign-in: the landing answers the Dish Link once, then not', async () => {
  const { source, ada } = await boards('Merken')
  const original = await addDish(ada, source.id, { title: 'Gemerkt' })
  const link = await linkOf(ada, original.id)

  const visitor = browser()
  const res = await remember(visitor, link)
  expect(res.status).toBe(204)
  expect(visitor.cookie(REMEMBERED)).toBe(link.slice(link.lastIndexOf('-') + 1))

  expect((await visitor.signIn(ALLOWLISTED[165])).status).toBe(200)
  const answer = await landing(visitor)
  expect(answer.dishLink).toMatch(/^\/d\/gemerkt-[23456789abcdefghjkmnpqrstuvwxyz]{17}$/)
  expect(visitor.cookie(REMEMBERED)).toBeUndefined()
  expect(await landing(visitor)).not.toHaveProperty('dishLink')
})

test('remembered, then the Dish archived before the sign-in: no dishLink, and the cookie is cleared', async () => {
  const { source, ada } = await boards('Verschwunden')
  const original = await addDish(ada, source.id, { title: 'Weg' })
  const link = await linkOf(ada, original.id)
  const visitor = browser()
  expect((await remember(visitor, link)).status).toBe(204)
  expect((await ada.fetch(`/api/dishes/${original.id}`, { method: 'DELETE' })).status).toBe(204)

  expect((await visitor.signIn(ALLOWLISTED[165])).status).toBe(200)
  expect(await landing(visitor)).not.toHaveProperty('dishLink')
  expect(visitor.cookie(REMEMBERED)).toBeUndefined()
})

test('a made-up secret on remember is 404', async () => {
  expect((await remember(anonymous(), 'x-0123456789abcdef0123456789abcdef')).status).toBe(404)
})

test('a brand-new user: the first landing after sign-up creates "Meine Küche" and answers the Dish Link', async () => {
  const { source, ada } = await boards('Neuanfang')
  const original = await addDish(ada, source.id, { title: 'Neu' })
  const link = await linkOf(ada, original.id)
  const newcomer = browser()
  expect((await remember(newcomer, link)).status).toBe(204)

  expect((await newcomer.signIn(ALLOWLISTED[167])).status).toBe(200)
  const answer = await landing(newcomer)
  expect(answer.dishLink).toMatch(/^\/d\/neu-/)
  const names = (await (await newcomer.fetch('/api/boards')).json() as { name: string }[]).map(b => b.name)
  expect(names).toContain('Meine Küche')
})
