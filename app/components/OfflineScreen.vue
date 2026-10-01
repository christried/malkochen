<script setup lang="ts">
// Over the whole app while the device has no connection (PRD story 8), and
// gone again once it's back: what's on screen is still there underneath,
// inert meanwhile, so focus can't wander into it. "Nochmal versuchen"
// reloads; still offline, the service worker answers with
// public/offline.html. Opening malkochen offline gets that page too.
const t = useStrings()
const online = useOnline()
const retryButton = useTemplateRef<HTMLButtonElement>('retryButton')

watch(online, async (isOnline) => {
  if (isOnline) return
  await nextTick()
  retryButton.value?.focus()
})

function retry() {
  location.reload()
}
</script>

<template>
  <div :inert="!online">
    <slot />
  </div>
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
      <template #actions>
        <button
          ref="retryButton"
          type="button"
          class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          @click="retry"
        >
          {{ t.offline.retry }}
        </button>
      </template>
    </SystemScreen>
  </div>
</template>
