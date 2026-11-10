import { parseServerEnv } from '../env'
import { createSourceLookup, type SourceLookup } from '../source-lookup'
import { withFixtures, type LookupFixtures } from '../source-lookup/fixtures'

// The fixtures the test servers know (SOURCE_LOOKUP_FIXTURES); none anywhere else.
export const lookupFixtures: LookupFixtures | null = (() => {
  const { SOURCE_LOOKUP_FIXTURES } = parseServerEnv(process.env)
  return SOURCE_LOOKUP_FIXTURES ? JSON.parse(SOURCE_LOOKUP_FIXTURES) as LookupFixtures : null
})()

// The app's one Source Lookup. Swapping in a paid unfurl service means
// changing only this line.
export const lookupSource: SourceLookup = lookupFixtures ? withFixtures(createSourceLookup(), lookupFixtures) : createSourceLookup()
