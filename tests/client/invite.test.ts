import { expect, test } from 'vitest'
import { invitePath, inviteSecret } from '../../shared/invite'

// Seam 4: readable Invite Links (issue #128). A link is the Board's slug,
// then its secret; only the secret counts, so a link stays good when the
// Board is renamed. Links from before (/invite/<token>) are a secret alone.

const SECRET = '7fk2qm9xh3tdz8wpc'
const OLD_TOKEN = '0123456789abcdef0123456789abcdef'

test('an Invite Link is the Board’s address, then its secret', () => {
  expect(invitePath({ slug: 'kochclub', inviteToken: SECRET })).toBe(`/invite/kochclub-${SECRET}`)
  expect(invitePath({ slug: 'kochclub-2', inviteToken: OLD_TOKEN })).toBe(`/invite/kochclub-2-${OLD_TOKEN}`)
})

test('only the secret at the end of a link counts, whatever comes before it', () => {
  expect(inviteSecret(`kochclub-${SECRET}`)).toBe(SECRET)
  expect(inviteSecret(`omas-alter-kochclub-2-${SECRET}`)).toBe(SECRET)
  expect(inviteSecret(`ganz-anders-${SECRET}`)).toBe(SECRET)
  expect(inviteSecret(`3b241101-e2bb-4255-8caf-4136c566a962-${SECRET}`)).toBe(SECRET)
  expect(inviteSecret(SECRET)).toBe(SECRET)
})

test('a link from before readable Invite Links is its token alone, and still counts', () => {
  expect(inviteSecret(OLD_TOKEN)).toBe(OLD_TOKEN)
  expect(inviteSecret(`kochclub-${OLD_TOKEN}`)).toBe(OLD_TOKEN)
})

test('a secret typed in capitals is the same secret', () => {
  expect(inviteSecret(`Kochclub-${SECRET.toUpperCase()}`)).toBe(SECRET)
})

test('anything that can’t end in a secret is no link', () => {
  for (const segment of ['', 'nope', 'kochclub', 'kochclub-', `kochclub-${SECRET}-`, `kochclub-${SECRET}x`, `kochclub-${SECRET.slice(1)}`, `kochclub-${SECRET.replace('7', '1')}`, OLD_TOKEN.slice(1), `${OLD_TOKEN}0`]) {
    expect(inviteSecret(segment), segment).toBeNull()
  }
})
