// The Recipe Finder (CONTEXT.md, #497, ADR 0013): each user's state. Off
// for every new user; a user moves themselves to asked, once; only the
// Operator moves them to on, or back to off.
export type RecipeFinderState =
  | { state: 'off' }
  // `askedAt`: when, as an ISO time.
  | { state: 'asked', askedAt: string }
  | { state: 'on' }

// A user as the Admin Page lists them for the Recipe Finder: everyone who
// asked or has it, by their Username now (empty before they picked one).
export interface AdminRecipeFinderUser {
  id: string
  name: string
  state: 'asked' | 'on'
  // When they asked, as an ISO time; null when switched on unasked.
  askedAt: string | null
  // Their Recipe Finder searches so far, by how each ended (the Event Log's
  // recipe_found, recipe_not_found and recipe_search_failed). Only the first
  // two counted against their daily cap.
  searches: { found: number, none: number, failed: number }
}
