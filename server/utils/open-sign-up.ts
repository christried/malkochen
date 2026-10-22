import { ne, sql } from 'drizzle-orm'
import { db } from '../db'
import { setting } from '../db/schema'
import { detailsOf, withEvents } from './events'

// Open Sign-up (CONTEXT.md, #350): the Operator's switch that lets anyone
// sign up. Off, only the Allowlist signs up. Either way, everyone who has
// an account signs in (server/utils/auth.ts).

export async function openSignUpOn(): Promise<boolean> {
  const [row] = await db.select({ on: setting.openSignUp }).from(setting)
  return row?.on ?? false
}

// Switches it on or off, recorded in the event log as an event of no Board
// by `userId`, the Operator. Already so: nothing changes, nothing recorded.
export async function switchOpenSignUp(on: boolean, userId: string): Promise<void> {
  await withEvents(
    db,
    db.update(setting).set({ openSignUp: on }).where(ne(setting.openSignUp, on)).returning({ id: setting.id }),
    { kind: 'open_sign_up_switched', board: sql`null`, user: userId, details: detailsOf({ on }) },
  )
}
