import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'
import { signOutAsking } from '~/board/unsent-account'

// Better Auth's browser client, for signing in and out (Google's redirect,
// email sign-in with a code). Session checks go through
// /api/auth/get-session with useFetch, so they also work during server
// rendering.
const authClient = createAuthClient({ plugins: [emailOTPClient()] })

export function useAuth() {
  const pushKey = useRuntimeConfig().public.vapidPublicKey
  const device = useDevice()
  const { ask } = useLeavingQuestion()

  // Signs out on the server. False when that didn't get through (no
  // connection, or malkochen not answering): the user is still signed in, so
  // nothing on the device may go. A 401 means the sign-in had expired already.
  async function signOutOnServer(): Promise<boolean> {
    try {
      // While still signed in: only the user can turn theirs off.
      await turnOffPushOnSignOut(pushKey)
      const { error } = await authClient.signOut()
      return !error || error.status === 401
    }
    catch {
      return false
    }
  }

  return {
    // Back to `callbackURL` once signed in: the Board used last, or the
    // invite landing, which then opens the invited Board.
    signInWithGoogle: (callbackURL = '/') => authClient.signIn.social({ provider: 'google', callbackURL }),
    // Email sign-in (#345): asks for a code to be emailed, then signs in
    // with it. Each answers Better Auth's { data, error }.
    askForSignInCode: (email: string) => authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }),
    signInWithCode: (email: string, otp: string) => authClient.signIn.emailOtp({ email, otp }),
    // The one place that signs out, for every sign-out button. With Unsent
    // Changes waiting it asks first (#463); the device is cleared only once
    // the server has signed the user out.
    signOut: async () => {
      const outcome = await signOutAsking({
        count: async () => await device?.unsentCount() ?? 0,
        ask: count => ask('signOut', count),
        signOut: signOutOnServer,
        // Nothing kept on the device stays for the next person (#461).
        forget: async () => {
          await device?.forget()
        },
      })
      if (outcome === 'failed') await ask('needsNet')
      if (outcome === 'signedOut') await navigateTo('/login')
    },
    // Another user signed in over Unsent Changes the first user made and
    // the first user's are to be kept: out again, the device left holding them.
    signOutKeepingUnsent: async () => {
      if (!await signOutOnServer()) return ask('needsNet').then(() => {})
      await device?.forget({ keepUnsent: true })
      await navigateTo('/login')
    },
  }
}
