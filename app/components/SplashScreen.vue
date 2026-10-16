<script setup lang="ts">
import { SPLASH_SEEN_KEY } from '~~/shared/splash'

// The splash (handoff "Splash"): on the first load of a tab session, on any
// route, the splash plays over the page and fades to it. It starts at frame
// 10 of the handoff's clip, the butter bloomed and the icon at rest, which is
// what Android's native splash shows (the manifest's background_color), so
// native and web are one picture: the lid pops, the wordmark rises and its
// dot pops (f10–16, 200ms). Then that last frame holds until the splash has
// been up 2s in all, counted from the page's first paint, so there is time to
// see it (#216). It runs on that fixed clock: it never waits for the
// page's data, whose own loading state shows beneath it if needed. A tap or
// click anywhere closes it at once, even before the app has woken up (the
// script below).
//
// Drawn in the page (inline SVG and text, keyframes below) where it was a
// 30 fps video: it moves at the screen's refresh rate and is in the page as
// the server sends it, so it plays from the first paint with nothing to
// load. Sized as the clip laid it out (remotion/src/clips/splash.tsx
// splashLayout): a 9:16 column as tall as the window allows, centred, so it
// stays whole in a wide window and fills a phone held upright. With reduced
// motion the keyframes jump to their end (main.css): the icon and wordmark
// stand still, and hold all the same.
//
// The server can't read session storage, so it always sends the overlay;
// the script in <head> hides it before the first paint when this tab has
// seen it already (a reload, the return from Google), and marks it seen
// otherwise. It also listens for the tap that closes it, which marks the page
// so CSS fades it out: on a slow phone the splash can be up before the app
// can answer a tap. Mounted once from app.vue, so in-app navigation never
// shows it.

// The least time the splash is up, from the page's first paint.
const SHOWN_MS = 2000

// Only a page as the server sent it has the splash: app.vue first rendered
// in the browser (after an error page's way back home) is in-app navigation.
const fromServer = import.meta.server || useNuxtApp().isHydrating

const key = JSON.stringify(SPLASH_SEEN_KEY)
useHead({
  style: [{ key: 'splash', innerHTML: 'html[data-splash-seen] [data-splash]{display:none}html[data-splash-skipped] [data-splash]{opacity:0;pointer-events:none}' }],
  // The script only where the server writes it into the page, with the
  // Content Security Policy's nonce (server/plugins/headers.ts). Added by the
  // browser it would have none, and nothing left to do.
  script: fromServer
    ? [{
        key: 'splash',
        tagPriority: 'critical',
        innerHTML: `try{if(sessionStorage.getItem(${key}))document.documentElement.dataset.splashSeen="";else sessionStorage.setItem(${key},"1")}catch(e){}`
          + 'document.addEventListener("click",function(e){if(e.target.closest&&e.target.closest("[data-splash]"))document.documentElement.dataset.splashSkipped=""},true)',
      }]
    : [],
})

const state = ref<'showing' | 'leaving' | 'gone'>(fromServer ? 'showing' : 'gone')
// For what waits for it to go (the Tour).
const splashUp = useSplashUp()
watch(state, shown => (splashUp.value = shown !== 'gone'), { immediate: true })
const timers: ReturnType<typeof setTimeout>[] = []
let paintWatch: PerformanceObserver | undefined

onMounted(() => {
  if (state.value === 'gone') return
  if (document.documentElement.dataset.splashSeen !== undefined) {
    state.value = 'gone'
    return
  }
  // Tapped away before the app was up: it is fading already.
  if (document.documentElement.dataset.splashSkipped !== undefined) {
    leave()
    return
  }
  afterFirstPaint(shownAt => timers.push(setTimeout(leave, Math.max(0, shownAt + SHOWN_MS - performance.now()))))
})
onBeforeUnmount(() => {
  timers.forEach(clearTimeout)
  paintWatch?.disconnect()
})

// Calls back with when the page first painted, on performance.now()'s clock
// (ms since it was asked for), once that is known: on a busy device the app
// can be up before the first paint. A browser without paint timing counts
// from the request.
function afterFirstPaint(then: (at: number) => void) {
  if (!PerformanceObserver.supportedEntryTypes?.includes('paint')) return then(0)
  paintWatch = new PerformanceObserver((entries) => {
    paintWatch!.disconnect()
    then(Math.min(...entries.getEntries().map(entry => entry.startTime)))
  })
  // Buffered: a paint that came before this still counts.
  paintWatch.observe({ type: 'paint', buffered: true })
}

function leave() {
  if (state.value !== 'showing') return
  state.value = 'leaving'
  timers.push(setTimeout(() => (state.value = 'gone'), motionMs('fade')))
}
</script>

<template>
  <div
    v-if="state !== 'gone'"
    class="splash fixed inset-0 z-[60] flex items-center justify-center"
    :class="{ leaving: state === 'leaving' }"
    aria-hidden="true"
    data-splash
    @click="leave"
  >
    <!-- The clip's 1080×1920 canvas: the icon 36% of its width, centred
         at 44% of its height; the wordmark 6% of its height below. -->
    <div class="stage relative">
      <svg
        viewBox="0 0 1080 1920"
        class="absolute inset-0 h-full w-full overflow-visible"
        data-splash-drawing
      >
        <defs>
          <linearGradient
            id="splash-icon"
            x1="0"
            y1="0"
            x2="1"
            y2="1"
          >
            <stop
              offset="0"
              stop-color="#FCD980"
            />
            <stop
              offset="1"
              stop-color="#F29B32"
            />
          </linearGradient>
          <!-- drop-shadow(0 24px 40px rgba(120,60,0,.25)) on the canvas. -->
          <filter
            id="splash-shadow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feDropShadow
              dx="0"
              dy="24"
              stdDeviation="20"
              flood-color="rgb(120,60,0)"
              flood-opacity=".25"
            />
          </filter>
        </defs>
        <g
          class="icon"
          data-layer="icon"
        >
          <!-- The icon (handoff icon/icon.svg) without its lid. -->
          <g filter="url(#splash-shadow)">
            <svg
              x="345.6"
              y="650.4"
              width="388.8"
              height="388.8"
              viewBox="0 0 108 108"
              overflow="visible"
            >
              <path
                d="M54 2C82 0 106 22 106 52C106 84 82 106 52 106C22 106 2 84 2 54C2 24 26 4 54 2Z"
                fill="url(#splash-icon)"
              />
              <g
                fill="#FFFBF2"
                opacity=".55"
              >
                <rect
                  x="44"
                  y="22"
                  width="5"
                  height="14"
                  rx="2.5"
                />
                <rect
                  x="59"
                  y="19"
                  width="5"
                  height="17"
                  rx="2.5"
                />
              </g>
              <g fill="#FFFBF2">
                <rect
                  x="18"
                  y="52"
                  width="12"
                  height="7"
                  rx="3.5"
                />
                <rect
                  x="78"
                  y="52"
                  width="12"
                  height="7"
                  rx="3.5"
                />
                <path d="M28 51H80V65A22 22 0 0 1 58 87H50A22 22 0 0 1 28 65Z" />
              </g>
              <ellipse
                cx="45"
                cy="66.5"
                rx="3"
                ry="3.5"
                fill="#E0891E"
              />
              <ellipse
                cx="63"
                cy="66.5"
                rx="3"
                ry="3.5"
                fill="#E0891E"
              />
              <path
                d="M50 72.5Q54 77 58 72.5"
                fill="none"
                stroke="#E0891E"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
          </g>
          <!-- Its lid (icon-layers/03-lid.svg), which pops on its own. -->
          <svg
            x="345.6"
            y="650.4"
            width="388.8"
            height="388.8"
            viewBox="0 0 108 108"
            overflow="visible"
          >
            <g
              class="lid"
              data-layer="lid"
            >
              <rect
                x="24"
                y="44"
                width="60"
                height="9"
                rx="4.5"
                fill="#FFFBF2"
              />
            </g>
          </svg>
        </g>
      </svg>
      <div class="wordmark absolute inset-x-0 flex items-baseline justify-center">
        <span
          class="word"
          data-layer="wordmark"
        >malkochen</span>
        <span
          class="dot"
          data-layer="dot"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* The clip's own background (gradient.icon), what the native splash shows
   too. Should the app's script never run (it failed to load, or hydration
   broke), the splash fades by itself all the same, well after it would have
   been gone; with reduced motion too, which would otherwise skip the wait. */
.splash {
  background: linear-gradient(160deg, #FCD980, #F29B32);
  transition: opacity var(--dur-fade) var(--ease-fade);
  animation: splash-fallback var(--dur-fade) var(--ease-fade) 4s forwards;
}
@media (prefers-reduced-motion: reduce) {
  .splash {
    animation-duration: var(--dur-fade) !important;
    animation-delay: 4s !important;
  }
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

/* A 9:16 column as tall as the window allows, and no wider than it. Its
   width is the canvas's 1080, which the wordmark is sized against. */
.stage {
  width: min(100%, 100dvh * 9 / 16);
  aspect-ratio: 9 / 16;
  container-type: inline-size;
}

/* Frames of the 30 fps clip, from f10: the lid pops up 14 and −12° at f12
   (ease-out) and lands at f16 (ease-in), about its own middle. */
.lid {
  transform-box: view-box;
  transform-origin: 54px 54px;
  animation: splash-lid 200ms linear both;
}
@keyframes splash-lid {
  0% { transform: translate(0px, 0px) rotate(0deg); animation-timing-function: cubic-bezier(0, 0, .58, 1) }
  33.3333% { transform: translate(0px, -14px) rotate(-12deg); animation-timing-function: cubic-bezier(.42, 0, 1, 1) }
  100% { transform: translate(0px, 0px) rotate(0deg) }
}

/* Petrona 500 at 12% of the canvas's width, its top at 1154.4 of 1920. */
.wordmark {
  top: 60.125%;
  gap: .06em;
  font-family: var(--font-display);
  font-weight: 500;
  font-size: 12cqw;
  color: #1F1E1C;
}
/* It rises 60 of the canvas's px (.463em) as it comes in, f13–16, ease-out. */
.word {
  animation: splash-word 100ms cubic-bezier(0, 0, .58, 1) 100ms both;
}
@keyframes splash-word {
  from { transform: translateY(.463em); opacity: 0 }
}
/* Its dot, the icon's face colour, pops: 1.3 at f15 (ease-out), 1 at f16. */
.dot {
  width: .2em;
  height: .2em;
  border-radius: 50%;
  background: #E0891E;
  animation: splash-dot 100ms linear 100ms both;
}
@keyframes splash-dot {
  0% { transform: scale(0); animation-timing-function: cubic-bezier(0, 0, .58, 1) }
  66.6667% { transform: scale(1.3); animation-timing-function: cubic-bezier(.42, 0, .58, 1) }
  100% { transform: scale(1) }
}

/* As it goes, the icon zooms to 1.9× and fades (f29–33, ease-in), about its
   centre, while the splash fades to the page. Reduced motion: it just fades
   with the splash. */
.icon {
  transform-box: view-box;
  transform-origin: 540px 844.8px;
}
@media (prefers-reduced-motion: no-preference) {
  .leaving .icon {
    animation: splash-icon-out 133ms cubic-bezier(.42, 0, 1, 1) forwards;
  }
}
@keyframes splash-icon-out {
  to { transform: scale(1.9); opacity: 0 }
}
</style>
