import { parseServerEnv } from '../env'

// Fail at boot, with every problem listed, rather than on the first request
// that happens to touch a missing variable.
export default defineNitroPlugin(() => {
  parseServerEnv(process.env)
})
