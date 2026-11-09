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

// `answering`: malkochen answers. `mayChange`: the one place every change
// asks whether it may act; offline, it is greyed out (`needsNet`:
// aria-disabled, with "Geht nur mit Netz" as its tooltip) or hidden, or sits
// in a NeedsNet group. For now every change needs a connection; later ones
// work offline too, so what isn't a change asks `answering`.
export function useConnection() {
  const state = useConnectionState()
  const t = useStrings()
  const answering = computed(() => state.value === 'online')
  const mayChange = answering
  const needsNet = computed(() => mayChange.value ? {} : { 'aria-disabled': 'true' as const, 'data-tooltip': t.offline.needsNet, 'data-needs-net': '' })
  return { state: readonly(state), answering, mayChange, needsNet }
}
