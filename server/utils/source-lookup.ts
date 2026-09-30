import { parseServerEnv } from '../env'
import { createSourceLookup, type SourceLookup } from '../source-lookup'

const env = parseServerEnv(process.env)

// The app's one Source Lookup. Swapping in a paid unfurl service means
// changing only this line.
export const lookupSource: SourceLookup = createSourceLookup({
  instagramAccessToken: env.META_APP_ID ? `${env.META_APP_ID}|${env.META_APP_SECRET}` : undefined,
})
