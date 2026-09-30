<script setup lang="ts">
import type { InviteView } from '~~/server/utils/invites'

// The invite landing (PRD stories 4, 64, 65): "Du wurdest zu 🍜 Kochclub
// eingeladen", then sign-in, then the Board. A signed-in user joins at once
// and lands on the Board; a Member just lands there. Signing in from here
// first remembers the invite (server/utils/invites.ts), so a refused sign-in
// can name the Owner and a later one still joins. The handoff's still for
// now; its clips (invite-intro, invite-loop) are wired in a later ticket.
const t = useStrings()
const route = useRoute()
const token = String(route.params.token)

const { data: invite } = await useFetch<InviteView>(`/api/invites/${token}`)
// The same request the page guard just made, so it isn't sent twice.
const { error: signedOut } = await useFetch('/api/me', { key: `me:${route.fullPath}` })

if (invite.value && !signedOut.value) {
  const { boardId } = await useRequestFetch()<{ boardId: string }>(`/api/invites/${token}/join`, { method: 'POST' })
  await navigateTo(`/b/${boardId}`, { replace: true })
}

const boardLabel = computed(() => invite.value ? `${invite.value.board.emoji} ${invite.value.board.name}` : '')
useHead({ title: () => invite.value ? `${t.invite.headline(boardLabel.value)} · ${t.app.name}` : t.app.name })

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
      <div class="relative w-[min(84vw,360px)] aspect-[26/25]">
        <div class="absolute inset-[6%] rounded-blob bg-[color-mix(in_srgb,var(--color-butter)_22%,var(--color-bg))]" />
        <div class="board-pebble absolute left-1/2 top-[14%] flex h-[42%] w-[42%] -translate-x-1/2 items-center justify-center bg-surface text-[64px] shadow-card">
          {{ invite.board.emoji }}
        </div>
        <img
          src="/illustrations/topfbert-happy.svg"
          alt=""
          class="absolute bottom-[4%] left-[4%] w-[40%]"
        >
        <img
          src="/illustrations/veggie-carrot.svg"
          alt=""
          class="absolute right-[10%] top-[8%] w-[12%]"
        >
        <img
          src="/illustrations/veggie-pepper.svg"
          alt=""
          class="absolute bottom-[14%] right-[8%] w-[13%]"
        >
        <ul
          class="absolute bottom-[10%] left-1/2 flex -translate-x-[10%]"
          :aria-label="t.invite.members"
        >
          <li
            v-for="member in invite.members.slice(0, 4)"
            :key="member.id"
            class="-ml-2 rounded-full ring-[2.5px] ring-bg first:ml-0"
          >
            <UserAvatar
              :name="member.name"
              :image="member.image"
              :size="36"
            />
            <span class="sr-only">{{ member.name }}</span>
          </li>
        </ul>
      </div>
      <h1 class="mt-8 max-w-md font-display text-display-m tablet:text-display-l">
        {{ t.invite.headline(boardLabel) }}
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

<style scoped>
/* The Board's emoji in a pebble, like Board settings and the switcher. */
.board-pebble {
  border-radius: var(--radius-blob);
}
</style>
