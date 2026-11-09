// Whether malkochen can be reached (#458): `online`; `offline`, the device
// has no connection; or `unreachable`, it has one but malkochen doesn't
// answer. Not just what the browser says: the last request that got no
// answer counts too, and the next one that gets one is back (the connection
// plugin watches every $fetch). Always online during server rendering and
// hydration, so the server's HTML matches.
export type Connection = 'online' | 'offline' | 'unreachable'

export function useConnectionState() {
  return useState<Connection>('connection', () => 'online')
}

// The one place every change asks whether it may act: offline, it is greyed
// out (`needsNet`: aria-disabled, with "Geht nur mit Netz" as its tooltip)
// or hidden, or sits in a NeedsNet group. For now every change needs a
// connection.
export function useConnection() {
  const state = useConnectionState()
  const t = useStrings()
  const mayChange = computed(() => state.value === 'online')
  const needsNet = computed(() => mayChange.value ? {} : { 'aria-disabled': 'true' as const, 'data-tooltip': t.offline.needsNet, 'data-needs-net': '' })
  return { state: readonly(state), mayChange, needsNet }
}
