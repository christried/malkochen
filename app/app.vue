<script setup lang="ts">
useThemeAttribute()
useLanguageAttribute()
// PROTOTYPE #330: throwaway, never merge. The variant bar, dev only.
const Prototype330Bar = import.meta.dev ? defineAsyncComponent(() => import('~/components/prototype330/Bar.vue')) : null
</script>

<template>
  <OfflineScreen>
    <NuxtPage />
  </OfflineScreen>
  <SplashScreen />
  <AppTooltip />
  <ClientOnly v-if="Prototype330Bar">
    <component :is="Prototype330Bar" />
  </ClientOnly>
</template>
