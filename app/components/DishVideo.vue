<script setup lang="ts">
import { INSTAGRAM_GRACE_MS, INSTAGRAM_LIMIT_MS, instagramEmbedState, type VideoEmbed } from '~/utils/video-embed'

// A Dish's video in the platform's embedded player (#221), in the Dish
// detail's image frame once "Video abspielen" is tapped. Mounting it is what
// loads anything from the platform. TikTok's and YouTube's players are
// upright, like their videos; Instagram's embed is a card as tall as it says
// it needs. A post Instagram can't embed (private, removed, blocked) never
// says it shows: it stays hidden behind loading dots and gives way to a link
// to the post on Instagram. `link`: the Dish's Source.
const props = defineProps<{ embed: VideoEmbed, link: string }>()
const t = useStrings()

const iframe = useTemplateRef<HTMLIFrameElement>('iframe')
const instagram = computed(() => props.embed.platform === 'instagram')
const shown = ref(false)
const failed = ref(false)
const height = ref<number | null>(null)

let giveUp: ReturnType<typeof setTimeout> | undefined
function giveUpAfter(ms: number) {
  clearTimeout(giveUp)
  giveUp = setTimeout(() => {
    if (!shown.value) failed.value = true
  }, ms)
}

function onMessage(event: MessageEvent) {
  if (event.source !== iframe.value?.contentWindow || event.origin !== new URL(props.embed.src).origin) return
  const state = instagramEmbedState(event.data)
  if (!state) return
  shown.value = true
  if (state.height) height.value = state.height
}

function onLoad() {
  if (instagram.value && !shown.value) giveUpAfter(INSTAGRAM_GRACE_MS)
}

onMounted(() => {
  // The button that started it is gone: the player takes the focus.
  iframe.value?.focus({ preventScroll: true })
  if (!instagram.value) return
  window.addEventListener('message', onMessage)
  giveUpAfter(INSTAGRAM_LIMIT_MS)
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  clearTimeout(giveUp)
})
</script>

<template>
  <div
    v-if="failed"
    class="flex aspect-[4/3] w-full flex-col items-center justify-center gap-4 p-6 text-center"
    data-video-fallback
  >
    <p class="text-body">
      {{ t.detail.videoUnavailable }}
    </p>
    <a
      :href="link"
      target="_blank"
      rel="noopener noreferrer"
      class="rounded-pill bg-inverse px-5 py-3 text-button text-on-inverse transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      {{ t.detail.openOnInstagram }}
    </a>
  </div>
  <div
    v-else
    class="relative flex w-full justify-center"
  >
    <!-- Named by aria-label: a title would bring the browser's tooltip
         back (#206). -->
    <iframe
      ref="iframe"
      :src="embed.src"
      :aria-label="t.detail.videoPlayer(embed.platform)"
      allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
      allowfullscreen
      referrerpolicy="strict-origin-when-cross-origin"
      class="rounded-panel border-0 bg-surface"
      :class="instagram
        ? ['w-full max-w-[400px] transition-opacity duration-fade ease-fade', { 'opacity-0': !shown }]
        : 'aspect-[9/16] h-[70dvh] max-w-full'"
      :style="instagram ? { height: `${height ?? 560}px` } : undefined"
      data-video-player
      @load="onLoad"
    />
    <LoadingDots
      v-if="instagram && !shown"
      class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-text-muted"
    />
  </div>
</template>
