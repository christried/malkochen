import withNuxt from './.nuxt/eslint.config.mjs'

// remotion/ is a separate project with its own lint setup (see remotion/README.md).
// docs/design process files/ is Claude Design's export, kept as it came.
export default withNuxt({ ignores: ['remotion/', 'docs/design process files/'] })
