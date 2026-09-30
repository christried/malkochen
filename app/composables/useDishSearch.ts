import type { FoundDish } from '~~/server/utils/dishes'

// How long typing pauses before the search asks.
const SEARCH_PAUSE_MS = 180

// Searching the Board's Dishes by title (PRD story 36). The server is asked
// once typing pauses; an answer to an older query is dropped. `found` is null
// while there is no query (the Board shows as usual) and until the first
// answer for it arrives, so the previous results stay up while typing on.
export function useDishSearch(boardId: () => string) {
  const query = ref('')
  const found = ref<FoundDish[] | null>(null)
  const failed = ref(false)
  const active = computed(() => query.value.trim() !== '')

  let asked = 0
  let pause: ReturnType<typeof setTimeout> | undefined
  watch(query, () => {
    clearTimeout(pause)
    const q = query.value.trim()
    const ask = ++asked
    if (!q) {
      found.value = null
      failed.value = false
      return
    }
    pause = setTimeout(async () => {
      try {
        const { dishes } = await $fetch<{ dishes: FoundDish[] }>(`/api/boards/${boardId()}/dishes`, { query: { q } })
        if (ask !== asked) return
        found.value = dishes
        failed.value = false
      }
      catch {
        if (ask === asked) failed.value = true
      }
    }, SEARCH_PAUSE_MS)
  })
  onScopeDispose(() => clearTimeout(pause))

  return { query, found, failed, active }
}
