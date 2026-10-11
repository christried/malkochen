// Whether the Toast's countdown waits: while a Dish's 10th Cooking
// celebrates over it, so "Rückgängig" outlasts the celebration (#229). Shared,
// not a prop: every AppToast showing the same toast (the Board's, the Dish
// detail's, the celebration's own) runs its own timer, and all must wait.
export function useToastPaused() {
  return useState('toast-paused', () => false)
}
