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
  // How many searches they made, all time: their events of the Recipe Finder
  // finding a Recipe, finding none and failing (#500).
  searches: number
}
