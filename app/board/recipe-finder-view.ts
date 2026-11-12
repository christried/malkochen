import type { RecipeSearch } from '../../shared/recipe'

// What the Dish detail shows in place of a Recipe the Dish doesn't have yet
// (handoff RecipeFinderState, #504), one at a time:
//
// - `searching`: "Rezept wird gesucht", to every Member, while a search runs.
// - `none`: "Kein Rezept gefunden", to every Member, once a search found
//   nothing for the Dish's Source; "Rezept finden" doesn't come back until
//   the Source changes (the server forgets it then).
// - `failed` and `quota`: what this user's own search ended in (`note`; they
//   last while the detail stays open).
// - `action`: "Rezept finden" beside "Rezept hinzufügen".
// - `add`: only "Rezept hinzufügen", for a Member who may edit.
// - `nothing`: no more than the Recipe's own place gives.
export type FinderView = 'searching' | 'none' | 'failed' | 'quota' | 'action' | 'add' | 'nothing'

// What this user's own search ended in, kept while the detail is open.
export type FinderNote = 'failed' | 'quota'

export interface FinderInput {
  hasRecipe: boolean
  hasSource: boolean
  search: RecipeSearch | null
  note: FinderNote | null
  // The Recipe Finder is on for the user and the server can search
  // (RecipeFinderStatus: `state` on, `available`).
  finderOn: boolean
  mayEdit: boolean
}

export interface FinderShown {
  view: FinderView
  // "Rezept finden", or "Noch mal suchen" in `failed`: only for a user with
  // the Recipe Finder who may edit the Dish, which has a Source.
  find: boolean
  // "Rezept hinzufügen": for a Member who may edit, except while a search runs.
  add: boolean
}

export function finderShown({ hasRecipe, hasSource, search, note, finderOn, mayEdit }: FinderInput): FinderShown {
  const mayFind = finderOn && mayEdit && hasSource
  if (hasRecipe) return { view: 'nothing', find: false, add: false }
  if (search === 'looking') return { view: 'searching', find: false, add: false }
  if (note) return { view: note, find: note === 'failed' && mayFind, add: mayEdit }
  if (search === 'none') return { view: 'none', find: false, add: mayEdit }
  if (mayFind) return { view: 'action', find: true, add: true }
  return { view: mayEdit ? 'add' : 'nothing', find: false, add: mayEdit }
}
