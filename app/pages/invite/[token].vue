<script setup lang="ts">
import type { InviteView } from '~~/server/utils/invites'
import { boardPath } from '~~/shared/address'
import { boardLabel } from '~~/shared/board'

// The invite landing (PRD stories 4, 64, 65): "Du wurdest zu 🍜 Kochclub
// eingeladen", then sign-in, then the Board. A signed-in user joins at once
// and lands on the Board; a Member just lands there. Signing in from here
// first remembers the invite (server/utils/invites.ts), so a refused sign-in
// can name the Owner and a later one still joins. Over its clip (InviteClip).
const t = useStrings()
const route = useRoute()
const token = String(route.params.token)
const fetchPassingCookies = useFetchPassingCookies()

// Too many links that don't exist asked for from here, for now (429,
// server/utils/invites.ts): not a link that stopped working, so the error
// screen says to try again soon.
const tooMany = (status: number | undefined) => status === 429
  ? createError({ statusCode: 429, statusMessage: 'Too many Invite Links not found', fatal: true })
  : null

const { data: invite, error: lookupFailed } = await useFetch<InviteView>(`/api/invites/${token}`)
const lookupRefused = tooMany(lookupFailed.value?.statusCode)
if (lookupRefused) throw lookupRefused
// The same request the page guard just made, so it isn't sent twice. It
// fails for anyone who can't use the app yet: 401 signed out, 403 signed in
// but off the Allowlist.
const { error: noAccess } = await useFetch('/api/me', { key: `me:${route.fullPath}` })

if (invite.value && !noAccess.value) {
  // Joining also clears a remembered invite, hence the cookies.
  const joined = await fetchPassingCookies<{ boardId: string, slug: string }>(`/api/invites/${token}/join`, { method: 'POST' }).catch((err: { statusCode?: number }) => {
    const refused = tooMany(err.statusCode)
    if (refused) throw refused
    return null
  })
  // A link reset since it was looked up shows as not working.
  if (joined) await navigateTo(boardPath(joined), { replace: true })
  else invite.value = undefined
}
else if (invite.value && noAccess.value?.statusCode === 403) {
  // Off the Allowlist: signing in again can't help. Remember the invite and
  // go straight to "Not unlocked", which names whom to ask.
  await fetchPassingCookies(`/api/invites/${token}/remember`, { method: 'POST' }).catch(() => null)
  await navigateTo({ path: '/login', query: { error: 'not_allowed' } }, { replace: true })
}

const invitedTo = computed(() => invite.value ? boardLabel(invite.value.board) : '')
useHead({ title: () => invite.value ? `${t.invite.headline(invitedTo.value)} · ${t.app.name}` : t.app.name })

const { signInWithGoogle } = useAuth()

// "Signing in" state: from the tap until the browser leaves for Google.
const signingIn = ref(false)
const failed = ref(false)
async function startGoogleSignIn() {
  signingIn.value = true
  failed.value = false
  try {
    await $fetch(`/api/invites/${token}/remember`, { method: 'POST' })
    await signInWithGoogle(`/invite/${token}`)
  }
  catch {
    signingIn.value = false
    failed.value = true
  }
}
</script>

<template>
  <main class="flex min-h-dvh flex-col items-center justify-center bg-bg px-4 py-10 text-center text-text">
    <template v-if="invite">
      <InviteClip :invite="invite" />
      <h1 class="mt-8 max-w-md font-display text-display-m tablet:text-display-l">
        {{ t.invite.headline(invitedTo) }}
      </h1>
      <p class="mt-4 max-w-md text-body text-text-muted">
        {{ t.invite.body(invite.owner.name) }}
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

    <template v-else>
      <img
        src="/illustrations/topfbert-oops.svg"
        alt=""
        class="w-[min(60vw,240px)]"
      >
      <h1 class="mt-8 font-display text-display-m">
        {{ t.invite.invalidHeadline }}
      </h1>
      <p class="mt-4 max-w-md text-body text-text-muted">
        {{ t.invite.invalidBody }}
      </p>
      <NuxtLink
        to="/"
        class="mt-8 rounded-pill bg-surface-muted px-6 py-4 text-button-l text-text transition-transform duration-tap ease-tap active:scale-95 focus-visible:outline-2 focus-visible:outline-focus"
      >
        {{ t.invite.toApp }}
      </NuxtLink>
    </template>
  </main>
</template>
