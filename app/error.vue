<script setup lang="ts">
import type { NuxtError } from '#app'

// The error screen, in place of the whole app: "Das gibt's hier nicht" for a
// page or Board that isn't there (or isn't yours), "Da ist was angebrannt"
// for anything unexpected, with "Nochmal versuchen", over the handoff's
// "error" clip, drawn in code (SvgLoop, #217) on a carrot blob in the page's
// colour.
// Never shows the error's own message: it is for developers, not people.
const props = defineProps<{ error: NuxtError }>()

useThemeAttribute()
useLanguageAttribute()
const t = useStrings()
const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: () => `${notFound.value ? t.error.notFoundHeadline : t.error.headline} · ${t.app.name}` })

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
  <OfflineScreen>
    <main>
      <SystemScreen
        :headline="notFound ? t.error.notFoundHeadline : t.error.headline"
        :body="notFound ? t.error.notFoundBody : t.error.body"
      >
        <template #illustration>
          <ClipBlob
            accent="carrot"
            :share="24"
            :inset="6"
          />
          <SvgLoop
            src="/clips/error"
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
  </OfflineScreen>
</template>
