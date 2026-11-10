// Relative imports, not `~~`: runs in plain Node under test.
import type { DeviceStore } from './device-store'

// Whether the device still belongs to `userId`, read from the store each time
// it is asked: another tab may have signed out, or signed in as someone else,
// and this tab's memory knows nothing of it. What a stale tab asks before it
// sends or writes anything of the user's.
//
// Nobody on the device counts as "not mine" only once it was mine (a sign-out
// in another tab); before that, a device that doesn't know its user yet
// doesn't close anything. An expired sign-in leaves the device's user as it
// was, so the user's own changes stay (#463).
export function deviceOwner(store: Pick<DeviceStore, 'user'>, userId: string) {
  let seenMine = false
  async function read(): Promise<boolean> {
    // Storage that can't be read says nothing: nothing is closed over it.
    const me = await store.user.load().catch(() => undefined)
    if (me === undefined) return true
    if (me?.id === userId) {
      seenMine = true
      return true
    }
    return me === null && !seenMine
  }
  // Read at once, so a tab made while the device is the user's remembers it.
  const first = read()
  return {
    mine: () => first.then(read),
  }
}
