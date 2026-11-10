// Relative imports, not `~~`: runs in plain Node under test, like the Board
// module.
import type { DeviceStore } from './device-store'

// Unsent Changes are only ever sent as the user who made them (CONTEXT.md;
// ADR 0012; spec #456, ticket #463). These are the questions that come up
// when the account changes: signing out, and someone else signing in on a
// device that still holds another user's. Each asks the user first and
// discards only on their go-ahead. Plain functions over injected parts, so
// they run in Node under test.

export type SignOutOutcome = 'signedOut' | 'kept' | 'failed'

export interface SignOutDeps {
  // How many Unsent Changes the signed-in user has, read from the device.
  count: () => Promise<number>
  // Asks whether to lose that many; true to go ahead.
  ask: (count: number) => Promise<boolean>
  // Signs out on the server; false if it didn't get through (no connection).
  signOut: () => Promise<boolean>
  // Everything kept on the device goes, the Unsent Changes with it.
  forget: () => Promise<void>
}

// Signing out. With Unsent Changes waiting it asks first; "no" keeps them and
// the sign-in. The device is only cleared once the server has signed the user
// out: a sign-out that couldn't get through (offline) leaves everything, and
// they are still signed in.
export async function signOutAsking({ count, ask, signOut, forget }: SignOutDeps): Promise<SignOutOutcome> {
  const waiting = await count()
  if (waiting > 0 && !await ask(waiting)) return 'kept'
  if (!await signOut()) return 'failed'
  await forget()
  return 'signedOut'
}

export type SettleOutcome = 'none' | 'discarded' | 'declined'

export interface SettleDeps {
  store: DeviceStore
  // The user now signed in.
  userId: string
  // Asks whether to lose that many Unsent Changes of another user; true to go ahead.
  ask: (count: number) => Promise<boolean>
  // Signs this user out again, keeping what the device holds (the other user
  // can sign back in and send theirs).
  leave: () => Promise<void>
}

// Someone else signed in while the device holds Unsent Changes of another
// user. They are never sent as this user. Until the answer, nothing of
// theirs is touched; "yes" discards them, "no" signs this user out again.
export async function settleOtherUnsent({ store, userId, ask, leave }: SettleDeps): Promise<SettleOutcome> {
  const others = (await store.unsent.holders()).filter(holder => holder.userId !== userId)
  if (others.length === 0) return 'none'
  if (!await ask(others.reduce((sum, holder) => sum + holder.count, 0))) {
    await leave()
    return 'declined'
  }
  for (const { userId: other } of others) await store.unsent.discard(other)
  return 'discarded'
}

export interface SendOwnDeps {
  // Whether malkochen answers right now.
  online: () => boolean
  // Whether the user is still the one signed in (not signed out, not replaced).
  stillSignedIn: () => boolean
  // How many Unsent Changes the user has, read from the device.
  count: () => Promise<number>
  send: () => Promise<unknown>
}

// A user signed in (again): their own Unsent Changes go out at once, without
// waiting for a Board page to open, so an expired sign-in that was renewed on
// any page delivers them. Never as someone else, never while offline (they
// stay on the device and go with the next try).
export async function sendOwnUnsent({ online, stillSignedIn, count, send }: SendOwnDeps): Promise<boolean> {
  if (!stillSignedIn() || !online()) return false
  if (await count() === 0) return false
  if (!stillSignedIn()) return false
  await send()
  return true
}
