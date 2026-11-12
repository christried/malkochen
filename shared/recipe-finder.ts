// The Recipe Finder (CONTEXT.md, #497, ADR 0013): each user's state. Off
// for every new user; a user moves themselves to asked, once; only the
// Operator moves them to on, or back to off.
export type RecipeFinderState =
  | { state: 'off' }
  // `askedAt`: when, as an ISO time.
  | { state: 'asked', askedAt: string }
  | { state: 'on' }

// What `/api/me/recipe-finder` answers: the user's state, and whether the
// server can search at all (#501): without an Anthropic API key it can't, and
// "Rezept finden" isn't offered whatever the state.
export type RecipeFinderStatus = RecipeFinderState & { available: boolean }

// A user as the Admin Page lists them for the Recipe Finder: everyone who
// asked or has it, by their Username now (empty before they picked one).
export interface AdminRecipeFinderUser {
  id: string
  name: string
  // Their email address: the Admin Page is the Operator's alone, and a user
  // with no Username yet is named by it.
  email: string
  // Their picture as it is shown elsewhere (their own, else Google's); null
  // for neither.
  image: string | null
  state: 'asked' | 'on'
  // When they asked, as an ISO time; null when switched on unasked.
  askedAt: string | null
  // How many searches they made, all time: their events of the Recipe Finder
  // finding a Recipe, finding none and failing (#500).
  searches: number
  // How many of those still count against their cap ("recipe-search" in
  // server/rate-limits.ts): the searches of the window that is running, 0
  // once it is over.
  searchesToday: number
}
