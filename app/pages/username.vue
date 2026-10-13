<script setup lang="ts">
// Your Username, before anything else (issue #209): a new user picks one
// here before their first Board; a user from before Usernames is asked once
// whether the one made from their Google first name fits ("Passt dein
// Name?"), and keeps it with one tap or changes it. The page guard
// (middleware/auth.global.ts) sends both here, with where they were going,
// and nobody else.
const t = useStrings()
const route = useRoute()
const { signOut } = useAuth()

const { data: me } = await useMe()
// Which of the two it is, as the page opened: saving ends the question, but
// the screen stays what it was until it is left.
const confirming = me.value?.usernamePrompt === 'confirm'
const { typed, changed, message, saving, save } = useUsernameForm(me)

// Back to where the guard caught them; only ever a path of this app.
const target = computed(() => {
  const redirect = route.query.redirect
  return typeof redirect === 'string' && /^\/(?![/\\])/.test(redirect) ? redirect : '/'
})

async function submit() {
  if (await save()) await navigateTo(target.value, { replace: true })
}

const fieldId = useId()
const hintId = useId()
const headline = confirming ? t.username.confirmHeadline : t.username.pickHeadline
useHead({ title: () => `${headline} · ${t.app.name}` })
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-bg text-text">
    <main class="flex flex-1 flex-col items-center justify-center px-4 pb-6 pt-10 text-center">
      <div class="size-[min(40vw,150px)] overflow-hidden rounded-full">
        <SvgLoop
          src="/clips/topfbert-wow"
          play
        />
      </div>
      <h1 class="mt-8 font-display text-display-m tablet:text-display-l">
        {{ headline }}
      </h1>
      <p class="mt-4 max-w-md text-body text-text-muted">
        {{ confirming ? t.username.confirmBody : t.username.pickBody }}
      </p>
      <form
        class="mt-8 flex w-full max-w-[360px] flex-col gap-3 text-left"
        novalidate
        @submit.prevent="submit"
      >
        <AppField
          :label="t.username.label"
          :control-id="fieldId"
        >
          <input
            :id="fieldId"
            v-model="typed"
            type="text"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            autofocus
            :aria-invalid="message ? true : undefined"
            :aria-describedby="hintId"
            class="font-display text-title-s"
          >
        </AppField>
        <p
          :id="hintId"
          class="field-helper -mt-3"
          :class="{ 'text-danger': message }"
          :role="message ? 'alert' : undefined"
        >
          {{ message ?? t.username.hint }}
        </p>
        <button
          type="submit"
          class="mt-3 rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse shadow-fab transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          :disabled="saving"
        >
          <BusyLabel
            :label="confirming && !changed ? t.username.keep : t.username.pick"
            :busy-label="t.username.saving"
            :busy="saving"
          />
        </button>
        <p class="text-center text-small text-text-muted">
          {{ t.username.later }}
        </p>
      </form>
    </main>
    <footer class="flex flex-col items-center gap-3 px-4 pb-4">
      <button
        type="button"
        class="rounded-pill px-4 py-2 text-small text-text-muted focus-visible:outline-2 focus-visible:outline-focus"
        @click="signOut"
      >
        {{ t.userSettings.signOut }}
      </button>
      <LegalLinks class="justify-center" />
    </footer>
  </div>
</template>
