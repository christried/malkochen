import type { RecipeFinderStatus } from '~~/shared/recipe-finder'

// Typed as a plain string: Nitro's route typing runs too deep here.
const RECIPE_FINDER: string = '/api/me/recipe-finder'

// The Recipe Finder in your settings (#498, ADR 0013): where you stand (null
// until known), and asking for access. One state for all your devices, kept
// on the server; only the Operator switches it on. One status for the whole
// app (#504), so asking in Your Settings and the Dish detail see the same.
// Read again whenever the settings open, so a switch by the Operator
// meanwhile shows; the Dish detail reads it when it opens, if nobody has
// yet. `failed`: the last ask didn't work out.
export function useRecipeFinder() {
  const status = useState<RecipeFinderStatus | null>('recipe-finder-status', () => null)
  const busy = ref(false)
  const failed = ref(false)

  async function refresh() {
    if (import.meta.server) return
    try {
      status.value = await $fetch<RecipeFinderStatus>(RECIPE_FINDER)
    }
    catch {
      // Whatever was known stays; asking says if it can't be done.
    }
  }

  // "Zugang anfragen": the server answers where you stand after, which is
  // asked, or on if the Operator was quicker.
  async function ask() {
    if (busy.value) return
    busy.value = true
    failed.value = false
    try {
      status.value = await $fetch<RecipeFinderStatus>(RECIPE_FINDER, { method: 'POST' })
    }
    catch {
      failed.value = true
    }
    finally {
      busy.value = false
    }
  }

  return { status, busy, failed, refresh, ask }
}
