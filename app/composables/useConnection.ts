// Whether malkochen can be reached (#458): `online`; `offline`, the device
// has no connection; or `unreachable`, it has one but malkochen doesn't
// answer. Not just what the browser says: the last request that got no
// answer counts too, and the next one that gets one is back (the connection
// plugin watches every request to /api). Always online during server
// rendering and hydration, so the server's HTML matches.
export type Connection = 'online' | 'offline' | 'unreachable'

export function useConnectionState() {
  return useState<Connection>('connection', () => 'online')
}

// `answering`: malkochen answers. `mayChange`: the one place a change that
// needs a connection asks whether it may act; offline, it is greyed out
// (`needsNet`: aria-disabled, with "Geht nur mit Netz" as its tooltip) or
// hidden, or sits in a NeedsNet group. A change that works offline too (it
// becomes an Unsent Change, #459: moving within the Board and "Gekocht ✓"
// with their "Rückgängig", Votes, a Dish's title, #460) always may, so it
// asks nothing. `mayChangeComments`: Comments (#460) work offline
// too, but only on a Dish whose Dish History has loaded on this page (the
// Board module's historyLoaded): else they are greyed out like a change that
// needs a connection (`needsNetUnless` greys out whatever isn't allowed).
// What isn't a change asks `answering`.
export function useConnection() {
  const state = useConnectionState()
  const t = useStrings()
  const answering = computed(() => state.value === 'online')
  const mayChange = answering
  const mayChangeComments = (historyLoaded: boolean) => answering.value || historyLoaded
  const needsNetUnless = (may: boolean) => may ? {} : { 'aria-disabled': 'true' as const, 'data-tooltip': t.offline.needsNet, 'data-needs-net': '' }
  const needsNet = computed(() => needsNetUnless(mayChange.value))
  return { state: readonly(state), answering, mayChange, mayChangeComments, needsNet, needsNetUnless }
}
