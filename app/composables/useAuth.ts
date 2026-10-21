import { emailOTPClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

// Better Auth's browser client, for signing in and out (Google's redirect,
// email sign-in with a code). Session checks go through
// /api/auth/get-session with useFetch, so they also work during server
// rendering.
const authClient = createAuthClient({ plugins: [emailOTPClient()] })

export function useAuth() {
  const pushKey = useRuntimeConfig().public.vapidPublicKey
  return {
    // Back to `callbackURL` once signed in: the Board used last, or the
    // invite landing, which then opens the invited Board.
    signInWithGoogle: (callbackURL = '/') => authClient.signIn.social({ provider: 'google', callbackURL }),
    // Email sign-in (#345): asks for a code to be emailed, then signs in
    // with it. Each answers Better Auth's { data, error }.
    sendSignInCode: (email: string) => authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' }),
    signInWithCode: (email: string, otp: string) => authClient.signIn.emailOtp({ email, otp }),
    signOut: async () => {
      // While still signed in: only the user can turn theirs off.
      await turnOffPushOnSignOut(pushKey)
      await authClient.signOut()
      await navigateTo('/login')
    },
  }
}
