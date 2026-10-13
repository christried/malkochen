import { expect, test } from 'vitest'
import { landingBoard, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { endLimitWindow, useUpLimit } from './time-travel'

// Usernames (CONTEXT.md, issue #209): the name a user picks for themselves
// (PUT /api/me/username) and the only one malkochen shows of them. 2–24
// letters, digits, `_`, `.` or `-`, unique across the app whatever the case.
// The users below are used by this file only.

const TU = ALLOWLISTED[46]
const CHIEN = ALLOWLISTED[47]
const NETTIE = ALLOWLISTED[48]
const GERTY = ALLOWLISTED[49]
const MCCLINTOCK = ALLOWLISTED[50]
const ELION = ALLOWLISTED[51]
const ROSA = ALLOWLISTED[52]
const MEITNER = ALLOWLISTED[53]

interface Me { id: string, name: string, usernamePrompt: 'pick' | 'confirm' | null }
interface Refusal { data: { message: string } }
interface Person { id: string, name: string }
interface Dish { id: string, addedBy: Person | null, cookings: { recordedBy: Person | null }[] }
interface Board { id: string, inviteToken: string, members: Person[], columns: { dishes: Dish[] }[] }

const me = async (caller: Caller): Promise<Me> => (await caller.fetch('/api/me')).json()

function rename(caller: Caller, username: unknown) {
  return caller.fetch('/api/me/username', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username }),
  })
}

const messageOf = async (res: Response) => (await res.json() as Refusal).data.message

test('a new user has no Username and is asked to pick one; picking one answers who they are now', async () => {
  // As Google creates the user: with its name, and no Username yet.
  const tu = await signIn(TU, { name: 'Tu Youyou', username: 'none' })
  expect(await me(tu)).toMatchObject({ name: '', usernamePrompt: 'pick' })

  const res = await rename(tu, 'Tu')

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ name: 'Tu', usernamePrompt: null })
  expect(await me(tu)).toMatchObject({ name: 'Tu', usernamePrompt: null })
})

test.each([
  ['with an umlaut', 'Jörg'],
  ['with digits, _ . and -', 'k.oe_ch-1'],
  ['of 2 characters', 'Li'],
  ['of 24 characters', 'a'.repeat(24)],
  ['in another alphabet', 'Юлия'],
])('a Username %s is accepted', async (_, username) => {
  const chien = await signIn(CHIEN)

  const res = await rename(chien, username)

  expect(res.status).toBe(200)
  expect((await me(chien)).name).toBe(username)
})

test('the spaces around a typed Username are left out', async () => {
  const chien = await signIn(CHIEN)

  expect((await rename(chien, '  Chien  ')).status).toBe(200)

  expect((await me(chien)).name).toBe('Chien')
})

test.each([
  ['too short', 'A', 'Mindestens 2 Zeichen.'],
  ['empty', '', 'Mindestens 2 Zeichen.'],
  ['too long', 'a'.repeat(25), 'Höchstens 24 Zeichen.'],
  ['with a space', 'Nettie Stevens', 'Nur Buchstaben, Ziffern und _ . - sind erlaubt.'],
  ['with an @', '@nettie', 'Nur Buchstaben, Ziffern und _ . - sind erlaubt.'],
  ['with an emoji', 'Nettie🍜', 'Nur Buchstaben, Ziffern und _ . - sind erlaubt.'],
])('a Username that is %s is refused (400) with what is wrong, in German', async (_, username, message) => {
  const nettie = await signIn(NETTIE, { name: 'Nettie' })

  const res = await rename(nettie, username)

  expect(res.status).toBe(400)
  expect(await messageOf(res)).toBe(message)
  expect((await me(nettie)).name).toBe('Nettie')
})

test.each([
  ['a number', 42],
  ['nothing', undefined],
])('%s instead of a Username is refused (400)', async (_, username) => {
  expect((await rename(await signIn(NETTIE, { name: 'Nettie' }), username)).status).toBe(400)
})

test('a Username someone else has is refused (409), whatever the case', async () => {
  const gerty = await signIn(GERTY, { name: 'Gerty' })
  const barbara = await signIn(MCCLINTOCK, { name: 'Barbara' })
  expect((await rename(gerty, 'Gerty')).status).toBe(200)

  for (const taken of ['Gerty', 'gerty', 'GERTY']) {
    const res = await rename(barbara, taken)
    expect(res.status, taken).toBe(409)
    expect(await messageOf(res)).toBe('Den Namen gibt es schon. Probier einen anderen.')
  }
  expect((await me(barbara)).name).not.toMatch(/gerty/i)
})

test('a user can change only the case of their own Username', async () => {
  const gerty = await signIn(GERTY, { name: 'Gerty' })
  expect((await rename(gerty, 'Gerty')).status).toBe(200)

  expect((await rename(gerty, 'gerty')).status).toBe(200)

  expect((await me(gerty)).name).toBe('gerty')
})

test('after a rename, the old Username is free for someone else right away', async () => {
  const gerty = await signIn(GERTY, { name: 'Gerty' })
  const barbara = await signIn(MCCLINTOCK, { name: 'Barbara' })
  expect((await rename(gerty, 'Cori')).status).toBe(200)
  expect((await rename(barbara, 'Cori')).status).toBe(409)

  expect((await rename(gerty, 'Gerty.C')).status).toBe(200)

  expect((await rename(barbara, 'Cori')).status).toBe(200)
  expect((await me(barbara)).name).toBe('Cori')
})

test('a user from before Usernames is asked once whether theirs fits: keeping it ends that', async () => {
  // As the migration left them: a Username from their Google first name.
  const elion = await signIn(ELION, { name: 'Gertrude Elion', username: 'suggested' })
  expect(await me(elion)).toMatchObject({ name: 'Gertrude', usernamePrompt: 'confirm' })

  const res = await rename(elion, 'Gertrude')

  expect(res.status).toBe(200)
  expect(await res.json()).toMatchObject({ name: 'Gertrude', usernamePrompt: null })
  // Signing in again doesn't bring it back.
  expect(await me(await signIn(ELION))).toMatchObject({ name: 'Gertrude', usernamePrompt: null })
})

test('the 11th change within a day is refused (429) with a message; keeping the name and refused ones don’t count', async () => {
  const rosa = await signIn(ROSA, { name: 'Rosa' })
  await useUpLimit(ROSA, 'username', 9)
  // None of these is a change.
  expect((await rename(rosa, 'Rosa')).status).toBe(200)
  expect((await rename(rosa, 'R')).status).toBe(400)

  expect((await rename(rosa, 'Rosa10')).status).toBe(200)
  const eleventh = await rename(rosa, 'Rosa11')

  expect(eleventh.status).toBe(429)
  expect(await messageOf(eleventh)).toBe('Das waren viele Namen für einen Tag. Morgen kannst du ihn wieder ändern.')
  expect((await me(rosa)).name).toBe('Rosa10')

  await endLimitWindow(ROSA, 'username')
  expect((await rename(rosa, 'Rosa11')).status).toBe(200)
})

test('every other Member sees the Username, wherever the user shows, and nowhere their Google name', async () => {
  const owner = await signIn(TU, { name: 'Tu Youyou', username: 'none' })
  const other = await signIn(CHIEN)
  expect((await rename(owner, 'Artemisia')).status).toBe(200)
  const board = await landingBoard<Board>(owner)
  expect((await other.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  const added = await postDish(owner, board.id, { title: 'Linsencurry', placeholder: 'bowl' })
  const dish = await added.clone().json() as Dish
  // The Dish as the app shows it straight after adding it.
  expect(dish.addedBy).toMatchObject({ name: 'Artemisia' })
  expect((await owner.fetch(`/api/dishes/${dish.id}/cook`, { method: 'POST' })).status).toBe(200)

  expect((await rename(owner, 'Qinghao')).status).toBe(200)

  const ownerId = (await me(owner)).id
  const seen = await other.fetch(`/api/boards/${board.id}`)
  const seenBoard = await seen.clone().json() as Board
  expect(seenBoard.members.find(m => m.id === ownerId)).toMatchObject({ name: 'Qinghao' })
  const seenDish = seenBoard.columns.flatMap(c => c.dishes).find(d => d.id === dish.id)!
  expect(seenDish.addedBy).toMatchObject({ name: 'Qinghao' })
  expect(seenDish.cookings[0]!.recordedBy).toMatchObject({ name: 'Qinghao' })
  const listed = await other.fetch('/api/boards')
  expect((await listed.clone().json() as Board[]).find(b => b.id === board.id)!.members.find(m => m.id === ownerId)).toMatchObject({ name: 'Qinghao' })
  const invite = await anonymous().fetch(`/api/invites/${board.inviteToken}`)
  expect(await invite.clone().json()).toMatchObject({ owner: { name: 'Qinghao' } })
  for (const res of [added, seen, listed, invite, await owner.fetch('/api/me')]) expect(await res.text()).not.toContain('Youyou')
})

test('until a new user has picked a Username, the API lets them do nothing but follow an Invite Link', async () => {
  const owner = await signIn(CHIEN)
  const board = await landingBoard<Board>(owner)
  const lise = await signIn(MEITNER, { name: 'Lise Meitner', username: 'none' })

  expect((await lise.fetch('/api/boards/landing')).status).toBe(403)
  expect((await lise.fetch('/api/boards')).status).toBe(403)
  expect((await lise.fetch('/api/boards', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Zu früh', emoji: '🥕' }) })).status).toBe(403)
  expect((await lise.fetch('/api/me')).status).toBe(200)
  expect((await lise.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  // A Member now, but still without a name: the Board stays closed to them.
  expect((await lise.fetch(`/api/boards/${board.id}`)).status).toBe(403)
  expect((await postDish(lise, board.id, { title: 'Zu früh', placeholder: 'bowl' })).status).toBe(403)

  expect((await rename(lise, 'Lise')).status).toBe(200)
  expect((await lise.fetch(`/api/boards/${board.id}`)).status).toBe(200)
})

test('a Member who hasn’t picked a Username yet shows without their Google name', async () => {
  const owner = await signIn(CHIEN)
  const board = await landingBoard<Board>(owner)
  const hedwig = await signIn(ALLOWLISTED[58], { name: 'Hedwig Kohn', username: 'none' })
  expect((await hedwig.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(200)

  const seen = await (await owner.fetch(`/api/boards/${board.id}`)).text()

  expect(seen).not.toContain('Hedwig')
  expect((JSON.parse(seen) as Board).members.map(m => m.name)).toContain('Neu dabei')
})

test('only a signed-in user can set a Username', async () => {
  expect((await rename(anonymous(), 'Niemand')).status).toBe(401)
})
