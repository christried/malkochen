<script setup lang="ts">
import { boardPath } from '~~/shared/address'

// Your settings are a sheet over the Board (UserSettingsSheet, #210), so
// /settings (a bookmark, an old link) has no page of its own: like the
// landing (index.vue), it opens the Board used last, with your settings open
// (BoardScreen's `settings`). Signed out, the page guard sends the visitor to
// sign in first.
const landing = await useRequestFetch()<{ boardId: string, slug: string }>('/api/boards/landing').catch((error: { statusCode?: number }) => {
  throw createError({ statusCode: error.statusCode ?? 500, fatal: true })
})
await navigateTo({ path: boardPath(landing), query: { settings: '' } }, { replace: true })
</script>

<template>
  <div />
</template>
