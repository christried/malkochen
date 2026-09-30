// The Allowlist (CONTEXT.md): the fixed set of email addresses allowed to sign
// in at all, configured as ALLOWLIST_EMAILS (comma-separated).
export function isAllowlisted(email: string, allowlistCsv: string): boolean {
  const allowed = allowlistCsv.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email.trim().toLowerCase())
}

// The refusal Better Auth hands back to the client. The code is what the
// sign-in page keys on to show "Not unlocked" (app/pages/login.vue).
export const NOT_ALLOWLISTED = { error: 'not_allowed', errorDescription: 'Not on the Allowlist' } as const
