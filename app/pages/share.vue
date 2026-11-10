<script setup lang="ts">
import { gotNoAnswer } from '~/board/write-failed'
import { boardPath } from '~~/shared/address'
import type { BoardSpot } from '~~/shared/board'
import { sharedLink } from '~/utils/shared-link'

// Share to malkochen (issue #204): the installed app's share target
// (manifest share_target). No page of its own: like the landing (index.vue),
// it opens the Board used last of those the user may add Dishes to, with
// Add Dish open (BoardScreen's `add`) and the first web link that was
// shared filled in. Shared content without one opens it empty. If they may
// add to no Board, just the Board used last opens. Signed out, the page
// guard sends the visitor to sign in first and back here after. Without an
// answer from malkochen (#461) the same goes for the Boards kept on the
// device, so Add Dish opens offline.
const route = useRoute()
const part = (name: string) => {
  const value = route.query[name]
  return typeof value === 'string' ? value : undefined
}
const link = sharedLink({ url: part('url'), text: part('text'), title: part('title') })

const device = useDevice()
const landing = await useRequestFetch()<BoardSpot & { canAdd: boolean }>('/api/boards/landing?adding').catch(async (error: { statusCode?: number }) => {
  if (device && gotNoAnswer(error)) {
    const kept = await (await device.keptOfUser())?.landingToAdd()
    if (kept) return kept
    throw needsConnection()
  }
  throw createError({ statusCode: error.statusCode ?? 500, fatal: true })
})
await navigateTo({ path: boardPath(landing), query: landing.canAdd ? { add: link ?? '' } : {} }, { replace: true })
</script>

<template>
  <div />
</template>
