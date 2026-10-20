// "Kommentieren" in the Gekocht toast (#333): the Dish whose detail should
// open at its comment field, until its Dish History has put focus there
// (DishHistory).
export function useCommentRequest() {
  return useState<string | null>('comment-request', () => null)
}
