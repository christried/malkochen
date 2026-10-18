import { expect, test } from 'vitest'
import { landingBoard } from './boards'
import { ALLOWLISTED, signIn, speaking, type Caller } from './client'

// What the server writes for a caller (#328), in the caller's language: their
// choice under Sprache, else what their browser asks for (Accept-Language),
// else English. The default Columns of a new Board, the Username rules'
// messages and the name of someone without a Username yet. Every other API
// test asks for German (tests/api/client.ts). The users below are used by
// this file only.

const CLARKE = ALLOWLISTED[78]
const HOLBERTON = ALLOWLISTED[79]
const SPENCE = ALLOWLISTED[80]

interface Column { name: string, subtitle: string | null, isGekocht: boolean }
interface Board { id: string, name: string, inviteToken: string, columns: Column[], members: { name: string }[] }

function send(caller: Caller, method: string, path: string, body?: unknown) {
  return caller.fetch(path, { method, headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
}

const choose = (caller: Caller, language: string) => send(caller, 'PUT', '/api/me/language', { language })
const boardOf = async (caller: Caller, id: string) => (await caller.fetch(`/api/boards/${id}`)).json() as Promise<Board>

async function newBoard(caller: Caller): Promise<Board> {
  const res = await send(caller, 'POST', '/api/boards', { name: 'Sprachen', emoji: '🌍' })
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  return boardOf(caller, id)
}

const columns = (board: Board) => board.columns.map(({ name, subtitle }) => [name, subtitle])

test('a new Board\'s Columns are in the language of the browser that created it', async () => {
  const clarke = await signIn(CLARKE)

  expect(columns(await newBoard(speaking(clarke, 'en-GB,en;q=0.9')))).toEqual([['Ideas', 'What do you fancy?'], ['This week', 'Coming up.'], ['Cooked', null]])
  expect(columns(await newBoard(speaking(clarke, 'it-CH')))).toEqual([['Idee', 'Cosa ti va?'], ['Questa settimana', 'In programma.'], ['Cucinati', null]])
  // A language malkochen doesn't speak: English.
  expect(columns(await newBoard(speaking(clarke, 'fr-FR,fr')))[0]).toEqual(['Ideas', 'What do you fancy?'])
})

test('the creator\'s chosen language beats their browser\'s; Boards made before stay as they are', async () => {
  const holberton = await signIn(HOLBERTON)
  const before = await newBoard(holberton)

  await choose(holberton, 'it')
  const after = await newBoard(speaking(holberton, 'en'))

  expect(columns(after)[0]).toEqual(['Idee', 'Cosa ti va?'])
  expect(columns(await boardOf(holberton, before.id))[0]).toEqual(['Ideen', 'Worauf hast du Lust?'])
  await choose(holberton, 'auto')
})

test('the Board a first sign-in lands on is named in the language of that browser', async () => {
  const spence = speaking(await signIn(SPENCE), 'en-US')

  const board = await landingBoard<Board>(spence)

  expect(board.name).toBe('My kitchen')
  expect(columns(board)[1]).toEqual(['This week', 'Coming up.'])
})

test('the Username rules answer in the caller\'s language', async () => {
  const clarke = await signIn(CLARKE)
  const rename = (caller: Caller, username: string) => send(caller, 'PUT', '/api/me/username', { username })
  const message = async (res: Response) => (await res.json() as { data: { message: string } }).data.message

  expect(await message(await rename(speaking(clarke, 'en'), 'x'))).toBe('At least 2 characters.')
  expect(await message(await rename(speaking(clarke, 'it'), 'x'))).toBe('Almeno 2 caratteri.')
  expect(await message(await rename(clarke, 'x'))).toBe('Mindestens 2 Zeichen.')
})

test('someone without a Username yet shows in the caller\'s language', async () => {
  const holberton = await signIn(HOLBERTON)
  const board = await newBoard(holberton)
  const nameless = await signIn(ALLOWLISTED[81], { name: 'Frances Spence', username: 'none' })
  expect((await nameless.fetch(`/api/invites/${board.inviteToken}/join`, { method: 'POST' })).status).toBe(200)

  expect((await boardOf(speaking(holberton, 'en'), board.id)).members.map(m => m.name)).toContain('New here')
  expect((await boardOf(speaking(holberton, 'it'), board.id)).members.map(m => m.name)).toContain('Nuovo arrivo')
  expect((await boardOf(holberton, board.id)).members.map(m => m.name)).toContain('Neu dabei')
})
