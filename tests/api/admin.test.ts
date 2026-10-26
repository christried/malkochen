import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { afterAll, beforeAll, expect, inject, test } from 'vitest'
import type { AdminFigures, Period } from '../../shared/admin'
import { OPERATOR } from '../support/test-auth-env'
import { startResendService, type ResendService } from '../support/resend-service'
import { landingBoard, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { linkGoogleAccount } from './time-travel'

// The Operator and the Admin Page (#348, PRD #321 stories 26–33): GET
// /api/admin answers the Operator (OPERATOR_EMAIL) the figures of how
// malkochen is used, and "not found" to anyone else, signed in or not.
// /api/me tells the app whether to show the Admin link. The figures are
// counted from the event log and the tables, never content. Babbage is the
// Operator; Boole and Shannon are used by this file only.

const BOOLE = ALLOWLISTED.indexOf('boole@example.com')
const SHANNON = ALLOWLISTED.indexOf('shannon@example.com')

interface Column { id: string, isGekocht: boolean }
interface Board { id: string, columns: Column[] }
interface Dish { id: string }

const json = (body: unknown): RequestInit => ({ headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const post = (caller: Caller, path: string, body?: unknown) =>
  caller.fetch(path, { method: 'POST', ...body === undefined ? {} : json(body) })

const operator = () => signIn(OPERATOR)

async function figures(): Promise<AdminFigures> {
  const res = await (await operator()).fetch('/api/admin')
  expect(res.status).toBe(200)
  return res.json()
}

async function addDish(caller: Caller, boardId: string, title: string, extra: Record<string, unknown> = {}): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl', ...extra })
  expect(res.status).toBe(201)
  return res.json()
}

// What changed in a Period between two answers, every count.
function grown(before: Period, after: Period) {
  expect(after.start).toBe(before.start)
  const dishes = Object.fromEntries(Object.entries(after.dishes).map(([kind, n]) => [kind, n - before.dishes[kind as keyof Period['dishes']]]))
  return {
    dishes,
    moves: after.moves - before.moves,
    cookings: after.cookings - before.cookings,
    comments: after.comments - before.comments,
    votes: after.votes - before.votes,
    archived: after.archived - before.archived,
  }
}

let resend: ResendService

beforeAll(async () => {
  resend = await startResendService()
})

afterAll(() => resend.close())

test('the admin endpoint is "not found" for anyone but the Operator, signed in or not', async () => {
  const boole = await signIn(ALLOWLISTED[BOOLE]!)

  expect((await boole.fetch('/api/admin')).status).toBe(404)
  expect((await anonymous().fetch('/api/admin')).status).toBe(404)
  expect((await (await operator()).fetch('/api/admin')).status).toBe(200)
})

test('/api/me says only to the Operator that they are it', async () => {
  const me = async (caller: Caller) => (await (await caller.fetch('/api/me')).json()) as { isOperator: boolean }

  expect((await me(await operator())).isOperator).toBe(true)
  expect((await me(await signIn(ALLOWLISTED[BOOLE]!))).isOperator).toBe(false)
})

test('the days and weeks count Dishes added by Source, moves, Cookings, Comments, Votes and archived Dishes', async () => {
  const boole = await signIn(ALLOWLISTED[BOOLE]!)
  const board = await landingBoard<Board>(boole)
  const gekocht = board.columns.find(c => c.isGekocht)!
  const before = await figures()

  await addDish(boole, board.id, 'Shakshuka', { source: { link: 'https://www.tiktok.com/@koch/video/7300000000000000002' } })
  await addDish(boole, board.id, 'Shorts-Curry', { source: { link: 'https://www.youtube.com/shorts/abcdefghijk' } })
  const plain = await addDish(boole, board.id, 'Linsensuppe')
  const archived = await addDish(boole, board.id, 'Apfelkuchen')
  const moved = await addDish(boole, board.id, 'Rührei')
  // A reorder within its Column isn't a move.
  expect((await post(boole, `/api/dishes/${moved.id}/move`, { columnId: board.columns[0]!.id, index: 1 })).status).toBe(200)
  expect((await post(boole, `/api/dishes/${moved.id}/move`, { columnId: board.columns[1]!.id })).status).toBe(200)
  expect((await post(boole, `/api/dishes/${plain.id}/move`, { columnId: gekocht.id })).status).toBe(200)
  expect((await post(boole, `/api/dishes/${plain.id}/cook`)).status).toBe(200)
  expect((await post(boole, `/api/dishes/${plain.id}/comments`, { text: 'Mehr Kreuzkümmel' })).status).toBe(201)
  expect((await boole.fetch(`/api/dishes/${plain.id}/vote`, { method: 'PUT', ...json({ up: true }) })).status).toBe(200)
  expect((await boole.fetch(`/api/dishes/${archived.id}`, { method: 'DELETE' })).status).toBe(204)

  const after = await figures()
  // Two moves, one of them into Gekocht; that one and "Gekocht ✓" on the
  // Dish already there are two Cookings.
  const expected = {
    dishes: { 'tiktok': 1, 'instagram-reel': 0, 'instagram-post': 0, 'youtube-short': 1, 'pinterest-pin': 0, 'blog': 0, 'other': 0, 'none': 3 },
    moves: 2,
    cookings: 2,
    comments: 1,
    votes: 1,
    archived: 1,
  }
  expect(grown(before.days[0]!, after.days[0]!)).toEqual(expected)
  expect(grown(before.weeks[0]!, after.weeks[0]!)).toEqual(expected)
  expect(after.days).toHaveLength(14)
  expect(after.weeks).toHaveLength(8)
})

test('active users and Boards count whoever did something on a Board, today, this week and this month', async () => {
  const boole = await signIn(ALLOWLISTED[BOOLE]!)
  const board = await landingBoard<Board>(boole)
  await addDish(boole, board.id, 'Rührei')

  const { active } = await figures()

  for (const period of [active.today, active.week, active.month]) {
    expect(period.users).toBeGreaterThanOrEqual(1)
    expect(period.boards).toBeGreaterThanOrEqual(1)
  }
  expect(active.week.users).toBeGreaterThanOrEqual(active.today.users)
  expect(active.month.boards).toBeGreaterThanOrEqual(active.week.boards)
})

test('a Push Notification sent (#399) makes its recipient no one active, on no Board counted', async () => {
  const before = (await figures()).active
  // What the push_sent of a Board whose recipient did nothing else looks
  // like in the log: a user and a Board the figures hold nowhere else.
  const client = new pg.Client({ connectionString: inject('databaseUrl') })
  await client.connect()
  try {
    await client.query(`insert into event_log (kind, board_id, dish_id, user_id, details) values ('push_sent', $1, null, 'admin-push-probe', '{"outcome":"sent"}')`, [randomUUID()])
  }
  finally {
    await client.end()
  }

  expect((await figures()).active).toEqual(before)
})

test('sign-ups count per day by how the user first signed in, Google or email', async () => {
  const before = (await figures()).signUps[0]!

  await signIn(ALLOWLISTED[SHANNON]!)
  await linkGoogleAccount(ALLOWLISTED[SHANNON]!)
  // The dev sign-in leaves no Google account, as an email sign-in doesn't.
  await signIn('church@example.com')

  const after = (await figures()).signUps[0]!
  expect(after.start).toBe(before.start)
  expect({ google: after.google - before.google, email: after.email - before.email }).toEqual({ google: 1, email: 1 })
})

test('the free limits: database size, Blob storage, emails sent and estimated function calls', async () => {
  const before = (await figures()).limits

  // An email that goes out: the confirmation of a deleted account.
  const shannon = await signIn(ALLOWLISTED[SHANNON]!)
  const { name } = await (await shannon.fetch('/api/me')).json() as { name: string }
  expect((await shannon.fetch('/api/me', { method: 'DELETE', ...json({ username: name }) })).status).toBe(204)
  expect(resend.sent.filter(e => e.to.includes(ALLOWLISTED[SHANNON]!))).toHaveLength(1)
  // The polls of an open Board, counted one in ten, ten at a time.
  const boole = await signIn(ALLOWLISTED[BOOLE]!)
  const board = await landingBoard<Board>(boole)
  for (let i = 0; i < 200; i++) expect((await boole.fetch(`/api/boards/${board.id}/version`)).status).toBe(200)

  const after = (await figures()).limits
  expect(after.emailsMonth.used - before.emailsMonth.used).toBe(1)
  expect(after.emailsToday.used - before.emailsToday.used).toBe(1)
  const polled = after.functionCalls.used - before.functionCalls.used
  expect(polled).toBeGreaterThan(0)
  expect(polled % 10).toBe(0)
  expect(after.database.used).toBeGreaterThan(0)
  expect(after.blob.used).toBeGreaterThanOrEqual(0)
  expect(after.database.free).toBe(1_000_000_000)
  expect(after.blob.free).toBe(1_000_000_000)
  expect(after.emailsMonth.free).toBe(3_000)
  expect(after.emailsToday.free).toBe(100)
  expect(after.functionCalls.free).toBe(1_000_000)
})

test('the figures hold no content: no titles, Comments, emails or Usernames', async () => {
  const text = JSON.stringify(await figures())

  for (const content of ['Shakshuka', 'Linsensuppe', 'Kreuzkümmel', 'tiktok.com', 'boole', 'babbage', 'example.com']) {
    expect(text).not.toContain(content)
  }
})
