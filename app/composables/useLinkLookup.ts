import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
// Relative imports, not `~~`: the module's tests run in plain Node (the
// "client" Vitest project), which knows no Nuxt aliases.
import type { SourceLookupResult } from '../../server/source-lookup'
import { webLink } from '../utils/web-link'

// The client link lookup module (spec #62): one link field's Source Lookup.
// It looks the link up as soon as it is one, after a short pause while
// typing. The loading state shows immediately. Plain Vue reactivity and no
// DOM; the only Nuxt piece is the default lookup (`$fetch`), which the tests
// replace with a fake, so it runs in Node under test.

// GET /api/source-lookup: what Source Lookup found, and the Image Ticket
// saving needs to copy the image.
export type LookupAnswer = SourceLookupResult & { imageTicket: string | null }

// Asks Source Lookup about a web link; rejects if it couldn't be asked.
export type LookUp = (link: string) => Promise<LookupAnswer>

type State
  = | { status: 'idle' }
    | { status: 'looking' }
    | { status: 'found', result: LookupAnswer }
    | { status: 'failed' }

// How long typing pauses before the link is looked up.
const TYPING_PAUSE = 300

// The app's Source Lookup, over HTTP. Tests pass a fake instead.
function sourceLookup(link: string): Promise<LookupAnswer> {
  return $fetch<LookupAnswer>('/api/source-lookup', { query: { link } })
}

export function useLinkLookup(link: Ref<string>, lookUp: LookUp = sourceLookup) {
  const state = ref<State>({ status: 'idle' })
  let timer: ReturnType<typeof setTimeout> | undefined
  let wasPasted = false
  // Counts the link's changes; only the latest one's answer counts.
  let latest = 0

  async function run(target: string, change: number) {
    const answer: State = await lookUp(target)
      .then(result => ({ status: 'found' as const, result }), () => ({ status: 'failed' as const }))
    if (change === latest) state.value = answer
  }

  // Sync, so "looking" is there the moment the link is one.
  watch(link, (value) => {
    clearTimeout(timer)
    const change = ++latest
    const pasted = wasPasted
    wasPasted = false
    const target = webLink(value)
    if (!target) {
      state.value = { status: 'idle' }
      return
    }
    state.value = { status: 'looking' }
    if (pasted) run(target, change)
    else timer = setTimeout(() => run(target, change), TYPING_PAUSE)
  }, { flush: 'sync' })
  // A pending lookup ends with the component using it, and one under way is
  // ignored (silently in tests, which have no component).
  onScopeDispose(() => {
    clearTimeout(timer)
    latest++
  }, true)

  const result = computed(() => state.value.status === 'found' ? state.value.result : null)
  return {
    status: computed(() => state.value.status),
    result,
    canonicalLink: computed(() => result.value?.canonicalLink ?? null),
    // The link's next change is a paste: it is looked up without the pause.
    pasted() {
      wasPasted = true
    },
  }
}
