<script setup lang="ts">
import { SPLASH_SEEN_KEY } from '~~/shared/splash'

// The splash (handoff "Splash"): on the first load of a tab session, on any
// route, the splash clip plays over the page and fades to it. It starts at
// frame 10, the butter bloomed and the icon at rest, which is what Android's
// native splash shows (the manifest's background_color), so native and web
// are one picture. It runs on a fixed clock: it never waits for the page's
// data, whose own loading state shows beneath it if needed.
//
// The server can't read session storage, so it always sends the overlay;
// the script in <head> hides it before the first paint when this tab has
// seen it already (a reload, the return from Google), and marks it seen
// otherwise. Mounted once from app.vue, so in-app navigation never shows it.
// With reduced motion no video loads: <picture> picks the frame-16 still
// (icon and wordmark), which holds, then fades.

// Frame 10 of the 30fps clip.
const START = 10 / 30
// Reduced motion: how long the still holds before it fades.
const HOLD_MS = 400
// The clip's own length from frame 10 is ~770ms; a clip that hasn't played
// through by then (a slow connection) is cut, and the page shown.
const GIVE_UP_MS = 2000

const key = JSON.stringify(SPLASH_SEEN_KEY)
useHead({
  style: [{ key: 'splash', innerHTML: 'html[data-splash-seen] [data-splash]{display:none}' }],
  script: [{
    key: 'splash',
    tagPriority: 'critical',
    innerHTML: `try{if(sessionStorage.getItem(${key}))document.documentElement.dataset.splashSeen="";else sessionStorage.setItem(${key},"1")}catch(e){}`,
  }],
})

// Only a page as the server sent it has the splash: app.vue first rendered
// in the browser (after an error page's way back home) is in-app navigation.
const state = ref<'showing' | 'leaving' | 'gone'>(import.meta.client && !useNuxtApp().isHydrating ? 'gone' : 'showing')
const play = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  if (state.value === 'gone') return
  if (document.documentElement.dataset.splashSeen !== undefined) {
    state.value = 'gone'
    return
  }
  if (prefersReducedMotion()) {
    timers.push(setTimeout(leave, HOLD_MS))
    return
  }
  play.value = true
  timers.push(setTimeout(leave, GIVE_UP_MS))
})
onBeforeUnmount(() => timers.forEach(clearTimeout))

function leave() {
  if (state.value !== 'showing') return
  state.value = 'leaving'
  timers.push(setTimeout(() => (state.value = 'gone'), motionMs('fade')))
}
</script>

<template>
  <div
    v-if="state !== 'gone'"
    class="splash fixed inset-0 z-[60]"
    :class="{ leaving: state === 'leaving' }"
    aria-hidden="true"
    data-splash
  >
    <MotionClip
      src="/clips/splash"
      :play="play"
      :loop="false"
      :start="START"
      hold-last
      @ended="leave"
    >
      <picture>
        <source
          media="(prefers-reduced-motion: reduce)"
          srcset="/clips/splash-still.webp"
        >
        <img
          src="/clips/splash-poster.webp"
          alt=""
          class="h-full w-full object-cover"
          fetchpriority="high"
        >
      </picture>
    </MotionClip>
  </div>
</template>

<style scoped>
/* The clip's own background (gradient.icon), for the moment before the
   poster has loaded. Should the app's script never run (it failed to
   load, or hydration broke), the splash fades by itself all the same,
   well after it would have been gone. */
.splash {
  background: linear-gradient(160deg, #FCD980, #F29B32);
  transition: opacity var(--dur-fade) var(--ease-fade);
  animation: splash-fallback var(--dur-fade) var(--ease-fade) 4s forwards;
}

@keyframes splash-fallback {
  to {
    opacity: 0;
    visibility: hidden;
  }
}

.splash.leaving {
  opacity: 0;
  pointer-events: none;
}
</style>
