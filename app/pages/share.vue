<script setup lang="ts">
import { boardPath } from '~~/shared/address'
import { sharedLink } from '~/utils/shared-link'

// Share to malkochen (issue #204): the installed app's share target
// (manifest share_target). No page of its own: like the landing (index.vue),
// it opens the Board used last, with Add Dish open (BoardScreen's `add`)
// and the first web link that was shared filled in. Shared content without
// one opens it empty. Signed out, the page guard sends the visitor to sign
// in first and back here after.
const route = useRoute()
const part = (name: string) => {
  const value = route.query[name]
  return typeof value === 'string' ? value : undefined
}
const link = sharedLink({ url: part('url'), text: part('text'), title: part('title') })

const landing = await useRequestFetch()<{ boardId: string, slug: string }>('/api/boards/landing').catch((error: { statusCode?: number }) => {
  throw createError({ statusCode: error.statusCode ?? 500, fatal: true })
})
await navigateTo({ path: boardPath(landing), query: { add: link ?? '' } }, { replace: true })
</script>

<template>
  <div />
</template>
