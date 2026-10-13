import 'dotenv/config'
import pg from 'pg'
import { expect, test } from 'vitest'
import { migrateDatabase } from '../../server/db/migrate'
import { usernameProblem } from '../../shared/username'
import { migrationsBefore } from '../support/migrations'
import { createThrowawayDatabase, readAdminUrl } from '../support/throwaway-db'

// Usernames (issue #209): every user from before gets one made from their
// Google first name, with a number when it is taken, whatever the case; none
// is confirmed, so each is asked once whether theirs fits.

// Google names in the order the users signed up, and the Username each gets.
const USERS: [name: string, username: string][] = [
  ['Chris Tried', 'Chris'],
  ['chris', 'chris2'],
  ['CHRIS  Müller', 'CHRIS3'],
  // Taken by the one above, though it never was anyone's first name.
  ['Chris3', 'Chris32'],
  ['Jörg Über', 'Jörg'],
  ['  Anna-Lena Weiß ', 'Anna-Lena'],
  ['O\'Neil, Cathy', 'ONeil'],
  // What isn't a letter or digit goes, in any script: a curly apostrophe, an emoji.
  ['D’Artagnan', 'DArtagnan'],
  ['Ana✨ Lima', 'Ana'],
  // "ü" sent as u and two dots becomes the one character a keyboard types.
  ['Müller Lüdenscheidt', 'Müller'],
  ['MÜLLER', 'MÜLLER2'],
  ['Юлия Петрова', 'Юлия'],
  // Too short once cleaned: a stand-in.
  ['J. Doe', 'J.'],
  ['J', 'Koch'],
  ['!', 'Koch2'],
  ['Maximilian-Alexander-Friedrich von Habsburg', 'Maximilian-Alexander-Fri'],
  ['Maximilian-Alexander-Friedrich Zwei', 'Maximilian-Alexander-Fr2'],
]

test('the migration gives every user a Username from their Google first name, numbered when taken', async () => {
  const before = await migrationsBefore('0019_usernames')
  const database = await createThrowawayDatabase(readAdminUrl(), before.folder)
  const client = new pg.Client({ connectionString: database.url })
  try {
    await client.connect()
    await client.query(
      `insert into "user" (id, name, email, created_at)
       select 'user-' || i, name, 'user-' || i || '@example.com', now() + make_interval(secs => i)
       from unnest($1::text[]) with ordinality as names(name, i)`,
      [USERS.map(([name]) => name)],
    )

    await migrateDatabase(database.url)

    const users = await client.query<{ name: string, username: string, confirmed: Date | null }>(
      'select name, username, username_confirmed_at as confirmed from "user" order by created_at',
    )
    expect(users.rows.map(u => [u.name, u.username])).toEqual(USERS)
    expect(users.rows.every(u => u.confirmed === null)).toBe(true)
    for (const { username } of users.rows) expect(usernameProblem(username), username).toBeNull()

    // The database itself keeps two users from sharing one, whatever the case.
    await expect(client.query(`update "user" set username = 'JÖRG' where id = 'user-1'`)).rejects.toThrow(/user_username_lower_idx/)
  }
  finally {
    await client.end()
    await database.drop()
    await before.remove()
  }
})
