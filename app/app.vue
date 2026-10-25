<script setup lang="ts">
useThemeAttribute()
useLanguageAttribute()

const staging = useRuntimeConfig().public.staging
</script>

<template>
  <OfflineScreen>
    <NuxtPage />
  </OfflineScreen>
  <SplashScreen />
  <AppTooltip />
  <StagingLabel v-if="staging" />
</template>
