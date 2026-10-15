// Typed as a plain string: Nitro's route typing runs too deep here.
const EMAIL_DIGEST: string = '/api/me/email-digest'

// The Email Digest in your settings (#220): whether the server offers it at
// all (it has a Resend API key), whether you switched it on (null until
// known), and switching it. One switch for all your Boards and devices, kept
// on the server. `failed`: the last switch didn't work out.
export function useEmailDigest() {
  const offered = useRuntimeConfig().public.emailDigest
  const on = ref<boolean | null>(null)
  const busy = ref(false)
  const failed = ref(false)

  async function refresh() {
    if (!offered || import.meta.server) return
    failed.value = false
    try {
      on.value = (await $fetch<{ on: boolean }>(EMAIL_DIGEST)).on
    }
    catch {
      on.value = false
    }
  }

  async function turn(next: boolean) {
    if (!offered || busy.value) return
    busy.value = true
    failed.value = false
    try {
      await $fetch(EMAIL_DIGEST, { method: next ? 'PUT' : 'DELETE' })
      on.value = next
    }
    catch {
      failed.value = true
    }
    finally {
      busy.value = false
    }
  }

  return { offered, on, busy, failed, refresh, turn }
}
