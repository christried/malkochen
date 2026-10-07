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
// /placeholders/pasta-dark.svg in dark; one drawn the same in both themes
// (`themed: false`, as Topfbert) is `src` + '.svg'. The still is the default
// slot, or else that same file as an image.
const props = withDefaults(defineProps<{
  src: string
  play?: boolean
  // false: plays through once per `play`, then `ended`.
  loop?: boolean
  // The drawing has no background of its own: the still would show through,
  // so it hides while the drawing is up.
  transparent?: boolean
  themed?: boolean
  // Every looping drawing with `sync` keeps one clock, the page's: its
  // rounds count from when the page opened, not from when it came in or
  // back on screen, so several of them on screen move in step.
  sync?: boolean
  // How much of it must be on screen for it to run (else it pauses).
  visibleShare?: number
}>(), { play: false, loop: true, transparent: false, themed: true, sync: false, visibleShare: 0 })
const emit = defineEmits<{ ended: [] }>()

const theme = useResolvedTheme()
const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
const wanted = computed(() => props.play && !reducedMotion.value)
const file = computed(() => props.themed ? `${props.src}-${theme.value}.svg` : `${props.src}.svg`)

const root = useTemplateRef<HTMLElement>('root')
const host = useTemplateRef<HTMLElement>('host')
const onScreen = useOnScreen(root, props.visibleShare)
// The file drawn in `host`, once it is.
const drawn = ref<string | null>(null)
const shown = computed(() => wanted.value && drawn.value === file.value)
// A loop asked to stop looping goes on to the end of the round it is in,
// as a video does, rather than snapping to rest (finishRound).
const finishing = ref(false)
const run = computed(() => shown.value ? (props.loop || finishing.value ? 'loop' : 'once') : undefined)

watch([wanted, file, host], async () => {
  if (!wanted.value) {
    // Stopped: back to the still, and the drawing leaves the page.
    host.value?.replaceChildren()
    drawn.value = null
    finishing.value = false
    return
  }
  if (!host.value || drawn.value === file.value) return
  const wantedFile = file.value
  const svg = await animatedSvg(wantedFile)
  if (!wanted.value || file.value !== wantedFile || !host.value) return
  if (!svg) {
    // Couldn't load: the still simply stays, and a play-once is over.
    if (!props.loop) end()
    return
  }
  host.value.replaceChildren(svg)
  drawn.value = wantedFile
}, { immediate: true })

watch(() => props.loop, (loop, looped) => {
  if (!loop && looped && shown.value) finishRound()
  else if (loop && finishing.value) {
    finishing.value = false
    for (const animation of animations()) animation.effect!.updateTiming({ iterations: Infinity })
  }
})

function finishRound() {
  finishing.value = true
  for (const animation of animations()) {
    const { currentIteration } = animation.effect!.getComputedTiming()
    animation.effect!.updateTiming({ iterations: (currentIteration ?? 0) + 1 })
  }
}

// Paused while off-screen, a layer falls behind the page's clock: each time
// it runs again it's set back on it.
watch(() => props.sync && run.value === 'loop' && onScreen.value, async (running) => {
  if (!running) return
  await nextTick()
  for (const animation of animations()) {
    if (animation.playState === 'running') animation.startTime = 0
  }
})

function animations() {
  return host.value?.getAnimations({ subtree: true }) ?? []
}

// Played once: over when every layer's round is, or at once if nothing in
// the drawing moves. `ended` comes once per play.
let over = false
function end() {
  if (over) return
  over = true
  emit('ended')
}
function endIfStill() {
  if ((run.value === 'once' || finishing.value) && animations().every(a => a.playState === 'finished')) end()
}
watch(run, async (now) => {
  over = false
  if (now !== 'once') return
  await nextTick()
  requestAnimationFrame(() => {
    if (run.value === 'once' && animations().length === 0) end()
  })
})
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
    // Drawn many times over in one page: no ids, nor the file's own
    // data-theme, which the page's theme rules would take for theirs.
    for (const attribute of ['data-theme', 'data-clip', 'data-dish']) svg.removeAttribute(attribute)
    svg.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'))
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
      @animationend="endIfStill"
    />
  </div>
</template>
