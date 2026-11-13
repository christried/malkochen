// The Shopping List (CONTEXT.md: Shopping List, Shopping Item; ADR 0015), as
// the server and the app both see it.

// How much the Shopping List holds: a line of so many characters at most (as
// an Ingredient, RECIPE_LIMITS), and so many lines on one Board. A write that
// would go over is refused whole.
export const SHOPPING_LIMITS = { characters: 200, items: 500 } as const

// A Shopping Item as the Board load carries it, in the list's order:
// "Sonstiges" first, then the Dish groups in the order their Dishes were
// first put on, each in its own order. `dishId` is the item's group, null for
// "Sonstiges". `dishTitle` is the group's title: the Dish's as it is now while
// it is on the Board and not archived (`dishOnBoard`), else as it was last
// known; null for "Sonstiges". Who added an item is never shown.
export interface ShoppingItemView {
  id: string
  text: string
  ticked: boolean
  dishId: string | null
  dishTitle: string | null
  dishOnBoard: boolean
}

// What putting a week on answers: how many Dishes went on, and their items.
export interface WeekPutOn {
  dishes: number
  items: ShoppingItemView[]
}
