import { afterAll, afterEach, beforeAll, beforeEach, expect, test } from 'vitest'
import { postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, speaking, type Caller } from './client'
import { startResendService, type ResendService, type SentEmail } from './resend-service'
import { CRON_SECRET } from './server-env'
import { TEST_RESEND_API_KEY } from '../support/test-auth-env'

// The Email Digest (#220): a Member switches it on in their settings (PUT
// /api/me/email-digest, DELETE switches it off), for all their Boards. Once a
// day Vercel Cron calls GET /api/cron/email-digest with CRON_SECRET, and each
// Member who switched it on gets one email listing the Dishes other Members
// added to their Boards since the last run, if there are any. The emails go
// to a stand-in for Resend, which keeps them. The users below are used by
// this file only.

const WU = ALLOWLISTED[66]
const CONWAY = ALLOWLISTED[67]
const PEREY = ALLOWLISTED[68]
const BLACKWELL = ALLOWLISTED[69]
const SAMMET = ALLOWLISTED[70]

interface Board { id: string, slug: string, name: string, emoji: string, inviteToken: string }
interface Dish { id: string, code: string }

let resend: ResendService

beforeAll(async () => {
  resend = await startResendService()
})

afterAll(() => resend.close())

beforeEach(() => resend.forget())

// Everyone a test switched it on for is off again after it, so the next
// test's run sends them nothing.
const switchedOn: Caller[] = []
afterEach(async () => {
  for (const caller of switchedOn.splice(0)) await switchOff(caller)
})

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })

const switchOn = (caller: Caller) => caller.fetch('/api/me/email-digest', { method: 'PUT' })
const switchOff = (caller: Caller) => caller.fetch('/api/me/email-digest', { method: 'DELETE' })

async function isOn(caller: Caller): Promise<boolean> {
  const res = await caller.fetch('/api/me/email-digest')
  expect(res.status).toBe(200)
  return (await res.json() as { on: boolean }).on
}

async function switchedOnFor(caller: Caller): Promise<Caller> {
  expect((await switchOn(caller)).status).toBe(204)
  switchedOn.push(caller)
  return caller
}

const runDigest = (authorization: string | null = `Bearer ${CRON_SECRET}`) =>
  anonymous().fetch('/api/cron/email-digest', authorization ? { headers: { authorization } } : {})

async function run() {
  expect((await runDigest()).status).toBe(200)
}

const usernameOf = async (caller: Caller): Promise<string> => (await (await caller.fetch('/api/me')).json() as { name: string }).name
const getBoard = (caller: Caller, id: string): Promise<Board> => caller.fetch(`/api/boards/${id}`).then(res => res.json())

// A new Board of `owner`'s, with `members` joined.
async function sharedBoard(owner: Caller, members: Caller[], name: string, emoji = '🍜'): Promise<Board> {
  const res = await owner.fetch('/api/boards', json('POST', { name, emoji }))
  expect(res.status).toBe(201)
  const { id } = await res.json() as { id: string }
  const { inviteToken } = await getBoard(owner, id)
  for (const member of members) {
    expect((await member.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  }
  return getBoard(owner, id)
}

async function addDish(caller: Caller, boardId: string, title: string): Promise<Dish> {
  const res = await postDish(caller, boardId, { title, placeholder: 'bowl' })
  expect(res.status).toBe(201)
  return res.json()
}

const emailsTo = (email: string): SentEmail[] => resend.sent.filter(e => e.to.includes(email))

test('the digest is off until a Member switches it on, and stays on in every session until they switch it off', async () => {
  const wu = await signIn(WU)
  expect(await isOn(wu)).toBe(false)

  await switchedOnFor(wu)
  expect(await isOn(wu)).toBe(true)
  // Another device: a session of its own.
  const wuElsewhere = await signIn(WU)
  expect(await isOn(wuElsewhere)).toBe(true)
  // Switching it on again changes nothing.
  expect((await switchOn(wuElsewhere)).status).toBe(204)
  expect(await isOn(wu)).toBe(true)

  expect((await switchOff(wuElsewhere)).status).toBe(204)
  expect(await isOn(wu)).toBe(false)
  expect((await switchOff(wu)).status).toBe(204)
  expect(await isOn(wu)).toBe(false)
})

test('only signed-in users have a digest switch', async () => {
  expect((await anonymous().fetch('/api/me/email-digest')).status).toBe(401)
  expect((await anonymous().fetch('/api/me/email-digest', { method: 'PUT' })).status).toBe(401)
})

test.each([
  ['no secret', null],
  ['a wrong secret', 'Bearer not-the-cron-secret-not-it'],
  ['the secret without "Bearer"', CRON_SECRET],
])('the job refuses a request with %s and sends nothing', async (_, authorization) => {
  const wu = await switchedOnFor(await signIn(WU))
  const conway = await signIn(CONWAY)
  const board = await sharedBoard(wu, [conway], 'Abendbrot')
  await addDish(conway, board.id, 'Ofengemüse')

  expect((await runDigest(authorization)).status).toBe(401)
  expect(resend.sent).toEqual([])

  // The Dish is still news for the next real run.
  await run()
  expect(emailsTo(WU)).toHaveLength(1)
})

test('the job is refused to a signed-in Member too', async () => {
  const wu = await signIn(WU)
  expect((await wu.fetch('/api/cron/email-digest')).status).toBe(401)
})

test('a Member who switched it on gets one email listing the Dishes others added, with the Board and who added each', async () => {
  const wu = await switchedOnFor(await signIn(WU))
  const conway = await signIn(CONWAY)
  const perey = await signIn(PEREY)
  const kochclub = await sharedBoard(wu, [conway, perey], 'Kochclub', '🍪')
  const sonntag = await sharedBoard(perey, [wu], 'Sonntag', '🥞')
  const linsen = await addDish(conway, kochclub.id, 'Linsensuppe')
  await addDish(perey, kochclub.id, 'Dal')
  await addDish(perey, sonntag.id, 'Pfannkuchen')

  await run()

  const emails = emailsTo(WU)
  expect(emails).toHaveLength(1)
  const [email] = emails
  expect(email!.to).toEqual([WU])
  expect(email!.from).toBe('malkochen <malkochen@christried.me>')
  expect(email!.subject).toBe('3 neue Gerichte auf deinen Boards')
  for (const part of [email!.text, email!.html]) {
    // Greeted by their Username.
    expect(part).toContain(`Hallo ${await usernameOf(wu)}!`)
    expect(part).toContain('🍪 Kochclub')
    expect(part).toContain('🥞 Sonntag')
    expect(part).toContain('Linsensuppe')
    expect(part).toContain('Dal')
    expect(part).toContain('Pfannkuchen')
    expect(part).toContain(`von ${await usernameOf(conway)}`)
    expect(part).toContain(`von ${await usernameOf(perey)}`)
    // Links back to the app.
    expect(part).toContain(`/b/${kochclub.slug}`)
    expect(part).toContain(`/b/${sonntag.slug}`)
    expect(part).toContain(`/b/${kochclub.slug}/linsensuppe-${linsen.code}`)
  }
  expect(resend.keys.every(key => key === `Bearer ${TEST_RESEND_API_KEY}`)).toBe(true)
  // Conway and Perey never switched it on.
  expect(emailsTo(CONWAY)).toEqual([])
  expect(emailsTo(PEREY)).toEqual([])
})

test('no email for a Member who switched it off, whose only new Dishes are their own, or who has nothing new', async () => {
  const wu = await switchedOnFor(await signIn(WU))
  const conway = await switchedOnFor(await signIn(CONWAY))
  const perey = await switchedOnFor(await signIn(PEREY))
  const blackwell = await signIn(BLACKWELL)
  const board = await sharedBoard(wu, [conway, blackwell], 'Mittagstisch')
  await sharedBoard(perey, [], 'Nur für mich')
  // Wu switched it off again.
  expect((await switchOff(wu)).status).toBe(204)
  // Conway's only new Dish is their own.
  await addDish(conway, board.id, 'Shakshuka')
  // A Dish deleted again is no news either.
  const deleted = await addDish(blackwell, board.id, 'Doch nicht')
  expect((await blackwell.fetch(`/api/dishes/${deleted.id}`, { method: 'DELETE' })).status).toBe(204)

  await run()

  expect(emailsTo(WU)).toEqual([])
  expect(emailsTo(CONWAY)).toEqual([])
  // Perey: nothing new at all.
  expect(emailsTo(PEREY)).toEqual([])
})

test('a Dish is listed once: the next day\'s digest has only what was added since', async () => {
  const wu = await switchedOnFor(await signIn(WU))
  const conway = await signIn(CONWAY)
  const board = await sharedBoard(wu, [conway], 'Wochenplan')
  await addDish(conway, board.id, 'Gnocchi')
  await run()
  expect(emailsTo(WU)).toHaveLength(1)

  resend.forget()
  await run()
  expect(emailsTo(WU)).toEqual([])

  await addDish(conway, board.id, 'Risotto')
  await run()
  const [email] = emailsTo(WU)
  expect(email!.text).toContain('Risotto')
  expect(email!.text).not.toContain('Gnocchi')
  expect(email!.subject).toBe('1 neues Gericht in 🍜 Wochenplan')
})

test('only Dishes of Boards the Member is on: never another Board\'s, nor what was added before they joined', async () => {
  const wu = await switchedOnFor(await signIn(WU))
  const conway = await signIn(CONWAY)
  const sammet = await signIn(SAMMET)
  const theirs = await sharedBoard(conway, [sammet], 'Ohne Wu')
  await addDish(sammet, theirs.id, 'Geheimrezept')
  const later = await sharedBoard(conway, [], 'Später dabei')
  await addDish(conway, later.id, 'Vor Wus Zeit')
  const { inviteToken } = await getBoard(conway, later.id)
  expect((await wu.fetch(`/api/invites/${inviteToken}/join`, { method: 'POST' })).status).toBe(200)
  await addDish(conway, later.id, 'Seit Wu dabei ist')

  await run()

  const [email] = emailsTo(WU)
  expect(email!.text).toContain('Seit Wu dabei ist')
  expect(email!.text).not.toContain('Vor Wus Zeit')
  expect(email!.text).not.toContain('Geheimrezept')
  expect(email!.text).not.toContain('Ohne Wu')
})

test('a digest Resend refused goes out with the next run, nothing lost', async () => {
  const wu = await switchedOnFor(await signIn(WU))
  const conway = await signIn(CONWAY)
  const board = await sharedBoard(wu, [conway], 'Vorratskammer')
  await addDish(conway, board.id, 'Kimchi')

  resend.answer(500)
  await run()
  expect(emailsTo(WU)).toEqual([])

  resend.answer(200)
  await run()
  const [email] = emailsTo(WU)
  expect(email!.text).toContain('Kimchi')
})

test('each recipient gets it in their own language: their choice, else what their browser asked for last (#328)', async () => {
  const wu = await switchedOnFor(await signIn(WU))
  // Perey's browser asks for English.
  const perey = speaking(await switchedOnFor(await signIn(PEREY)), 'en-US,en')
  const conway = await signIn(CONWAY)
  const board = await sharedBoard(conway, [wu, perey], 'Zweisprachig')
  expect((await wu.fetch('/api/me/language', json('PUT', { language: 'it' }))).status).toBe(200)

  try {
    await addDish(conway, board.id, 'Gnocchi')
    await run()

    expect(emailsTo(WU)[0]!.subject).toBe('1 nuovo piatto in 🍜 Zweisprachig')
    expect(emailsTo(PEREY)[0]!.subject).toBe('1 new dish in 🍜 Zweisprachig')
  }
  finally {
    await wu.fetch('/api/me/language', json('PUT', { language: 'auto' }))
  }
})
