import { afterAll, beforeAll, expect, test } from 'vitest'
import { EVENT_GROUPS, type AdminEvent, type AdminEventPage } from '../../shared/admin'
import { OPERATOR } from '../support/test-auth-env'
import { startResendService, type ResendService } from '../support/resend-service'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { backdateBoardEvents } from './time-travel'

// The Event Log on the Admin Page (#400, ADR 0009): GET /api/admin/events
// answers the Operator a page of the event log, newest first, with the
// names, titles and Comment texts as they are now and what is gone marked as
// gone. [152] owns the Boards made here, [153] is a Member of some, [154] is
// no Member and tries to get in, [155] is a Member whose account is deleted;
// this file only.

const OWNER = ALLOWLISTED[152]
const MEMBER = ALLOWLISTED[153]
const OUTSIDER = ALLOWLISTED[154]
const LEAVER = ALLOWLISTED[155]

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) => caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })
const patch = (caller: Caller, path: string, body: unknown) => caller.fetch(path, { method: 'PATCH', ...json(body) })

let resend: ResendService
beforeAll(async () => {
  resend = await startResendService()
  await Promise.all([signIn(OWNER), signIn(MEMBER), signIn(OUTSIDER), signIn(LEAVER)])
})
afterAll(() => resend.close())

const owner = () => signIn(OWNER)
const member = () => signIn(MEMBER)

const nameOf = async (caller: Caller): Promise<string> => ((await (await caller.fetch('/api/me')).json()) as { name: string }).name

// The Operator's view of the log, filtered by `params`.
async function events(params: Record<string, string | number> = {}): Promise<AdminEventPage> {
  const query = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))
  const res = await (await signIn(OPERATOR)).fetch(`/api/admin/events?${query}`)
  expect(res.status).toBe(200)
  return res.json()
}

async function boardWith(name: string, ...joiners: Caller[]): Promise<{ id: string, firstColumn: string }> {
  const created = await post(await owner(), '/api/boards', { name, emoji: '🍲' })
  expect(created.status).toBe(201)
  const { id } = await created.json() as { id: string }
  const board = await (await (await owner()).fetch(`/api/boards/${id}`)).json() as { inviteToken: string, columns: { id: string }[] }
  for (const joiner of joiners) expect((await post(joiner, `/api/invites/${board.inviteToken}/join`)).status).toBe(200)
  return { id, firstColumn: board.columns[0]!.id }
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<{ id: string }> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

const ofKind = (page: AdminEventPage, kind: AdminEvent['kind']) => page.events.filter(e => e.kind === kind)
const dishTitle = (e: AdminEvent) => (e.dish && e.dish !== 'deleted' ? e.dish.title : null)

test('anyone but the Operator gets "not found", signed in or not', async () => {
  expect((await anonymous().fetch('/api/admin/events')).status).toBe(404)
  expect((await (await owner()).fetch('/api/admin/events')).status).toBe(404)
  expect((await (await signIn(OUTSIDER)).fetch('/api/admin/events?user=a')).status).toBe(404)
})

test('malformed filters are refused', async () => {
  const op = await signIn(OPERATOR)
  for (const query of ['board=nope', 'kinds=not_a_kind', 'from=yesterday', 'before=-3', 'before=x']) {
    expect((await op.fetch(`/api/admin/events?${query}`)).status).toBe(400)
  }
})

test('newest first, 50 to a page, and `before` gives the next page without overlap until `next` is null', async () => {
  const ada = await owner()
  const board = await boardWith('Viele Ereignisse')
  for (let i = 0; i < 54; i++) await addDish(ada, board.id, `Gericht ${i}`)

  const first = await events({ board: board.id })
  expect(first.events).toHaveLength(50)
  expect(first.next).toBe(first.events[49]!.id)
  const ids = first.events.map(e => e.id)
  expect(ids).toEqual([...ids].sort((a, b) => b - a))
  expect(first.events[0]!.kind).toBe('dish_added')

  const second = await events({ board: board.id, before: first.next! })
  // The 5 left: 4 dishes and the board_created event.
  expect(second.events).toHaveLength(5)
  expect(second.next).toBeNull()
  expect(second.events.every(e => e.id < first.next!)).toBe(true)
  expect(second.events.at(-1)!.kind).toBe('board_created')
})

test('the user filter matches part of a Username, whatever the case', async () => {
  const board = await boardWith('Nach Nutzer', await member())
  await addDish(await owner(), board.id, 'Von Besitzer')
  await addDish(await member(), board.id, 'Von Mitglied')
  const ownerName = await nameOf(await owner())
  const memberName = await nameOf(await member())

  const needle = ownerName.slice(1, -1).toUpperCase()
  const found = await events({ board: board.id, user: needle })
  expect(found.events.length).toBeGreaterThan(0)
  expect(found.events.every(e => e.user !== 'deleted' && e.user !== 'signed-out' && e.user.name.toLowerCase().includes(needle.toLowerCase()))).toBe(true)
  expect(found.events.map(dishTitle)).toContain('Von Besitzer')
  if (!memberName.toLowerCase().includes(needle.toLowerCase())) expect(found.events.map(dishTitle)).not.toContain('Von Mitglied')
  // A wildcard is no wildcard.
  expect((await events({ board: board.id, user: '%' })).events).toHaveLength(0)
})

test('the Board filter leaves out other Boards, and the kinds filter takes a group\'s kinds', async () => {
  const ada = await owner()
  const one = await boardWith('Eins')
  const two = await boardWith('Zwei')
  const dish = await addDish(ada, one.id, 'Nur auf Eins')
  await addDish(ada, two.id, 'Nur auf Zwei')
  expect((await post(ada, `/api/dishes/${dish.id}/comments`, { text: 'Hallo' })).status).toBe(201)

  const all = await events({ board: one.id })
  expect(all.events.every(e => e.board !== null && e.board !== 'deleted' && e.board.id === one.id)).toBe(true)
  expect(new Set(all.events.map(e => e.kind))).toEqual(new Set(['board_created', 'dish_added', 'comment_written']))

  const talk = await events({ board: one.id, kinds: EVENT_GROUPS.talk.join(',') })
  expect(talk.events.map(e => e.kind)).toEqual(['comment_written'])
  const dishes = await events({ board: one.id, kinds: EVENT_GROUPS.dishes.join(',') })
  expect(dishes.events.map(e => e.kind)).toEqual(['dish_added'])
})

test('the time range counts whole days in UTC, both ends included', async () => {
  const ada = await owner()
  const board = await boardWith('Alt und neu')
  await addDish(ada, board.id, 'Alt')
  await backdateBoardEvents(board.id, 10)
  await addDish(ada, board.id, 'Neu')
  const day = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)
  const titles = async (params: Record<string, string>) =>
    (await events({ board: board.id, kinds: 'dish_added', ...params })).events.map(dishTitle)

  expect(await titles({})).toEqual(['Neu', 'Alt'])
  expect(await titles({ from: day(3) })).toEqual(['Neu'])
  expect(await titles({ to: day(3) })).toEqual(['Alt'])
  expect(await titles({ from: day(10), to: day(10) })).toEqual(['Alt'])
  expect(await titles({ from: day(9), to: day(1) })).toEqual([])
  expect(await titles({ to: day(0) })).toEqual(['Neu', 'Alt'])
})

test('names and titles are the ones they have now', async () => {
  const ada = await owner()
  const board = await boardWith('Alter Name')
  const dish = await addDish(ada, board.id, 'Alter Titel')
  expect((await patch(ada, `/api/boards/${board.id}`, { name: 'Neuer Name' })).status).toBe(200)
  expect((await patch(ada, `/api/dishes/${dish.id}`, { title: 'Neuer Titel' })).status).toBe(200)

  const page = await events({ board: board.id })
  const added = ofKind(page, 'dish_added')
  expect(added).toHaveLength(1)
  expect(added[0]!.board).toMatchObject({ name: 'Neuer Name', archived: false })
  expect(added[0]!.dish).toMatchObject({ title: 'Neuer Titel', archived: false })
  expect(ofKind(page, 'board_created')[0]!.board).toMatchObject({ name: 'Neuer Name' })
})

test('what is gone shows as gone: a Deleted Account, a purged Dish, an archived one, deleted and edited Comments', async () => {
  const ada = await owner()
  const leaver = await signIn(LEAVER)
  const board = await boardWith('Gelöschtes', leaver)
  const archivedDish = await addDish(ada, board.id, 'Archivierte Suppe')
  const purgedDish = await addDish(leaver, board.id, 'Weg damit')
  const talkedDish = await addDish(ada, board.id, 'Mit Kommentaren')
  const comment = async (text: string) => (await (await post(ada, `/api/dishes/${talkedDish.id}/comments`, { text })).json() as { id: string }).id
  const deleted = await comment('Wird gelöscht')
  const edited = await comment('Erste Fassung')
  expect((await patch(ada, `/api/comments/${edited}`, { text: 'Zweite Fassung' })).status).toBe(200)
  expect((await ada.fetch(`/api/comments/${deleted}`, { method: 'DELETE' })).status).toBe(204)
  expect((await ada.fetch(`/api/dishes/${archivedDish.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await ada.fetch(`/api/dishes/${purgedDish.id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await post(ada, `/api/dishes/${purgedDish.id}/purge`)).status).toBe(204)
  expect((await leaver.fetch('/api/me', { method: 'DELETE', ...json({ username: await nameOf(leaver) }) })).status).toBeLessThan(300)

  const page = await events({ board: board.id })
  expect(page.events.find(e => e.kind === 'member_joined')!.user).toBe('deleted')
  expect(page.events.find(e => e.kind === 'dish_added' && e.user === 'deleted')).toBeDefined()
  expect(ofKind(page, 'dish_archived').map(e => e.dish)).toContainEqual(expect.objectContaining({ title: 'Archivierte Suppe', archived: true }))
  expect(ofKind(page, 'dish_deleted')[0]!.dish).toBe('deleted')
  expect(ofKind(page, 'dish_added').filter(e => e.dish === 'deleted')).toHaveLength(1)
  expect(ofKind(page, 'comment_written').map(e => e.comment).reverse()).toEqual(['deleted', { text: 'Zweite Fassung' }])
  expect(ofKind(page, 'comment_edited')[0]!.comment).toEqual({ text: 'Zweite Fassung' })
  expect(ofKind(page, 'comment_deleted')[0]!.comment).toBe('deleted')
})

test('an Archived Board shows archived, a purged one deleted', async () => {
  const ada = await owner()
  const board = await boardWith('Wird archiviert')
  expect((await ada.fetch(`/api/boards/${board.id}`, { method: 'DELETE' })).status).toBe(204)
  expect(ofKind(await events({ board: board.id }), 'board_archived')[0]!.board).toMatchObject({ name: 'Wird archiviert', archived: true })

  expect((await post(ada, `/api/boards/${board.id}/purge`)).status).toBe(204)
  const page = await events({ board: board.id })
  expect(page.events.length).toBeGreaterThan(0)
  expect(page.events.every(e => e.board === 'deleted')).toBe(true)
})

test('a Member, a Column and the Permission of an event are named', async () => {
  const ada = await owner()
  const grace = await member()
  const board = await boardWith('Mit Mitgliedern', grace)
  const me = await (await grace.fetch('/api/me')).json() as { id: string, name: string }
  expect((await patch(ada, `/api/boards/${board.id}/members/${me.id}/permissions`, { addDishes: false })).status).toBe(200)
  expect((await patch(ada, `/api/columns/${board.firstColumn}`, { name: 'Umbenannt' })).status).toBe(200)

  const page = await events({ board: board.id })
  const changed = ofKind(page, 'permission_changed')[0]!
  expect(changed.member).toEqual({ id: me.id, name: me.name })
  expect(changed.details).toEqual({ permission: 'addDishes', on: false })
  expect(ofKind(page, 'column_renamed')[0]!.column).toEqual({ name: 'Umbenannt' })
})

test('a Dish Link opened signed out shows nobody was signed in', async () => {
  const ada = await owner()
  const board = await boardWith('Geteilt')
  const dish = await addDish(ada, board.id, 'Zum Teilen')
  const { path } = await (await post(ada, `/api/dishes/${dish.id}/link`)).json() as { path: string }
  expect((await anonymous().fetch(`/api/dish-links/${path.replace('/d/', '')}`)).status).toBe(200)

  const opened = ofKind(await events({ board: board.id }), 'dish_link_opened')
  expect(opened).toHaveLength(1)
  expect(opened[0]!.user).toBe('signed-out')
  expect(opened[0]!.details).toEqual({ signedIn: false })
})
