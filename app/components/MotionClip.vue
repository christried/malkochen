<script setup lang="ts">
// A Remotion clip (handoff REMOTION.md): its still first, and the clip played
// over it while `play` asks for it. The video only comes into the page the
// first time it is asked to play, so a clip that never plays never loads;
// it plays the light or dark render as the theme is shown, pauses whenever it
// is off-screen, and with reduced motion never comes at all: the still stays.
// Lying over the still, it never moves the layout. The still is the poster:
// the video stays transparent until it has a frame up.
//
// `src` is the clip's files without the theme: '/placeholders/pasta' plays
// /placeholders/pasta-dark.webm (or .mp4) in dark. The still is the default
// slot, or else the clip's poster PNGs.
const props = withDefaults(defineProps<{
  src: string
  play?: boolean
  // false: plays through once per `play`, then `ended`.
  loop?: boolean
}>(), { play: false, loop: true })
const emit = defineEmits<{ ended: [] }>()

const theme = useResolvedTheme()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const wanted = computed(() => props.play && !reducedMotion.value)

const root = useTemplateRef<HTMLElement>('root')
const video = useTemplateRef<HTMLVideoElement>('video')
// Client-only, so the server never renders a video (nor guesses the theme).
const mounted = ref(false)
const loaded = ref(false)
const onScreen = ref(false)
const shown = ref(false)

watchEffect(() => {
  if (wanted.value && mounted.value) loaded.value = true
})

let observer: IntersectionObserver | undefined
onMounted(() => {
  mounted.value = true
  observer = new IntersectionObserver(([entry]) => (onScreen.value = entry?.isIntersecting ?? false))
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())

watchEffect(() => {
  const el = video.value
  if (!el) return
  if (wanted.value && onScreen.value) {
    // Refused (e.g. a power-saving mode): the still simply stays, and a
    // play-once is over. (A pause cutting in rejects too, as AbortError.)
    el.play().catch((error: DOMException) => {
      if (error.name === 'NotAllowedError' && !props.loop) emit('ended')
    })
    return
  }
  el.pause()
  if (!wanted.value) {
    shown.value = false
    el.currentTime = 0
  }
})

function ended() {
  shown.value = false
  emit('ended')
}
</script>

<template>
  <div
    ref="root"
    class="relative h-full w-full"
  >
    <slot>
      <img
        :src="`${src}-light.png`"
        alt=""
        class="only-light h-full w-full object-cover"
        loading="lazy"
      >
      <img
        :src="`${src}-dark.png`"
        alt=""
        class="only-dark h-full w-full object-cover"
        loading="lazy"
      >
    </slot>
    <video
      v-if="loaded"
      ref="video"
      :key="theme"
      class="absolute inset-0 h-full w-full object-cover"
      :class="{ 'opacity-0': !shown }"
      :loop="loop"
      muted
      playsinline
      preload="none"
      disablepictureinpicture
      aria-hidden="true"
      data-motion-clip
      @playing="shown = true"
      @ended="ended"
    >
      <source
        :src="`${src}-${theme}.webm`"
        type="video/webm"
      >
      <source
        :src="`${src}-${theme}.mp4`"
        type="video/mp4"
      >
    </video>
  </div>
</template>
