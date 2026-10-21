<script setup lang="ts">
import type { InviteView } from '~~/server/utils/invites'
import { boardLabel } from '~~/shared/board'
import type { Placeholder } from '~~/shared/placeholders'
import { shareReturnPath } from '~/utils/shared-link'

// Sign-in (Google, or email with a code: EmailSignIn), and the "Not
// unlocked" screen for a refused one: Better Auth sends a refused Google
// sign-in back here as /login?error=not_allowed (server/utils/auth.ts).
// Each loops its clip, drawn in code (SvgLoop): Topfbert wow, like the
// tiles' Placeholders, and not-unlocked (#217).
const t = useStrings()
const { signInWithGoogle } = useAuth()

// "Signing in" state: from the tap until the browser leaves for Google.
const signingIn = ref(false)
async function startGoogleSignIn() {
  signingIn.value = true
  try {
    await signInWithGoogle(returnPath.value)
  }
  catch {
    signingIn.value = false
  }
}
const route = useRoute()
// Back to what was shared to malkochen, if that's what brought the visitor
// here (middleware/auth.global.ts); else to the Board used last.
const returnPath = computed(() => shareReturnPath(typeof route.query.redirect === 'string' ? route.query.redirect : undefined))

// Email sign-in, if the server can send the code (RESEND_API_KEY). The
// email's link comes back here with the address and the code.
const emailSignIn = useRuntimeConfig().public.emailSignIn
const fromLink = typeof route.query.email === 'string' && typeof route.query.code === 'string'
  ? { email: route.query.email, code: route.query.code }
  : undefined

const notUnlocked = computed(() => route.query.error === 'not_allowed')
const failed = computed(() => Boolean(route.query.error) && !notUnlocked.value)

// Someone refused on the way in from an Invite Link is told to ask its Owner
// (PRD story 2). The invite stays remembered, so a later sign-in joins.
const { data: invite } = await useFetch<InviteView>('/api/invites/pending', {
  immediate: notUnlocked.value,
  watch: false,
})
const notUnlockedBody = computed(() => invite.value
  ? t.notUnlocked.invitedBody(invite.value.owner.name, boardLabel(invite.value.board))
  : t.notUnlocked.body)

// The sign-in hero (handoff motion.json "Sign-in orbit"): a ring of
// Placeholder Images around Topfbert. The tiles pop in one after another,
// then the ring turns once every 40s, the tiles staying upright, and every
// second tile loops its Placeholder: the three drawn for Round 11 among them.
// Not unlocked's sky circle, which Topfbert and his sign sit inside: centre
// 110 105, r 100 of the 220×210 drawing (public/clips/not-unlocked.svg).
const NOT_UNLOCKED_CIRCLE = { left: (10 / 220) * 100, top: (5 / 210) * 100, width: (200 / 220) * 100, height: (200 / 210) * 100 }

const HERO_PLACEHOLDERS: Placeholder[] = ['pasta', 'ramen', 'breakfast', 'burger', 'bowl', 'tacos', 'wok', 'cake']
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-bg text-text">
    <!-- The screen, centred in what the footer leaves of the window. -->
    <main class="flex flex-1 flex-col items-center justify-center bg-bg px-4 pb-6 pt-10 text-center">
      <template v-if="notUnlocked">
        <div class="relative aspect-[22/21] w-[min(80vw,330px)]">
          <ClipBlob
            accent="sky"
            :share="40"
            :circle="NOT_UNLOCKED_CIRCLE"
          />
          <SvgLoop
            src="/clips/not-unlocked"
            :themed="false"
            play
            transparent
          />
        </div>
        <h1 class="mt-8 font-display text-display-m tablet:text-display-l">
          {{ t.notUnlocked.headline }}
        </h1>
        <p class="mt-4 max-w-md text-body text-text-muted">
          {{ notUnlockedBody }}
        </p>
        <!-- Back to the sign-in choices: Google, or email if offered. -->
        <button
          v-if="emailSignIn"
          type="button"
          class="mt-8 rounded-pill bg-surface-muted px-6 py-4 text-button-l text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
          @click="navigateTo('/login')"
        >
          {{ t.notUnlocked.otherAccount }}
        </button>
        <button
          v-else
          type="button"
          class="mt-8 rounded-pill bg-surface-muted px-6 py-4 text-button-l text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-focus"
          :disabled="signingIn"
          :aria-busy="signingIn"
          @click="startGoogleSignIn"
        >
          {{ signingIn ? t.signIn.pending : t.notUnlocked.otherAccount }}
        </button>
      </template>

      <template v-else>
        <div class="relative aspect-square w-[min(88vw,360px)]">
          <div
            class="hero-orbit absolute inset-0"
            data-testid="hero-ring"
          >
            <div
              v-for="(placeholder, i) in HERO_PLACEHOLDERS"
              :key="placeholder"
              class="absolute left-1/2 top-1/2 -ml-[11%] -mt-[11%] aspect-square w-[22%]"
              :style="{ transform: `rotate(${i * 45}deg) translateY(-205%) rotate(${-i * 45}deg)` }"
            >
              <div class="hero-orbit hero-upright h-full w-full">
                <div
                  class="hero-pop h-full w-full overflow-hidden rounded-thumb shadow-card"
                  :style="{ '--i': i }"
                >
                  <PlaceholderClip
                    :placeholder="placeholder"
                    :motion="i % 2 === 0 ? 'loop' : null"
                  />
                </div>
              </div>
            </div>
          </div>
          <div class="absolute inset-[27%] overflow-hidden rounded-full">
            <SvgLoop
              src="/clips/topfbert-wow"
              play
            />
          </div>
        </div>
        <h1 class="mt-8 font-display text-display-m tablet:text-display-l desktop:text-display-xl">
          {{ t.signIn.headline.before }}<span class="app-name">{{ t.app.name }}</span>{{ t.signIn.headline.after }}
        </h1>
        <p class="mt-4 max-w-md text-body text-text-muted">
          {{ t.signIn.intro }}
        </p>
        <p
          v-if="failed"
          role="alert"
          class="mt-4 text-small text-danger"
        >
          {{ t.signIn.failed }}
        </p>
        <button
          type="button"
          class="mt-8 rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse shadow-fab transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-focus"
          :disabled="signingIn"
          :aria-busy="signingIn"
          @click="startGoogleSignIn"
        >
          {{ signingIn ? t.signIn.pending : t.signIn.google }}
        </button>
        <template v-if="emailSignIn">
          <p class="my-4 text-small text-text-muted">
            {{ t.signIn.or }}
          </p>
          <EmailSignIn
            :return-path="returnPath"
            :from-link="fromLink"
          />
        </template>
      </template>
    </main>
    <footer class="px-4 pb-4">
      <LegalLinks class="justify-center" />
    </footer>
  </div>
</template>

<style scoped>
/* The ring turns once every 40s; each tile turns back as much, so it stays
   upright. Reduced motion (main.css) leaves it still. */
.hero-orbit {
  animation: hero-orbit 40s linear infinite;
}
.hero-upright {
  animation-direction: reverse;
}
@keyframes hero-orbit {
  to {
    rotate: 360deg;
  }
}
/* The app's name in the headline: coloured, on a marker stroke across its
   lower half. Both colours keep 4.5:1 (main.css). */
.app-name {
  color: var(--color-name-ink);
  background-image: linear-gradient(transparent 55%, var(--color-name-mark) 55%, var(--color-name-mark) 92%, transparent 92%);
  padding-inline: 0.06em;
  margin-inline: -0.06em;
}
/* The tiles pop in around Topfbert, one after another. */
.hero-pop {
  animation: hero-pop var(--dur-pop) var(--ease-pop) calc(var(--i) * var(--dur-stagger)) both;
}
@keyframes hero-pop {
  from {
    scale: 0;
  }
}
</style>
