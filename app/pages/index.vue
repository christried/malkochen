<script setup lang="ts">
import { gotNoAnswer } from '~/board/kept-boards'
import { boardPath } from '~~/shared/address'

// No page of its own: opens the Board used last ("Meine Küche" on a first
// sign-in, created by the API). If that fails, the error screen says so;
// during a client-side navigation only a fatal error gets that far. A Dish
// Link remembered on the way in (#403) opens its Dish instead, where the
// page opens the Copy picker by itself. The landing clears that cookie, so
// its Set-Cookie must reach the browser: hence the cookie-passing fetch.
// Without an answer from malkochen (#461) it opens the Board kept on the
// device as the one used last; with none kept, the error screen says it needs
// a connection.
const fetchPassingCookies = useFetchPassingCookies()
const device = useDevice()
const landing = await fetchPassingCookies<{ boardId: string, slug: string, dishLink?: string }>('/api/boards/landing?dishLink').catch(async (error: { statusCode?: number }): Promise<{ boardId: string, slug: string, dishLink?: string }> => {
  if (device && gotNoAnswer(error)) {
    const kept = await (await device.keptOfUser())?.landing()
    if (kept) return kept
    throw needsConnection()
  }
  throw createError({ statusCode: error.statusCode ?? 500, fatal: true })
})
await navigateTo(landing.dishLink ? `${landing.dishLink}?kopieren` : boardPath(landing), { replace: true })
</script>

<template>
  <div />
</template>
