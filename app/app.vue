<script setup lang="ts">
useThemeAttribute()
useLanguageAttribute()

const staging = useRuntimeConfig().public.staging
// PROTOTYPE #422 (throwaway): the Snackbert Question, the report sheet and the bar, dev only.
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
    <Prototype422Bar />
    <Prototype422Question />
    <Prototype422ReportSheet />
    <Prototype422Thanks />
  </template>
</template>
