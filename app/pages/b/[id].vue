<script setup lang="ts">
// A Board (BoardScreen), which loads as it sets up. Opening it from another
// page shows its skeleton (BoardSkeleton) at once, in place of the page
// before, until it has loaded. The first, server-rendered load arrives
// whole, under the splash.
const route = useRoute()
const id = computed(() => String(route.params.id))
</script>

<template>
  <Suspense>
    <BoardScreen />
    <template #fallback>
      <BoardSkeleton :board-id="id" />
    </template>
  </Suspense>
</template>
