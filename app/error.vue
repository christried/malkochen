<script setup lang="ts">
import type { NuxtError } from '#app'

// The error screen, in place of the whole app: "Das gibt's hier nicht" for a
// page or Board that isn't there (or isn't yours), "Da ist was angebrannt"
// for anything unexpected, with "Nochmal versuchen", over the handoff's
// "error" clip, drawn in code (SvgLoop, #217) on a carrot blob in the page's
// colour.
// Never shows the error's own message: it is for developers, not people.
// An error while malkochen can't be reached (a page that couldn't load
// offline) says that instead, over the offline clip on a sky blob, as the
// Offline page does.
const props = defineProps<{ error: NuxtError }>()

useThemeAttribute()
useLanguageAttribute()
const t = useStrings()
const { state } = useConnection()
// Something not kept on this device, asked for while malkochen can't be
// reached (needsConnection).
const notKept = computed(() => !!(props.error.data as { needsConnection?: boolean } | undefined)?.needsConnection)
const offline = computed(() => state.value !== 'online' || notKept.value)
const notFound = computed(() => !offline.value && props.error.statusCode === 404)
const headline = computed(() => notKept.value ? t.offline.notKeptHeadline : state.value === 'offline' ? t.offline.headline : state.value === 'unreachable' ? t.offline.unreachable : notFound.value ? t.error.notFoundHeadline : t.error.headline)
const body = computed(() => notKept.value ? t.offline.notKeptBody : state.value === 'offline' ? t.offline.body : notFound.value ? t.error.notFoundBody : t.error.body)

useHead({ title: () => `${headline.value} · ${t.app.name}` })

// The page that failed, loaded afresh.
const target = useNavigationTarget()
const route = useRoute()
function retry() {
  reloadNuxtApp({ path: target.value ?? route.fullPath, persistState: false })
}

function toApp() {
  clearError({ redirect: '/' })
}
</script>

<template>
  <main>
    <SystemScreen
      :headline="headline"
      :body="body"
    >
      <template #illustration>
        <ClipBlob
          :accent="offline ? 'sky' : 'carrot'"
          :share="offline ? 28 : 24"
          :inset="6"
        />
        <SvgLoop
          :src="offline ? '/clips/offline' : '/clips/error'"
          play
          transparent
        />
      </template>
      <template #actions>
        <button
          v-if="!notFound"
          type="button"
          class="rounded-pill bg-inverse px-5 py-3.5 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          @click="retry"
        >
          {{ t.error.retry }}
        </button>
        <button
          type="button"
          class="rounded-pill px-5 py-3.5 text-button transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          :class="notFound ? 'bg-inverse text-on-inverse' : 'bg-surface-muted text-text'"
          @click="toApp"
        >
          {{ t.error.toApp }}
        </button>
      </template>
    </SystemScreen>
  </main>
</template>
