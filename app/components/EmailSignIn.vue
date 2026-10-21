<script setup lang="ts">
// Email sign-in with a code (#345, ADR 0007), below Google on the sign-in
// page: an email address, then the 6-digit code emailed to it, typed here
// where sign-in started. The email's link opens the sign-in page with both
// (`fromLink`), which signs in at once. An address the sign-in gate refuses
// gets the "Not unlocked" screen, like a refused Google sign-in.
const props = defineProps<{
  // Where to go once signed in.
  returnPath: string
  fromLink?: { email: string, code: string }
}>()

const t = useStrings()
const { sendSignInCode, signInWithCode } = useAuth()

// How long until another code can be asked for. Better Auth allows a few a
// minute per IP address (server/utils/auth.ts).
const RESEND_WAIT_SECONDS = 30
const CODE_LENGTH = 6

const email = ref(props.fromLink?.email ?? '')
const code = ref('')
// Whether a code is on its way, so the code field shows.
const sent = ref(Boolean(props.fromLink))
const busy = ref(false)
const problem = ref<string | null>(null)
const waitSeconds = ref(0)

let ticking: ReturnType<typeof setInterval> | undefined
function startWait() {
  waitSeconds.value = RESEND_WAIT_SECONDS
  clearInterval(ticking)
  ticking = setInterval(() => {
    waitSeconds.value--
    if (waitSeconds.value <= 0) clearInterval(ticking)
  }, 1000)
}
onBeforeUnmount(() => clearInterval(ticking))

interface AuthError { status: number, code?: string }

async function refuse(error: AuthError) {
  if (error.status === 403 && error.code === 'not_allowed') {
    await navigateTo({ path: '/login', query: { error: 'not_allowed' } })
    return
  }
  problem.value = error.status === 429
    ? t.signIn.tooFast
    : ({
        INVALID_OTP: t.signIn.wrongCode,
        TOO_MANY_ATTEMPTS: t.signIn.tooManyTries,
        OTP_EXPIRED: t.signIn.codeExpired,
      } as Record<string, string>)[error.code ?? ''] ?? t.signIn.failed
}

async function askForCode() {
  if (busy.value || waitSeconds.value > 0) return
  busy.value = true
  problem.value = null
  try {
    const { error } = await sendSignInCode(email.value.trim())
    if (error) return await refuse(error)
    sent.value = true
    code.value = ''
    startWait()
  }
  catch {
    problem.value = t.signIn.failed
  }
  finally {
    busy.value = false
  }
}

async function signIn() {
  if (busy.value || code.value.length !== CODE_LENGTH) return
  busy.value = true
  problem.value = null
  try {
    const { error } = await signInWithCode(email.value.trim(), code.value)
    if (error) {
      busy.value = false
      return await refuse(error)
    }
    // A fresh load, as after Google's redirect: the app starts signed in.
    window.location.assign(props.returnPath)
  }
  catch {
    busy.value = false
    problem.value = t.signIn.failed
  }
}

// Only digits; the whole code typed (or pasted, or filled in from the
// email by the phone) signs in.
watch(code, (typed) => {
  const digits = typed.replace(/\D/g, '').slice(0, CODE_LENGTH)
  if (digits !== typed) code.value = digits
  else if (digits.length === CODE_LENGTH) void signIn()
})

function otherEmail() {
  sent.value = false
  code.value = ''
  problem.value = null
}

onMounted(() => {
  if (props.fromLink) code.value = props.fromLink.code
})

const emailId = useId()
const codeId = useId()
const problemId = useId()
</script>

<template>
  <form
    v-if="!sent"
    class="flex w-full max-w-sm flex-col gap-3"
    @submit.prevent="askForCode"
  >
    <AppField
      :label="t.signIn.email"
      :control-id="emailId"
    >
      <input
        :id="emailId"
        v-model="email"
        type="email"
        required
        autocomplete="email"
        autocapitalize="off"
        spellcheck="false"
        :aria-invalid="problem ? true : undefined"
        :aria-describedby="problem ? problemId : undefined"
      >
    </AppField>
    <button
      type="submit"
      class="rounded-pill bg-surface-muted px-6 py-4 text-button-l text-text transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-focus"
      :disabled="busy"
      :aria-busy="busy"
    >
      <BusyLabel
        :label="t.signIn.sendCode"
        :busy-label="t.signIn.pending"
        :busy="busy"
      />
    </button>
    <p
      v-if="problem"
      :id="problemId"
      role="alert"
      class="text-small text-danger"
    >
      {{ problem }}
    </p>
  </form>

  <form
    v-else
    class="flex w-full max-w-sm flex-col gap-3"
    @submit.prevent="signIn"
  >
    <p class="text-body text-text-muted">
      {{ t.signIn.codeSent(email.trim()) }}
    </p>
    <AppField
      :label="t.signIn.code"
      :control-id="codeId"
    >
      <input
        :id="codeId"
        v-model="code"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        :maxlength="CODE_LENGTH"
        autofocus
        class="font-display text-title-s tracking-[0.3em]"
        :aria-invalid="problem ? true : undefined"
        :aria-describedby="problem ? problemId : undefined"
      >
    </AppField>
    <p
      v-if="problem"
      :id="problemId"
      role="alert"
      class="text-small text-danger"
    >
      {{ problem }}
    </p>
    <button
      type="submit"
      class="rounded-pill bg-inverse px-6 py-4 text-button-l text-on-inverse shadow-fab transition-transform duration-tap ease-tap active:scale-95 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-focus"
      :disabled="busy || code.length !== CODE_LENGTH"
      :aria-busy="busy"
    >
      <BusyLabel
        :label="t.signIn.withCode"
        :busy-label="t.signIn.pending"
        :busy="busy"
      />
    </button>
    <div class="flex justify-center gap-6 text-small">
      <button
        type="button"
        class="text-text-muted underline disabled:no-underline disabled:opacity-70"
        :disabled="busy || waitSeconds > 0"
        @click="askForCode"
      >
        {{ waitSeconds > 0 ? t.signIn.resendIn(waitSeconds) : t.signIn.resend }}
      </button>
      <button
        type="button"
        class="text-text-muted underline"
        @click="otherEmail"
      >
        {{ t.signIn.otherEmail }}
      </button>
    </div>
  </form>
</template>
