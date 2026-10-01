import withNuxt from './.nuxt/eslint.config.mjs'

// remotion/ is a separate project with its own lint setup (see remotion/README.md).
export default withNuxt({ ignores: ['remotion/'] })
