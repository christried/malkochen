import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { BoardAddress } from '~~/server/utils/addresses'

// The Board at the page's address (CONTEXT.md: Address): /b/<slug>, and a
// Dish's part after it for the Dish detail. An outdated one (a slug from
// before a rename, a Board's or Dish's id, a Dish's old title) forwards to
// the current one, before the page does anything else, so a Board is never
// opened twice (which would move on what is marked "Neu"). Answers the
// Board's id, and what `load` brought for it, or null while forwarding. An
// address that isn't one of the user's Boards shows the error screen, the
// same whether it doesn't exist or isn't theirs. `under` is what follows the
// Board's address on a page of its own under it ("/settings").
//
// `load` runs at a current address only, in the same request as finding it
// (deep: the page may change what it brought in place). One await, not two:
// a Board page whose setup awaits twice mounts only after hydration is
// over, and until then it doesn't respond (nor hear the app go to the
// background).
export async function useBoardAddress<T = undefined>(
  under = '',
  load?: (boardId: string) => Promise<T>,
): Promise<{ boardId: string, loaded: Ref<T | undefined> } | null> {
  const nuxtApp = useNuxtApp()
  const route = useRoute()
  const fetchPassingCookies = useFetchPassingCookies()
  const asked = String(route.params.board)
  const dish = typeof route.params.dish === 'string' ? route.params.dish : undefined

  const { data, error } = await useAsyncData(`address:${asked}:${dish ?? ''}:${under}`, async () => {
    const found = await fetchPassingCookies<BoardAddress>(`/api/addresses/${encodeURIComponent(asked)}`, { query: { dish } })
    return { found, loaded: load && isCurrent(found, route) ? await load(found.boardId) : undefined }
  }, { deep: true })
  if (!data.value) throw createError({ statusCode: error.value?.statusCode ?? 500, statusMessage: error.value?.statusMessage, fatal: true })
  if (isCurrent(data.value.found, route)) return { boardId: data.value.found.boardId, loaded: toRef(data.value, 'loaded') as Ref<T | undefined> }

  const current = data.value.found
  await nuxtApp.runWithContext(() => navigateTo({
    path: currentPath(current, under),
    query: route.query,
    hash: route.hash,
  }, { replace: true }))
  return null
}

// The address the open Board page is at, for its links that stay under it
// (a Dish's, back from its detail). A Board renamed while it is open (by
// another Member; sync brings the new slug) keeps it until it is opened
// again: it still leads here, while a link to the new one would open the
// Board anew, which moves on what is marked "Neu".
export function useOpenBoardAddress() {
  const route = useRoute()
  return computed(() => ({ slug: String(route.params.board) }))
}

// Whether the page is at the address as it is now. The Dish detail's old
// address (/b/<id>/d/<id>) is an alias of its route.
function isCurrent(found: BoardAddress, route: RouteLocationNormalizedLoaded): boolean {
  return found.slug === route.params.board
    && (found.dish === null || found.dish === route.params.dish)
    && !route.matched.some(record => record.aliasOf)
}

// The page's path at the current address: the Board's or its Dish's, and
// what follows.
function currentPath(found: BoardAddress, under: string): string {
  const board = `/b/${encodeURIComponent(found.slug)}`
  return found.dish === null ? `${board}${under}` : `${board}/${encodeURIComponent(found.dish)}`
}
