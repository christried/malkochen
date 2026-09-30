import { createAuthClient } from 'better-auth/vue'

// Better Auth's browser client, for the redirects only (Google sign-in and
// sign-out). Session checks go through /api/auth/get-session with useFetch,
// so they also work during server rendering.
const authClient = createAuthClient()

export function useAuth() {
  return {
    signInWithGoogle: () => authClient.signIn.social({ provider: 'google', callbackURL: '/' }),
    signOut: async () => {
      await authClient.signOut()
      await navigateTo('/login')
    },
  }
}
