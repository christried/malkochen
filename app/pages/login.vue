<script setup lang="ts">
// Sign-in, and the "Not unlocked" screen for a refused one: Better Auth sends
// a refused Google sign-in back here as /login?error=not_allowed
// (server/utils/auth.ts). Both are the handoff's stills for now; their motion
// graphics (topfbert-wow, not-unlocked) are wired in a later ticket.
const t = useStrings()
const { signInWithGoogle } = useAuth()

// "Signing in" state: from the tap until the browser leaves for Google.
const signingIn = ref(false)
async function startGoogleSignIn() {
  signingIn.value = true
  try {
    await signInWithGoogle()
  }
  catch {
    signingIn.value = false
  }
}
const route = useRoute()

const notUnlocked = computed(() => route.query.error === 'not_allowed')
const failed = computed(() => Boolean(route.query.error) && !notUnlocked.value)

// The sign-in hero's ring of Placeholder Images around Topfbert.
const HERO_PLACEHOLDERS = ['pasta', 'ramen', 'curry', 'bowl', 'tacos', 'pizza', 'wok', 'cake']
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10 text-center text-text">
    <template v-if="notUnlocked">
      <div class="relative w-[min(80vw,330px)] aspect-[22/21]">
        <div class="absolute inset-[12%] rounded-blob bg-sky opacity-40" />
        <img
          src="/illustrations/topfbert-happy.svg"
          alt=""
          class="absolute bottom-0 left-[8%] w-[62%]"
        >
        <img
          src="/illustrations/sign.svg"
          alt=""
          class="absolute right-[2%] top-[6%] w-[42%]"
        >
      </div>
      <h1 class="mt-8 font-display text-display-m tablet:text-display-l">
        {{ t.notUnlocked.headline }}
      </h1>
      <p class="mt-4 max-w-md text-body text-text-muted">
        {{ t.notUnlocked.body }}
      </p>
      <button
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
      <div class="relative w-[min(88vw,360px)] aspect-square">
        <img
          v-for="(placeholder, i) in HERO_PLACEHOLDERS"
          :key="placeholder"
          :src="`/placeholders/${placeholder}-light.svg`"
          alt=""
          class="absolute left-1/2 top-1/2 -ml-[11%] -mt-[11%] w-[22%] rounded-thumb shadow-card"
          :style="{ transform: `rotate(${i * 45}deg) translateY(-205%) rotate(${-i * 45}deg)` }"
        >
        <div class="absolute inset-[27%] rounded-full bg-[color-mix(in_srgb,var(--color-butter)_22%,var(--color-bg))]">
          <img
            src="/illustrations/topfbert-wow.svg"
            alt=""
            class="h-full w-full p-[12%]"
          >
        </div>
      </div>
      <p class="mt-8 text-overline uppercase text-text-muted">
        {{ t.app.name }}
      </p>
      <h1 class="mt-3 font-display text-display-m tablet:text-display-l desktop:text-display-xl">
        {{ t.signIn.headline }}
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
    </template>
  </main>
</template>
