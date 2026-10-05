import type { RouteLocationNormalizedLoaded } from 'vue-router'
import type { BoardAddress } from '~~/server/utils/addresses'

// The Board at the page's address (CONTEXT.md: Address): /b/<slug>, and a
// Dish's part after it for the Dish detail. An outdated one (a slug from
// before a rename, a Board's or Dish's id, a Dish's old title) forwards to
// the current one, before the page does anything else, so a Board is never
// opened twice (which would move on what is marked "Neu"). Answers the
// Board's id, or null while forwarding. An address that isn't one of the
// user's Boards shows the error screen, the same whether it doesn't exist
// or isn't theirs. `under` is what follows the Board's address on a page of
// its own under it ("/settings").
export async function useBoardAddress(under = ''): Promise<string | null> {
  const nuxtApp = useNuxtApp()
  const route = useRoute()
  const fetchPassingCookies = useFetchPassingCookies()
  const asked = String(route.params.board)
  const dish = typeof route.params.dish === 'string' ? route.params.dish : undefined

  const { data: found, error } = await useAsyncData(
    `address:${asked}:${dish ?? ''}`,
    () => fetchPassingCookies<BoardAddress>(`/api/addresses/${encodeURIComponent(asked)}`, { query: { dish } }),
  )
  if (!found.value) throw createError({ statusCode: error.value?.statusCode ?? 500, statusMessage: error.value?.statusMessage, fatal: true })
  if (isCurrent(found.value, route)) return found.value.boardId

  const current = found.value
  await nuxtApp.runWithContext(() => navigateTo({
    path: currentPath(current, under),
    query: route.query,
    hash: route.hash,
  }, { replace: true }))
  return null
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
