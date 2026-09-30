import type { WatchSource } from 'vue'
import type { DishView } from '~~/server/utils/dishes'

// How long typing pauses before the search asks.
const SEARCH_PAUSE_MS = 180
// How long after the Board changed the search asks again: most changes show
// on the Board before the server has them (a move, a delete, its undo).
const REFRESH_PAUSE_MS = 800

// The answer to one query: the Dishes it found, in Board order. `round`
// counts the queries answered, so each new query's results can pop in anew
// while a refresh of the same query keeps them in place.
export interface SearchAnswer {
  query: string
  dishes: DishView[]
  round: number
}

// Searching the Board's Dishes by title (PRD story 36). The server is asked
// once typing pauses; an answer to an older request is dropped. `answer` is
// null while there is no query (the Board shows as usual) and until the first
// answer arrives, then the previous answer stays up while typing on. When
// the Board changes (a Dish added, renamed, moved or deleted), the same query
// is asked again, so the results keep up with it.
export function useDishSearch(boardId: () => string, boardChanged: WatchSource) {
  const query = ref('')
  const answer = ref<SearchAnswer | null>(null)
  const failed = ref(false)
  const active = computed(() => query.value.trim() !== '')

  let latestRequest = 0
  let pause: ReturnType<typeof setTimeout> | undefined

  function ask(wait: number) {
    clearTimeout(pause)
    const q = query.value.trim()
    const request = ++latestRequest
    if (!q) {
      answer.value = null
      failed.value = false
      return
    }
    pause = setTimeout(async () => {
      try {
        const { dishes } = await $fetch<{ dishes: DishView[] }>(`/api/boards/${boardId()}/dishes`, { query: { q } })
        if (request !== latestRequest) return
        const round = (answer.value?.round ?? 0) + (answer.value?.query === q ? 0 : 1)
        answer.value = { query: q, dishes, round }
        failed.value = false
      }
      catch {
        if (request === latestRequest) failed.value = true
      }
    }, wait)
  }

  watch(query, (now, before) => {
    if (now.trim() === before.trim()) return
    failed.value = false
    ask(SEARCH_PAUSE_MS)
  })
  watch(boardChanged, () => active.value && ask(REFRESH_PAUSE_MS), { deep: true })
  onScopeDispose(() => clearTimeout(pause))

  return { query, answer, failed, active }
}
