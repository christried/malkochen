<script setup lang="ts">
import { boardPath } from '~~/shared/address'

// No page of its own: opens the Board used last ("Meine Küche" on a first
// sign-in, created by the API). If that fails, the error screen says so;
// during a client-side navigation only a fatal error gets that far.
const landing = await useRequestFetch()<{ boardId: string, slug: string }>('/api/boards/landing').catch((error: { statusCode?: number }) => {
  throw createError({ statusCode: error.statusCode ?? 500, fatal: true })
})
await navigateTo(boardPath(landing), { replace: true })
</script>

<template>
  <div />
</template>
