import { and, eq, isNull, lt, or, sql } from 'drizzle-orm'
import { db } from '../db'
import { dish } from '../db/schema'
import { createRecipeFinder, type RecipeFinder, type RecipeFinderSource } from '../recipe-finder'
import { membersDish, RECIPE_SEARCH_GIVES_UP_AFTER, type DishView } from './dishes'
import { dishEvent, withEvents } from './events'
import { requireDishPermission } from './permission-checks'
import { refundRateLimit, spendRateLimitIfWithin } from './rate-limit'
import { recipeFinderStateOf } from './recipe-finder'
import { dishNotFound } from './session'
import { lookupRecipe } from './source-lookup'

// "Rezept finden" (#500): a Member whose Recipe Finder is on searches a Dish
// that has a Source and no Recipe. Who may search (the Recipe Finder switch,
// "edit Dishes" on the Dish), the daily cap, the Dish's search state
// ('looking' while it runs, 'none' once nothing was found for its Source) and
// what a finished search writes all live here. The looking itself is
// server/recipe-finder. A search is started and finished in two steps, so
// the answer can go out before the search ends.

// The app's one Recipe Finder.
export const findRecipe: RecipeFinder = createRecipeFinder({ lookupRecipe })

export type RecipeSearchRefusal
  // The user's Recipe Finder is not on.
  = | 'recipe-finder-off'
  // The Dish has no Source to search.
    | 'no-source'
  // The Dish already has a Recipe.
    | 'has-recipe'
  // Nothing was found for the Dish's current Source.
    | 'nothing-found'
  // A search of the Dish is running already.
    | 'looking'
  // The user has used up their searches for the day.
    | 'daily-limit'

export type RecipeSearchOutcome = 'found' | 'none' | 'failed'

// What the endpoint answers: how the search ended, and the Dish as it is now.
export interface RecipeSearchAnswer {
  outcome: RecipeSearchOutcome
  dish: DishView
}

function refused(reason: RecipeSearchRefusal, statusCode: number) {
  return createError({ statusCode, statusMessage: 'No Recipe search', data: { reason } })
}

// The Dish has neither Ingredients nor Steps.
const recipeEmpty = sql`(cardinality(${dish.recipeIngredients}) = 0 and cardinality(${dish.recipeSteps}) = 0)`

// The lines as a text[] in SQL, in their order. JSON, not the array itself:
// Drizzle would expand a JS array into a list of parameters.
const linesOf = (lines: string[]) => sql`array(select line.value from jsonb_array_elements_text(${JSON.stringify(lines)}::jsonb) with ordinality as line(value, position) order by line.position)`

// Checks that the user may search the Dish and claims it for the search,
// so two searches at once can't both run. Throws the refusal otherwise.
export async function startRecipeSearch(dishId: string, userId: string): Promise<RecipeFinderSource> {
  if ((await recipeFinderStateOf(userId)).state !== 'on') throw refused('recipe-finder-off', 403)
  await requireDishPermission(dishId, userId, 'editDishes')
  const found = await membersDish(dishId, userId)
  if (!found) throw dishNotFound()
  if (!found.source) throw refused('no-source', 409)
  if (found.recipe) throw refused('has-recipe', 409)
  if (found.recipeSearch === 'none') throw refused('nothing-found', 409)
  if (found.recipeSearch === 'looking') throw refused('looking', 409)
  if (!await spendRateLimitIfWithin(userId, 'recipe-search')) throw refused('daily-limit', 429)

  const [claimed] = await db
    .update(dish)
    .set({ recipeSearch: 'looking', recipeSearchAt: sql`now()` })
    .where(and(
      eq(dish.id, dishId),
      isNull(dish.deletedAt),
      eq(dish.sourceLink, found.source.link),
      recipeEmpty,
      or(isNull(dish.recipeSearch), and(eq(dish.recipeSearch, 'looking'), lt(dish.recipeSearchAt, sql`now() - ${RECIPE_SEARCH_GIVES_UP_AFTER}::interval`))),
    ))
    .returning({ id: dish.id })
  if (!claimed) {
    await refundRateLimit(userId, 'recipe-search')
    throw refused('looking', 409)
  }
  return { link: found.source.link, kind: found.source.kind, caption: found.caption }
}

// Runs the search and writes how it ended. A Recipe is written only while the
// Dish is still without one: a Member who typed one meanwhile wins. Records
// how the search ended in the Event Log (`recipe_found`, `recipe_not_found`,
// `recipe_search_failed`), by the user who searched; a found Recipe is no
// `recipe_edited`. A failed search is given back its call, so it can be
// repeated.
export async function finishRecipeSearch(dishId: string, userId: string, source: RecipeFinderSource): Promise<RecipeSearchOutcome> {
  const result = await findRecipe(source)
  const kind = result.outcome === 'found' ? 'recipe_found' : result.outcome === 'none' ? 'recipe_not_found' : 'recipe_search_failed'
  await withEvents(
    db,
    db
      .update(dish)
      .set({
        recipeSearch: result.outcome === 'none' ? 'none' : null,
        recipeSearchAt: null,
        // Written only while the Recipe is still empty: a Member who typed
        // one meanwhile wins.
        ...result.outcome === 'found' && {
          recipeIngredients: sql`case when ${recipeEmpty} then ${linesOf(result.recipe.ingredients)} else ${dish.recipeIngredients} end`,
          recipeSteps: sql`case when ${recipeEmpty} then ${linesOf(result.recipe.steps)} else ${dish.recipeSteps} end`,
          recipeLink: sql`case when ${recipeEmpty} then ${result.link}::text else ${dish.recipeLink} end`,
        },
      })
      // Only the search that is still running for this Source: one whose
      // Source changed meanwhile writes nothing.
      .where(and(eq(dish.id, dishId), eq(dish.recipeSearch, 'looking'), eq(dish.sourceLink, source.link)))
      .returning({ id: dish.id, boardId: dish.boardId }),
    dishEvent(kind, userId),
  )
  // A search that failed costs nothing and can be repeated.
  if (result.outcome === 'failed') await refundRateLimit(userId, 'recipe-search')
  return result.outcome
}
