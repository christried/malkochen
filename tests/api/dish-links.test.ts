import { randomBytes } from 'node:crypto'
import { beforeAll, expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { everyEventAsText, watchEvents } from './event-log'

// Dish Links (#401; CONTEXT.md: Dish Link). A Member of a Board, "Nur
// ansehen" included, shares a Dish: POST /api/dishes/:id/link makes its
// secret the first time and answers the path /d/<title slug>-<secret>.
// GET /api/dish-links/:link is public and answers the Dish's own fields and
// nothing of its Board; an Archived Dish, a Dish on an Archived Board and a
// deleted one are "not found" until restored. Lookups of secrets no Dish has
// are limited per client, together with Invite Links. Opening one is logged.
// [156] owns the Boards made here, [157] joins them with no Permissions,
// [158] is the outsider and [159] opens links signed in; this file only.

const owner = () => signIn(ALLOWLISTED[156])
const viewer = () => signIn(ALLOWLISTED[157])
const outsider = () => signIn(ALLOWLISTED[158])
const opener = () => signIn(ALLOWLISTED[159])

beforeAll(async () => {
  await Promise.all([owner(), viewer(), outsider(), opener()])
})

const TIKTOK = 'https://www.tiktok.com/@kochmeister/video/7300000000000000001'
const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) => caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

interface Setup { boardId: string, dishId: string, hedwig: Caller, ines: Caller }

// A Board of the owner's with the viewer on it, who may only look, and one Dish.
async function setup(name: string, dish: Record<string, unknown> = {}): Promise<Setup> {
  const [hedwig, ines] = await Promise.all([owner(), viewer()])
  const created = await post(hedwig, '/api/boards', { name, emoji: '🍝' })
  expect(created.status).toBe(201)
  const boardId = (await created.json() as { id: string }).id
  const { inviteToken } = await (await hedwig.fetch(`/api/boards/${boardId}`)).json() as { inviteToken: string }
  expect((await post(ines, `/api/invites/${inviteToken}/join`)).status).toBe(200)
  const me = await (await ines.fetch('/api/me')).json() as { id: string }
  const off = await hedwig.fetch(`/api/boards/${boardId}/members/${me.id}/permissions`, { method: 'PATCH', ...json({ addDishes: false, editDishes: false }) })
  expect(off.status).toBe(200)
  const added = await postDish(hedwig, boardId, { title: 'Käsespätzle', placeholder: 'bowl', creator: 'Oma Gerda', source: { link: TIKTOK }, ...dish })
  expect(added.status).toBe(201)
  return { boardId, dishId: (await added.json() as { id: string }).id, hedwig, ines }
}

const share = (caller: Caller, dishId: string) => post(caller, `/api/dishes/${dishId}/link`)
async function pathOf(caller: Caller, dishId: string): Promise<string> {
  const res = await share(caller, dishId)
  expect(res.status).toBe(200)
  return (await res.json() as { path: string }).path
}
const open = (caller: Caller, path: string) => caller.fetch(`/api/dish-links/${path.replace('/d/', '')}`)

test('sharing makes the Dish secret the first time and answers the same path after, for every Member', async () => {
  const { dishId, hedwig, ines } = await setup('Teilen')

  const first = await pathOf(hedwig, dishId)
  expect(first).toMatch(/^\/d\/kaesespaetzle-[23456789abcdefghjkmnpqrstuvwxyz]{17}$/)
  expect(await pathOf(hedwig, dishId)).toBe(first)
  expect(await pathOf(ines, dishId)).toBe(first)
})

test('a non-Member, someone signed out and a Dish that does not exist get no link; an Archived Dish too', async () => {
  const { dishId, hedwig } = await setup('Nicht teilen')

  expect((await share(await outsider(), dishId)).status).toBe(404)
  expect((await share(anonymous(), dishId)).status).toBe(401)
  expect((await share(hedwig, '3b241101-e2bb-4255-8caf-4136c566a962')).status).toBe(404)
  expect((await share(hedwig, 'nope')).status).toBe(404)

  expect((await hedwig.fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })).status).toBe(204)
  expect((await share(hedwig, dishId)).status).toBe(404)
})

test('the page data holds the Dish own fields and nothing of its Board', async () => {
  const { dishId, hedwig } = await setup('Nur das Gericht')
  const path = await pathOf(hedwig, dishId)

  const res = await open(anonymous(), path)

  expect(res.status).toBe(200)
  const view = await res.json() as Record<string, unknown>
  expect(Object.keys(view).sort()).toEqual(['creator', 'focus', 'imageUrl', 'path', 'placeholder', 'source', 'title'])
  expect(view).toEqual({
    title: 'Käsespätzle',
    imageUrl: null,
    placeholder: 'bowl',
    focus: { x: 50, y: 50 },
    creator: 'Oma Gerda',
    source: { kind: 'tiktok', link: TIKTOK },
    path,
  })
})

test('any slug opens it with the right secret, and a renamed Dish keeps its link', async () => {
  const { dishId, hedwig } = await setup('Umbenannt')
  const path = await pathOf(hedwig, dishId)
  const secret = path.slice(path.lastIndexOf('-') + 1)

  expect((await anonymous().fetch(`/api/dish-links/ganz-anders-${secret}`)).status).toBe(200)
  expect((await anonymous().fetch(`/api/dish-links/${secret}`)).status).toBe(200)
  expect((await hedwig.fetch(`/api/dishes/${dishId}`, { method: 'PATCH', ...json({ title: 'Linsensuppe' }) })).status).toBe(200)

  const renamed = await open(anonymous(), path)
  expect(renamed.status).toBe(200)
  expect(await renamed.json()).toMatchObject({ title: 'Linsensuppe', path: `/d/linsensuppe-${secret}` })
  expect(await pathOf(hedwig, dishId)).toBe(`/d/linsensuppe-${secret}`)
})

test('a Dish without Creator or Source says so', async () => {
  const { dishId, hedwig } = await setup('Schlicht', { creator: null, source: undefined })

  const view = await (await open(anonymous(), await pathOf(hedwig, dishId))).json()

  expect(view).toMatchObject({ creator: null, source: null })
})

test('an Archived Dish is "not found" and brings the same link back when restored', async () => {
  const { dishId, hedwig } = await setup('Archiv')
  const path = await pathOf(hedwig, dishId)

  expect((await hedwig.fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })).status).toBe(204)
  expect((await open(anonymous(), path)).status).toBe(404)

  expect((await post(hedwig, `/api/dishes/${dishId}/restore`)).ok).toBe(true)
  expect((await open(anonymous(), path)).status).toBe(200)
})

test('a Dish on an Archived Board is "not found" and comes back with the Board', async () => {
  const { boardId, dishId, hedwig } = await setup('Brett weg')
  const path = await pathOf(hedwig, dishId)

  expect((await hedwig.fetch(`/api/boards/${boardId}`, { method: 'DELETE' })).status).toBe(204)
  expect((await open(anonymous(), path)).status).toBe(404)

  expect((await post(hedwig, `/api/boards/${boardId}/restore`)).ok).toBe(true)
  expect((await open(anonymous(), path)).status).toBe(200)
})

test('a Dish deleted for good is "not found" for good', async () => {
  const { dishId, hedwig } = await setup('Endgültig')
  const path = await pathOf(hedwig, dishId)

  expect((await hedwig.fetch(`/api/dishes/${dishId}`, { method: 'DELETE' })).status).toBe(204)
  expect((await post(hedwig, `/api/dishes/${dishId}/purge`)).ok).toBe(true)

  expect((await open(anonymous(), path)).status).toBe(404)
})

test('what cannot be a secret is "not found"', async () => {
  for (const link of ['kaesespaetzle', 'x-abc', `x-${'0'.repeat(17)}`]) {
    expect((await anonymous().fetch(`/api/dish-links/${link}`)).status).toBe(404)
  }
})

// A client of its own, told apart by the address Vercel puts in
// x-forwarded-for: new each run.
function client(): Caller {
  const address = `2001:db8::${randomBytes(4).toString('hex').replace(/(....)(....)/, '$1:$2')}`
  return {
    fetch: (path, init) => anonymous().fetch(path, { ...init, headers: { ...init?.headers, 'x-forwarded-for': address } }),
  }
}
const wrongSecret = (n: number) => `${'23456789abcdefghjkmnpqrstuvwxyz'[n % 31]}${'23456789abcdefghjkmnpqrstuvwxyz'[Math.floor(n / 31) % 31]}${'c'.repeat(15)}`

test('after too many links no Dish has, a client gets no answer for a while; a found link is no miss', async () => {
  const { dishId, hedwig } = await setup('Ratespiel')
  const path = await pathOf(hedwig, dishId)
  const guesser = client()

  for (let guess = 0; guess < 30; guess++) {
    expect((await guesser.fetch(`/api/dish-links/x-${wrongSecret(guess)}`)).status).toBe(404)
    if (guess % 10 === 0) expect((await open(guesser, path)).status).toBe(200)
  }

  expect((await guesser.fetch(`/api/dish-links/x-${wrongSecret(31)}`)).status).toBe(429)
  expect((await open(guesser, path)).status).toBe(429)
  expect((await open(client(), path)).status).toBe(200)
})

test('opening a Dish Link is logged with its Board and Dish, whether signed in or not', async () => {
  const { boardId, dishId, hedwig } = await setup('Protokoll')
  const path = await pathOf(hedwig, dishId)
  const log = await watchEvents()
  const kim = await opener()
  const kimId = (await (await kim.fetch('/api/me')).json() as { id: string }).id

  expect((await open(client(), path)).status).toBe(200)
  expect((await open(kim, path)).status).toBe(200)
  expect((await open(client(), `/d/x-${wrongSecret(3)}`)).status).toBe(404)

  expect(await log.recorded()).toEqual([
    { kind: 'dish_link_opened', boardId, dishId, userId: null, details: { signedIn: false } },
    { kind: 'dish_link_opened', boardId, dishId, userId: kimId, details: { signedIn: true } },
  ])
  // Never the title or the Creator.
  expect(await everyEventAsText()).not.toContain('Oma Gerda')
})
