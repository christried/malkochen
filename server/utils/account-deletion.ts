import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { Language } from '../../shared/language'
import { db, runAtomic, type Db } from '../db'
import { archivedMembership, board, dish, eventLog, membership, user } from '../db/schema'
import { accountDeletedEmail } from '../email'
import { removeImageIfUnreferenced } from './cleanup'
import { boardEvent, recordEvents, userEvent, withEvents } from './events'
import { mailSender } from './mail'

// The confirmation email, when the Resend API key is set, like the Email
// Digest and the sign-in code.
const sendEmails = mailSender(reason => console.warn(`[account-deletion] confirmation not sent: ${reason}`))

type Memberships = typeof membership | typeof archivedMembership

// The Boards in `table` the user owns and nobody else is on: those their
// account takes along. Both tables, so an Archived Board counts by the
// Members it had.
function ownedAlone(table: Memberships, userId: string) {
  return sql`select m.board_id from ${table} m where m.user_id = ${userId} and m.is_owner
    and not exists (select 1 from ${table} o where o.board_id = m.board_id and o.user_id <> ${userId})`
}

// Hands each Board in `table` the user owns with others to its
// longest-standing Member (the earliest joined_at). The user steps down
// first, since the one-Owner index is checked row by row; then each of their
// Boards left without an Owner gets one.
function passOn(d: Db, table: Memberships, userId: string) {
  return [
    d.execute(sql`
      update ${table} m set is_owner = false
      where m.user_id = ${userId} and m.is_owner
        and exists (select 1 from ${table} o where o.board_id = m.board_id and o.user_id <> ${userId})
    `),
    d.execute(sql`
      update ${table} m set is_owner = true
      where (m.board_id, m.user_id) in (
        select distinct on (o.board_id) o.board_id, o.user_id from ${table} o
        where o.user_id <> ${userId}
          and o.board_id in (select board_id from ${table} where user_id = ${userId})
          and not exists (select 1 from ${table} w where w.board_id = o.board_id and w.is_owner)
        order by o.board_id, o.joined_at, o.user_id
      )
    `),
  ]
}

// "Konto löschen" (#346, CONTEXT.md: Deleted Account), in one transaction:
// the user's Boards with others pass on; Boards only they are on, live or
// archived, are deleted for good; the user goes, and with them (on delete
// cascade) their memberships, sessions, accounts, push subscriptions, Email
// Digest setting and limits. What they added stays, by nobody (on delete
// set null): Dishes, Cookings, Comments and Votes then show "Gelöschtes
// Konto". The event log keeps its rows, with them emptied out. Then the
// images only they used leave the Image Store, and the confirmation email
// goes out in `language`.
export async function deleteAccount(deleted: { id: string, email: string, username: string, ownPicture?: string | null }, language: Language): Promise<void> {
  const userId = deleted.id
  const alone = sql`(${ownedAlone(membership, userId)} union ${ownedAlone(archivedMembership, userId)})`
  const images = await db
    .select({ url: dish.imageUrl })
    .from(dish)
    .where(and(inArray(dish.boardId, alone), isNotNull(dish.imageUrl)))

  await runAtomic(d => [
    ...passOn(d, membership, userId),
    ...passOn(d, archivedMembership, userId),
    // Whatever they still own after passing on is theirs alone.
    withEvents(
      d,
      d.delete(board)
        .where(inArray(board.id, sql`(select board_id from ${membership} where user_id = ${userId} and is_owner
          union select board_id from ${archivedMembership} where user_id = ${userId} and is_owner)`))
        .returning({ id: board.id }),
      { ...boardEvent('board_deleted', userId), board: sql`changed.id` },
    ),
    // Their events stay for the counts, by nobody; so does a removal of
    // them, without whom.
    d.update(eventLog).set({ userId: null }).where(eq(eventLog.userId, userId)),
    d.execute(sql`update ${eventLog} set details = details - 'member' where details->>'member' = ${userId}`),
    // The deletion itself, by nobody (#399): after the line above, so that
    // it isn't emptied out with the rest.
    recordEvents(d, userEvent('account_deleted', null), sql``),
    d.delete(user).where(eq(user.id, userId)),
  ])

  const urls = [...images.map(i => i.url), deleted.ownPicture].filter(url => url != null)
  // The account is gone by now: an image that won't go is left to the daily
  // sweep rather than failing the deletion.
  for (const url of new Set(urls)) {
    await removeImageIfUnreferenced(url).catch((err: unknown) => console.warn(`[account-deletion] image not removed: ${err instanceof Error ? err.message : String(err)} (${url})`))
  }

  if (sendEmails) await sendEmails([accountDeletedEmail({ email: deleted.email, name: deleted.username, language })])
}
