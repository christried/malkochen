// Staging (CONTEXT.md, #413): the Operator's own copy of malkochen, which is
// wherever Vercel runs the app as Preview: no other branch deploys. Where the
// code reads it:
// - nuxt.config.ts reads VERCEL_ENV at build time, for the response headers
//   (routeRules: X-Robots-Tag) and the page's label (the runtime flag). Every
//   answer, the files in public/ included, gets its headers from the build.
// - server/routes/manifest.webmanifest.ts reads it at runtime, from the env
//   the server validates (server/env.ts).
// Shared, so the rule is one line and tested without a server. (CI probe)

export function isStaging(vercelEnv: string | undefined): boolean {
  return vercelEnv === 'preview'
}

// The headers Staging adds to every answer. Production adds none.
export function stagingHeaders(vercelEnv: string | undefined): Record<string, string> {
  return isStaging(vercelEnv) ? { 'X-Robots-Tag': 'noindex' } : {}
}
