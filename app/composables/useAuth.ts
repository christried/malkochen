import { createAuthClient } from 'better-auth/vue'

// Better Auth's browser client, for the redirects only (Google sign-in and
// sign-out). Session checks go through /api/auth/get-session with useFetch,
// so they also work during server rendering.
const authClient = createAuthClient()

export function useAuth() {
  const pushKey = useRuntimeConfig().public.vapidPublicKey
  return {
    // Back to `callbackURL` once signed in: the Board used last, or the
    // invite landing, which then opens the invited Board.
    signInWithGoogle: (callbackURL = '/') => authClient.signIn.social({ provider: 'google', callbackURL }),
    signOut: async () => {
      // While still signed in: only the user can turn theirs off.
      await turnOffPushOnSignOut(pushKey)
      await authClient.signOut()
      await navigateTo('/login')
    },
  }
}
