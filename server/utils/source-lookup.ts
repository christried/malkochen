import { isDeployed } from '../env'
import { createRecipeLookup, createSourceLookup, type RecipeLookup, type SourceLookup } from '../source-lookup'
import { withFixtures, withRecipeFixtures, type LookupFixtures } from '../source-lookup/fixtures'

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

// The app's one reader of the recipe a link's page carries (CONTEXT.md:
// Recipe Finder), with the same fixtures in the test servers.
export const lookupRecipe: RecipeLookup = lookupFixtures ? withRecipeFixtures(createRecipeLookup(), lookupFixtures) : createRecipeLookup()
