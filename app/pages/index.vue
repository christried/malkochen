<script setup lang="ts">
// No page of its own: opens the Board used last ("Meine Küche" on a first
// sign-in, created by the API).
const { boardId } = await useRequestFetch()<{ boardId: string }>('/api/boards/landing')
await navigateTo(`/b/${boardId}`, { replace: true })
</script>

<template>
  <div />
</template>
