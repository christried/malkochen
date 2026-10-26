import pg from 'pg'
import { beforeAll, afterAll, expect, inject, test } from 'vitest'
import type { SourceLookup, SourceLookupResult } from '../../server/source-lookup'
import { landingBoard as landingBoardOf, postDish } from './boards'
import { ALLOWLISTED, anonymous, signIn, type Caller } from './client'
import { CRON_SECRET } from './server-env'

// The backfill of Captions and playable videos for Dishes added before #393
// and #394 (server/utils/source-facts-fill.ts), run in this process against the
// test database with a stubbed Source Lookup, and the cron route over HTTP.

interface Board { id: string }
type FillModule = typeof import('../../server/utils/source-facts-fill')
let fill: FillModule
let db: pg.Client

const query = async (text: string, values: unknown[] = []) => (await db.query(text, values)).rows

const landingBoard = (caller: Caller) => landingBoardOf<Board>(caller)

beforeAll(async () => {
  // The server's own database, not the one in .env that the worker inherits.
  process.env.DATABASE_URL = inject('databaseUrl')
  fill = await import('../../server/utils/source-facts-fill')
  db = new pg.Client({ connectionString: inject('databaseUrl') })
  await db.connect()
})

afterAll(() => db?.end())

// Dishes added through the API, then left as the backfill sees Dishes from
// before #393 and #394: no playable video known, no Caption.
async function addDishes(caller: Caller, links: string[]): Promise<string[]> {
  const board = await landingBoard(caller)
  const ids: string[] = []
  for (const link of links) {
    const res = await postDish(caller, board.id, { title: 'Dal', placeholder: 'bowl', source: { link } })
    expect(res.status).toBe(201)
    ids.push((await res.json() as { id: string }).id)
  }
  await query(`update dish set playable_video = null, caption = null where id = any($1)`, [ids])
  return ids
}

// Only the Dishes of one test match the backfill, whatever the other test
// files left behind, and the setting starts not done.
async function startFresh(): Promise<void> {
  await query(`update dish set playable_video = false where playable_video is null`)
  await query(`update setting set source_facts_filled_at = null`)
}

const TIKTOK = 'https://www.tiktok.com/@scout2015/video/6718335390845095173'
const INSTAGRAM = 'https://www.instagram.com/reel/DFvsVH_OD9h/'

// A stub Source Lookup: what each link answers, and every call it gets. Each
// call moves `clock` on by `step`, for the time budget.
function stubLookup(answers: Record<string, SourceLookupResult | Error>, clock = { now: 0, step: 0 }) {
  const calls: string[] = []
  const lookup: SourceLookup = async (link) => {
    calls.push(link)
    clock.now += clock.step
    const answer = answers[link]
    if (answer instanceof Error) throw answer
    if (!answer) throw new Error(`no stub for ${link}`)
    return answer
  }
  return { lookup, calls, clock }
}

const found = (link: string, kind: SourceLookupResult['kind'], caption: string | null, playableVideo: boolean): SourceLookupResult => ({
  kind, canonicalLink: link, suggestedTitle: 'Dal', creator: null, imageUrl: null, caption, playableVideo,
})

async function dishRow(id: string): Promise<{ caption: string | null, playable_video: boolean | null }> {
  return (await query(`select caption, playable_video from dish where id = $1`, [id]))[0]
}

async function settingDone(): Promise<boolean> {
  return (await query(`select source_facts_filled_at is not null as done from setting`))[0].done
}

test('fills the Dishes of every kind, Archived ones and those on an Archived Board too', async () => {
  const ada = await signIn(ALLOWLISTED[172])
  await startFresh()
  const blog = 'http://127.0.0.1/rezept-linsen'
  const [tiktok, instagram, plain, archived, onArchivedBoard] = await addDishes(ada, [
    TIKTOK, INSTAGRAM, blog, 'http://127.0.0.1/archiviert', 'http://127.0.0.1/auf-archiviertem-board',
  ])
  await query(`update dish set deleted_at = now() where id = $1`, [archived])
  await query(`update board set deleted_at = now() where id = (select board_id from dish where id = $1)`, [onArchivedBoard])

  const { lookup } = stubLookup({
    [TIKTOK]: found(TIKTOK, 'tiktok', 'Tanz-Dal', true),
    [INSTAGRAM]: found(INSTAGRAM, 'instagram-reel', 'Vom Reel', true),
    [blog]: found(blog, 'blog', 'Ein Blogtext', false),
    'http://127.0.0.1/archiviert': found('http://127.0.0.1/archiviert', 'blog', null, false),
    'http://127.0.0.1/auf-archiviertem-board': found('http://127.0.0.1/auf-archiviertem-board', 'blog', null, false),
  })

  const report = await fill.fillSourceFacts({ lookup, budgetMs: 60_000, concurrency: 3, now: () => 0 })

  expect(report).toEqual({ done: true, filled: 5, unreachable: 0, left: 0 })
  expect(await dishRow(tiktok!)).toEqual({ caption: 'Tanz-Dal', playable_video: true })
  expect(await dishRow(instagram!)).toEqual({ caption: 'Vom Reel', playable_video: true })
  expect(await dishRow(plain!)).toEqual({ caption: 'Ein Blogtext', playable_video: false })
  expect(await dishRow(archived!)).toEqual({ caption: null, playable_video: false })
  expect(await dishRow(onArchivedBoard!)).toEqual({ caption: null, playable_video: false })
  expect(await settingDone()).toBe(true)
})

test('works a batch at a time within the time budget, and fills the rest on the next runs', async () => {
  const ada = await signIn(ALLOWLISTED[172])
  await startFresh()
  const links = [1, 2, 3, 4, 5].map(n => `http://127.0.0.1/batch-${n}`)
  const ids = await addDishes(ada, links)
  const answers = Object.fromEntries(links.map(link => [link, found(link, 'blog', null, false)]))
  const clock = { now: 0, step: 1000 }
  const { lookup, calls } = stubLookup(answers, clock)
  // Each run starts at time 0 with a budget of one second: one lookup costs a
  // second, so a batch of two runs and the budget is spent.
  const run = () => { clock.now = 0; return fill.fillSourceFacts({ lookup, budgetMs: 1000, concurrency: 2, now: () => clock.now }) }

  expect(await run()).toEqual({ done: false, filled: 2, unreachable: 0, left: 3 })
  expect(await run()).toEqual({ done: false, filled: 2, unreachable: 0, left: 1 })
  expect(await run()).toEqual({ done: true, filled: 1, unreachable: 0, left: 0 })
  expect(calls).toHaveLength(5)
  for (const id of ids) expect((await dishRow(id)).playable_video).toBe(false)
})

test('a Dish whose lookup fails is marked handled with no Caption, counted, and not asked again', async () => {
  const ada = await signIn(ALLOWLISTED[172])
  await startFresh()
  const broken = 'http://127.0.0.1/kaputt'
  const [id] = await addDishes(ada, [broken])
  const { lookup, calls } = stubLookup({ [broken]: new Error('timed out') })

  const report = await fill.fillSourceFacts({ lookup, budgetMs: 60_000, concurrency: 3, now: () => 0 })
  expect(report).toEqual({ done: true, filled: 1, unreachable: 1, left: 0 })
  expect(await dishRow(id!)).toEqual({ caption: null, playable_video: false })

  await query(`update setting set source_facts_filled_at = null`)
  const again = await fill.fillSourceFacts({ lookup, budgetMs: 60_000, concurrency: 3, now: () => 0 })
  expect(again).toEqual({ done: true, filled: 0, unreachable: 0, left: 0 })
  expect(calls).toEqual([broken])
})

test('a Caption already there is kept, and a Dish a Member edited meanwhile is not overwritten', async () => {
  const ada = await signIn(ALLOWLISTED[172])
  await startFresh()
  const withText = 'http://127.0.0.1/mit-text'
  const edited = 'http://127.0.0.1/bearbeitet'
  const [keptId, editedId] = await addDishes(ada, [withText, edited])
  await query(`update dish set caption = 'Mein Text' where id = $1`, [keptId])
  const lookup: SourceLookup = async (link) => {
    // A Member sets the video while the lookup is out.
    if (link === edited) await query(`update dish set playable_video = true where id = $1`, [editedId])
    return found(link, 'blog', 'Vom Blog', false)
  }

  await fill.fillSourceFacts({ lookup, budgetMs: 60_000, concurrency: 3, now: () => 0 })

  expect(await dishRow(keptId!)).toEqual({ caption: 'Mein Text', playable_video: false })
  expect(await dishRow(editedId!)).toEqual({ caption: null, playable_video: true })
})

test('once done, the backfill answers done at once and asks nothing', async () => {
  const ada = await signIn(ALLOWLISTED[172])
  await startFresh()
  const link = 'http://127.0.0.1/fertig'
  await addDishes(ada, [link])
  const { lookup, calls } = stubLookup({ [link]: found(link, 'blog', null, false) })
  await fill.fillSourceFacts({ lookup, budgetMs: 60_000, concurrency: 3, now: () => 0 })
  expect(calls).toHaveLength(1)

  const again = await fill.fillSourceFacts({ lookup, budgetMs: 60_000, concurrency: 3, now: () => 0 })

  expect(again).toEqual({ done: true, filled: 0, unreachable: 0, left: 0 })
  expect(calls).toHaveLength(1)
})

test('the cron route refuses without the secret, and answers the report with it', async () => {
  expect((await anonymous().fetch('/api/cron/source-facts')).status).toBe(401)
  expect((await anonymous().fetch('/api/cron/source-facts', { headers: { authorization: 'Bearer wrong' } })).status).toBe(401)

  const res = await anonymous().fetch('/api/cron/source-facts', { headers: { authorization: `Bearer ${CRON_SECRET}` } })

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ done: expect.any(Boolean), filled: expect.any(Number), unreachable: expect.any(Number), left: expect.any(Number) })
})
