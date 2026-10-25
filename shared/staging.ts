// Staging (CONTEXT.md, #413): the Operator's own copy of malkochen, which is
// wherever Vercel runs the app as Preview: no other branch deploys. The
// server decides it at runtime from VERCEL_ENV (server/env.ts), the page from
// a public runtime flag set at build time from the same value
// (nuxt.config.ts). Shared, so the rule is one line and tested without a server.

export function isStaging(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'preview'
}
