import withNuxt from './.nuxt/eslint.config.mjs'

// remotion/ is a separate project with its own lint setup (see remotion/README.md).
// docs/design process files/ and docs/design handoff/ are Claude Design's
// exports, kept as they came.
export default withNuxt({ ignores: ['remotion/', 'docs/design process files/', 'docs/design handoff/'] })
