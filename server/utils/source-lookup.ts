import { isDeployed } from '../env'
import { publicFetch } from '../source-lookup/public-network'
import { createRecipeLookup, createSourceLookup, type RecipeLookup, type SourceLookup } from '../source-lookup'
import { fixturePages, withFixtures, type LookupFixtures } from '../source-lookup/fixtures'

// The fixtures the test servers know (SOURCE_LOOKUP_FIXTURES); none anywhere
// else. Read on its own, not with the whole server environment: the backfill
// (source-facts-fill.ts) also runs this module in a process that has only the
// database's settings. Never on Vercel, whatever is set there (server/env.ts
// refuses it too).
export const lookupFixtures: LookupFixtures | null = (() => {
  const fixtures = process.env.SOURCE_LOOKUP_FIXTURES
  return fixtures && !isDeployed(process.env.VERCEL_ENV) ? JSON.parse(fixtures) as LookupFixtures : null
})()

// The app's one Source Lookup. Swapping in a paid unfurl service means
// changing only this line.
export const lookupSource: SourceLookup = lookupFixtures ? withFixtures(createSourceLookup(), lookupFixtures) : createSourceLookup()

// The app's one reading of a link's page for its recipe (#499), which the
// Recipe Finder uses. In tests the fixtures' pages stand in for the links
// that have one.
export const lookupRecipe: RecipeLookup = createRecipeLookup(lookupFixtures ? { fetch: fixturePages(lookupFixtures, publicFetch) } : {})
