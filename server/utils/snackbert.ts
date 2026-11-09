import { and, eq } from 'drizzle-orm'
import { db } from '../db'
import { snackbert } from '../db/schema'
import { parseServerEnv } from '../env'
import { snackbertClientFrom, type SnackbertClient, type SnackbertReportAnswer, type SnackbertReportRequest } from '../snackbert'
import { detailsOf, userEvent, withEvents } from './events'

// Snackbert in Your Settings (CONTEXT.md, #423): only for people with a
// Snackbert account, matched by their email address. Each user's switch is
// kept here, and whether they have an account is asked of Snackbert once a
// day at most (the answer is remembered in the row meanwhile), except when
// they switch it on, which always asks. Without SNACKBERT_URL and
// SNACKBERT_SECRET, none of this is offered and nothing is asked.

const env = parseServerEnv(process.env)
const client: SnackbertClient | null = snackbertClientFrom(env)
export const snackbertOffered = client !== null

const DAY_MS = 24 * 60 * 60 * 1000

interface Remembered {
  hasAccount: boolean
  switchedOn: boolean
  checkedAt: Date
}

async function rememberedFor(userId: string): Promise<Remembered | null> {
  const [row] = await db.select().from(snackbert).where(eq(snackbert.userId, userId))
  return row ?? null
}

// Snackbert's answer for `email`, or null when it can't say (already logged
// without the address: the client's errors never carry it).
async function askSnackbert(snackbertClient: SnackbertClient, email: string): Promise<boolean | null> {
  try {
    return await snackbertClient.hasAccount(email)
  }
  catch (err) {
    console.warn(`[snackbert] account check failed: ${err instanceof Error ? err.message : 'unknown error'}`)
    return null
  }
}

// Remembers Snackbert's answer and when it came. The switch stays as it is.
async function rememberAnswer(userId: string, hasAccount: boolean): Promise<void> {
  const checkedAt = new Date()
  await db
    .insert(snackbert)
    .values({ userId, hasAccount, checkedAt })
    .onConflictDoUpdate({ target: snackbert.userId, set: { hasAccount, checkedAt } })
}

// A switch in the event log (#399) only when it was off: a row switched on.
async function switchOn(userId: string): Promise<void> {
  await withEvents(
    db,
    db.update(snackbert).set({ switchedOn: true }).where(and(eq(snackbert.userId, userId), eq(snackbert.switchedOn, false))).returning({ userId: snackbert.userId }),
    userEvent('snackbert_switched', userId, detailsOf({ on: true })),
    { once: true },
  )
}

// Switches Snackbert off for a user, whatever Snackbert says. A switch in
// the event log (#399) only when it was on: off already, nothing changes.
export async function switchSnackbertOff(userId: string): Promise<void> {
  await withEvents(
    db,
    db.update(snackbert).set({ switchedOn: false }).where(and(eq(snackbert.userId, userId), eq(snackbert.switchedOn, true))).returning({ userId: snackbert.userId }),
    userEvent('snackbert_switched', userId, detailsOf({ on: false })),
    { once: true },
  )
}

// Whether the user has a Snackbert account (`available`) and has Snackbert
// switched on (`on`, only with an account). Asks Snackbert when its answer
// is a day old or more; when Snackbert can't be asked, what was remembered
// stands.
export async function snackbertFor(userId: string, email: string): Promise<{ available: boolean, on: boolean }> {
  if (!client) return { available: false, on: false }
  const row = await rememberedFor(userId)
  const stored = row
    ? { available: row.hasAccount, on: row.hasAccount && row.switchedOn }
    : { available: false, on: false }
  if (row && Date.now() - row.checkedAt.getTime() < DAY_MS) return stored

  const hasAccount = await askSnackbert(client, email)
  if (hasAccount === null) return stored
  await rememberAnswer(userId, hasAccount)
  // No account any more: Snackbert is switched off with it, and that is logged.
  if (!hasAccount && row?.switchedOn) await switchSnackbertOff(userId)
  return { available: hasAccount, on: hasAccount && (row?.switchedOn ?? false) }
}

// Switches Snackbert on for a user, asking Snackbert right then, whatever is
// remembered. 'no-account': Snackbert has none for the address (and it's
// switched off, if it was on). 'unreachable': Snackbert didn't answer, and
// nothing changed.
export async function switchSnackbertOn(userId: string, email: string): Promise<'on' | 'no-account' | 'unreachable'> {
  if (!client) throw new Error('Snackbert is not set up')
  const hasAccount = await askSnackbert(client, email)
  if (hasAccount === null) return 'unreachable'
  await rememberAnswer(userId, hasAccount)
  if (!hasAccount) {
    await switchSnackbertOff(userId)
    return 'no-account'
  }
  await switchOn(userId)
  return 'on'
}

// Whether Snackbert is on for the user, as the switch remembers it: switched
// on, with an account as last answered. Never asks Snackbert, so no request
// waits on it. Off whenever Snackbert isn't set up.
export async function snackbertOn(userId: string): Promise<boolean> {
  if (!client) return false
  const row = await rememberedFor(userId)
  return row !== null && row.hasAccount && row.switchedOn
}

// Snackbert answered that the user has no account (on a Snackbert Report):
// the answer is remembered, and Snackbert switched off, which is logged.
export async function forgetSnackbertAccount(userId: string): Promise<void> {
  await rememberAnswer(userId, false)
  await switchSnackbertOff(userId)
}

// Sends a Snackbert Report (snackbert-reports.ts). 'failed' when Snackbert
// isn't set up, the same as when it can't be reached.
export function sendSnackbertReport(request: SnackbertReportRequest): Promise<SnackbertReportAnswer> {
  return client ? client.report(request) : Promise.resolve('failed')
}
