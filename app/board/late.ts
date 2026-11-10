// What a write sent late carries (ADR 0012): it waited on the device as an
// Unsent Change, so it says when it was made (`madeAt`) and the ids the device
// made for what it records, which the server keeps: a Comment's `id`, a
// Dish's Cooking (`cookingId`) or the Cookings of several (`cookingIds`, one
// per Dish, in order). A write sent again then records it once.
export interface Late {
  madeAt?: string
  id?: string
  cookingId?: string
  cookingIds?: string[]
}
