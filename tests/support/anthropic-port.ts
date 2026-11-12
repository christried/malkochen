// Where the stand-in for Anthropic listens (anthropic-service.ts). On its own
// so that the Source Lookup fixtures can name it in a Caption without a cycle
// with test-auth-env.ts, which imports them.
export const ANTHROPIC_PORT = 3196
