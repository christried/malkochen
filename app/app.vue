<script setup lang="ts">
useThemeAttribute()
useLanguageAttribute()

const staging = useRuntimeConfig().public.staging
// PROTOTYPE #392 (throwaway): the variant bar and the Board overlays, dev only.
const isDev = import.meta.dev
</script>

<template>
  <OfflineScreen>
    <NuxtPage />
  </OfflineScreen>
  <SplashScreen />
  <AppTooltip />
  <StagingLabel v-if="staging" />
  <template v-if="isDev">
    <Prototype392Bar />
    <Prototype392Overlay />
  </template>
</template>
