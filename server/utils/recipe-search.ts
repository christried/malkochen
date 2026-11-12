import { and, eq, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { RecipeSearchAnswer } from '../../shared/recipe'
import { db } from '../db'
import { dish } from '../db/schema'
import { parseServerEnv } from '../env'
import { createRecipeFinder, type RecipeFinderResult } from '../recipe-finder'
import type { SourceKind } from '../source-lookup'
import { createRecipeReader } from '../recipe-finder/model'
import { SEARCH_LOOKS_FOR, membersDish, onMembersBoard } from './dishes'
import { dishEvent, withEvents } from './events'
import { requireDishPermission } from './permission-checks'
import { refundRateLimit, spendRateLimit, spendRateLimitIfWithin } from './rate-limit'
import { recipeFinderStateOf } from './recipe-finder'
import { dishNotFound } from './session'
import { lookupDestination, lookupPage, lookupRecipe } from './source-lookup'

// "Rezept finden" (CONTEXT.md: Recipe Finder, #500): the Dish side of the
// Recipe Finder. Whether the user may search, which Dish is looked at, the
// daily cap, the search state the Dish records and what the Board then shows
// are decided here; how a Recipe is found is the Recipe Finder's alone. It
// also covers the search after adding a Dish (#503), which starts by itself.

const env = parseServerEnv(process.env)

// The app's one Recipe Finder, which reads Captions and the pages they point
// to with Claude Haiku when there is an Anthropic API key. Without one it
// does nothing at all
// (`recipeFinderAvailable`): no search starts, and the server says so in what
// it serves, so "Rezept finden" isn't offered.
export const recipeFinderAvailable = env.ANTHROPIC_API_KEY !== ''
const findRecipe = createRecipeFinder({
  lookupRecipe,
  lookupPage,
  lookupDestination,
  readRecipe: recipeFinderAvailable ? createRecipeReader({ apiKey: env.ANTHROPIC_API_KEY, baseURL: env.ANTHROPIC_BASE_URL || undefined }) : null,
})

// No Recipe in the Dish yet: neither Ingredients nor Steps.
const hasNoRecipe = sql`cardinality(${dish.recipeIngredients}) = 0 and cardinality(${dish.recipeSteps}) = 0`

function textArray(lines: string[]): SQL {
  return sql`array[${sql.join(lines.map(line => sql`${line}`), sql`, `)}]::text[]`
}

function refused(statusCode: number, statusMessage: string) {
  return createError({ statusCode, statusMessage })
}

// Why a Dish couldn't be claimed for a search, from what it holds now.
async function whyNotClaimed(dishId: string, userId: string) {
  const [found] = await db
    .select({ sourceLink: dish.sourceLink, ingredients: dish.recipeIngredients, steps: dish.recipeSteps, search: dish.recipeSearch })
    .from(dish)
    .where(onMembersBoard(dishId, userId))
  if (!found) return dishNotFound()
  if (!found.sourceLink) return refused(409, 'Dish has no Source')
  if (found.ingredients.length > 0 || found.steps.length > 0) return refused(409, 'Dish has a Recipe')
  if (found.search === 'none') return refused(409, 'Nothing found for this Source')
  return refused(409, 'Already looking')
}

// Writes what a search ended in, if the Dish is still the one it claimed
// (still 'looking' since `startedAt`): a Source changed meanwhile cleared the
// state, and a search that went stale was claimed by another. Then nothing is
// written and nothing logged. The event is recorded with the change.
function finish(dishId: string, startedAt: Date, userId: string, found: RecipeFinderResult) {
  const claimed = and(eq(dish.id, dishId), eq(dish.recipeSearch, 'looking'), eq(dish.recipeSearchAt, startedAt))
  const returning = { id: dish.id, boardId: dish.boardId }
  if (found.outcome === 'found') {
    // A Member who typed a Recipe meanwhile wins: theirs stays, and the search
    // is over all the same.
    const whenEmpty = (fresh: SQL, kept: SQL) => sql`case when ${hasNoRecipe} then ${fresh} else ${kept} end`
    return withEvents(
      db,
      db.update(dish).set({
        recipeSearch: null,
        recipeSearchAt: null,
        recipeIngredients: whenEmpty(textArray(found.recipe.ingredients), sql`${dish.recipeIngredients}`),
        recipeSteps: whenEmpty(textArray(found.recipe.steps), sql`${dish.recipeSteps}`),
        recipeLink: whenEmpty(sql`${found.link}::text`, sql`${dish.recipeLink}`),
      }).where(claimed).returning(returning),
      dishEvent('recipe_found', userId),
    )
  }
  if (found.outcome === 'none') {
    return withEvents(db, db.update(dish).set({ recipeSearch: 'none', recipeSearchAt: null }).where(claimed).returning(returning), dishEvent('recipe_not_found', userId))
  }
  return withEvents(db, db.update(dish).set({ recipeSearch: null, recipeSearchAt: null }).where(claimed).returning(returning), dishEvent('recipe_search_failed', userId))
}

// The user looks for the Recipe of a Dish ("Rezept finden"). Refused (403)
// unless the Recipe Finder is on for them and they may edit the Dish, 503
// without an Anthropic API key, 404 for a Dish they can't see, and 409 unless
// the Dish has a Source, no Recipe and no search under way or nothing found
// for its Source; 429 once they used up
// the day's searches. Answers how the search ended and the Dish as it is
// then: a failed search (the page didn't answer) is an answer, and costs no
// search of the day.
export async function findRecipeFor(dishId: string, userId: string): Promise<RecipeSearchAnswer> {
  // Before anything is claimed, spent or fetched.
  if (!recipeFinderAvailable) throw refused(503, 'Recipe Finder is not set up')
  await requireDishPermission(dishId, userId, 'editDishes')
  if ((await recipeFinderStateOf(userId)).state !== 'on') throw refused(403, 'Recipe Finder is off')

  // One statement, so two taps can't both search. A search that has looked for
  // too long counts as over and may be claimed again.
  const startedAt = new Date()
  const [claimed] = await db
    .update(dish)
    .set({ recipeSearch: 'looking', recipeSearchAt: startedAt })
    .where(and(
      onMembersBoard(dishId, userId),
      isNotNull(dish.sourceLink),
      hasNoRecipe,
      or(isNull(dish.recipeSearch), and(eq(dish.recipeSearch, 'looking'), sql`${dish.recipeSearchAt} < now() - ${SEARCH_LOOKS_FOR}::interval`)),
    ))
    .returning({ link: dish.sourceLink, kind: dish.sourceKind, caption: dish.caption })
  if (!claimed?.link || !claimed.kind) throw await whyNotClaimed(dishId, userId)

  try {
    await spendRateLimit(userId, 'recipe-search')
  }
  catch (error) {
    await db.update(dish).set({ recipeSearch: null, recipeSearchAt: null }).where(and(eq(dish.id, dishId), eq(dish.recipeSearch, 'looking'), eq(dish.recipeSearchAt, startedAt)))
    throw error
  }

  const result = await searchClaimed(dishId, startedAt, userId, { link: claimed.link, kind: claimed.kind, caption: claimed.caption })

  const searched = await membersDish(dishId, userId)
  if (!searched) throw dishNotFound()
  return { outcome: result.outcome, dish: searched }
}

// The search of a Dish already claimed as looking at `startedAt` and paid
// for: finds, writes how it ended (finish) and gives the day's search back if
// it failed. A finder that throws, which it isn't meant to, is a failed
// search, so the Dish is never left looking.
async function searchClaimed(
  dishId: string,
  startedAt: Date,
  userId: string,
  source: { link: string, kind: SourceKind, caption: string | null },
): Promise<RecipeFinderResult> {
  const result = await findRecipe(source).catch((): RecipeFinderResult => ({ outcome: 'failed' }))
  await finish(dishId, startedAt, userId, result)
  if (result.outcome === 'failed') await refundRateLimit(userId, 'recipe-search')
  return result
}

// Whether a Dish being added is searched for its Recipe after adding (#503),
// and if so the time the search starts, which the Dish is added as looking
// since. Null, and nothing spent, unless there is an Anthropic API key, the
// Dish has a Source and the adder has the Recipe Finder on; and null at the
// day's cap, where the add itself is unaffected. Otherwise one of the
// adder's day's searches is spent, which the caller gives back
// (refundRateLimit) if the Dish is then not added. The adder may always
// edit their own Dish, so there is no permission to check.
export async function searchOnAdding(adderId: string, source: { link: string } | null): Promise<Date | null> {
  if (!recipeFinderAvailable) return null
  if (!source) return null
  if ((await recipeFinderStateOf(adderId)).state !== 'on') return null
  if (!await spendRateLimitIfWithin(adderId, 'recipe-search')) return null
  return new Date()
}

// The search after adding, run once the add was answered: for the Dish added
// as looking at `startedAt`, if it still is that (the Source changed
// meanwhile, or a stale search was claimed again by "Rezept finden", and then
// nothing is looked for).
export async function searchAfterAdding(dishId: string, startedAt: Date, userId: string): Promise<void> {
  const [claimed] = await db
    .select({ link: dish.sourceLink, kind: dish.sourceKind, caption: dish.caption })
    .from(dish)
    .where(and(eq(dish.id, dishId), eq(dish.recipeSearch, 'looking'), eq(dish.recipeSearchAt, startedAt)))
  if (!claimed?.link || !claimed.kind) return
  await searchClaimed(dishId, startedAt, userId, { link: claimed.link, kind: claimed.kind, caption: claimed.caption })
}
