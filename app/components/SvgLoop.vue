<script setup lang="ts">
import { loopStyle } from '~/utils/svg-loop'

// A loop drawn in code from a layered SVG (utils/svg-loop.ts): its still
// first, and the same drawing animated over it while `play` asks for it.
// Played by CSS, it runs at the screen's own refresh rate and is sharp at any
// size, where a video is 30 fps at the size it was rendered (#111).
//
// Like MotionClip: the drawing only comes into the page the first time it is
// asked to play, in the theme shown; it pauses whenever it is off-screen, and
// with reduced motion never comes at all: the still stays. It lies exactly
// over the still, and its frame 0 is the still, so starting never jumps.
//
// `src` is the drawing without the theme: '/placeholders/pasta' plays
// /placeholders/pasta-dark.svg in dark. The still is the default slot, or
// else that same file as an image.
const props = withDefaults(defineProps<{
  src: string
  play?: boolean
  // false: plays through once per `play`, then `ended`.
  loop?: boolean
  // The drawing has no background of its own: the still would show through,
  // so it hides while the drawing is up.
  transparent?: boolean
}>(), { play: false, loop: true, transparent: false })
const emit = defineEmits<{ ended: [] }>()

const theme = useResolvedTheme()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const wanted = computed(() => props.play && !reducedMotion.value)
const file = computed(() => `${props.src}-${theme.value}.svg`)

const root = useTemplateRef<HTMLElement>('root')
const host = useTemplateRef<HTMLElement>('host')
const onScreen = useOnScreen(root)
// The file drawn in `host`, once it is.
const drawn = ref<string | null>(null)
const shown = computed(() => wanted.value && drawn.value === file.value)
const run = computed(() => shown.value ? (props.loop ? 'loop' : 'once') : undefined)

watch([wanted, file, host], async () => {
  if (!wanted.value || !host.value || drawn.value === file.value) return
  const wantedFile = file.value
  const svg = await animatedSvg(wantedFile)
  if (file.value !== wantedFile || !host.value) return
  if (!svg) {
    // Couldn't load: the still simply stays, and a play-once is over.
    if (!props.loop) emit('ended')
    return
  }
  host.value.replaceChildren(svg)
  drawn.value = wantedFile
}, { immediate: true })

// Played once: over when every layer's animation is.
function onAnimationEnd() {
  if (run.value !== 'once' || !host.value) return
  if (host.value.getAnimations({ subtree: true }).every(a => a.playState === 'finished')) emit('ended')
}
</script>

<script lang="ts">
// Each file fetched and prepared once: its animated layers given their loop
// (loops.css runs them), sized like the still's object-cover. Every SvgLoop
// draws its own copy.
const prepared = new Map<string, Promise<SVGSVGElement | null>>()

async function prepare(file: string): Promise<SVGSVGElement | null> {
  try {
    const response = await fetch(file)
    if (!response.ok) return null
    const svg = new DOMParser().parseFromString(await response.text(), 'image/svg+xml').documentElement
    if (!(svg instanceof SVGSVGElement)) return null
    svg.querySelectorAll('metadata').forEach(el => el.remove())
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice')
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('data-loop-svg', file)
    for (const layer of svg.querySelectorAll<SVGElement>('[data-loop]')) {
      const style = loopStyle(layer.dataset.loop!, layer.dataset.pivot)
      if (!style) {
        delete layer.dataset.loop
        continue
      }
      for (const [property, value] of Object.entries(style)) layer.style.setProperty(property, value)
    }
    return svg
  }
  catch {
    return null
  }
}

async function animatedSvg(file: string): Promise<SVGSVGElement | null> {
  if (!prepared.has(file)) prepared.set(file, prepare(file))
  const svg = await prepared.get(file)!
  if (!svg) prepared.delete(file)
  return svg ? document.importNode(svg, true) : null
}
</script>

<template>
  <div
    ref="root"
    class="relative h-full w-full"
    data-svg-loop
    :data-clip="src"
    :data-run="run"
    :data-paused="run && !onScreen ? '' : undefined"
    :data-playing="run && onScreen ? file : undefined"
  >
    <div
      class="h-full w-full"
      :class="{ invisible: transparent && shown }"
    >
      <slot>
        <img
          :src="`${src}-light.svg`"
          alt=""
          class="only-light h-full w-full object-cover"
          loading="lazy"
        >
        <img
          :src="`${src}-dark.svg`"
          alt=""
          class="only-dark h-full w-full object-cover"
          loading="lazy"
        >
      </slot>
    </div>
    <div
      ref="host"
      class="absolute inset-0"
      :class="{ invisible: !shown }"
      @animationend="onAnimationEnd"
    />
  </div>
</template>
