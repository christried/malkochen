<script setup lang="ts">
useThemeAttribute()
useLanguageAttribute()

const staging = useRuntimeConfig().public.staging
</script>

<template>
  <NuxtPage />
  <OfflineBar />
  <SplashScreen />
  <AppTooltip />
  <StagingLabel v-if="staging" />
</template>
