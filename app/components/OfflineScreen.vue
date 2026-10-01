<script setup lang="ts">
// Over the whole app while the device has no connection (PRD story 8), and
// gone again once it's back: what's on screen is still there underneath.
// Opening malkochen offline gets public/offline.html from the service worker
// instead.
const t = useStrings()
const online = useOnline()
</script>

<template>
  <div
    v-if="!online"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="offline-headline"
    class="fixed inset-0 z-toast"
  >
    <SystemScreen
      headline-id="offline-headline"
      :headline="t.offline.headline"
      :body="t.offline.body"
    >
      <template #illustration>
        <OfflineIllustration />
      </template>
    </SystemScreen>
  </div>
</template>
