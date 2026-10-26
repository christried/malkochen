// A visit (CONTEXT.md → New Dish): opening the app, or coming back to it
// after half an hour or more away (useBoardSync reopens the Board then and
// calls `nextVisit`). What the app shows at most once per visit (the Tour,
// the Changelog Popup, a Notification Prompt) says so here, and no other
// shows after it in that visit. Kept in the app's state, so switching
// Boards doesn't start a new visit.
export function useVisit() {
  const visit = useState('visit', () => 0)
  const shownIn = useState<number | null>('visit-shown-in', () => null)
  const shownKind = useState<string | null>('visit-shown-kind', () => null)
  return {
    visit,
    // The Tour, the Changelog Popup or a prompt showed in this visit.
    shown: (kind: 'tour' | 'changelog' | 'prompt') => {
      shownKind.value = kind
      shownIn.value = visit.value
    },
    shownThisVisit: computed(() => shownIn.value === visit.value),
    nextVisit: () => {
      visit.value++
    },
  }
}
