// Which view of a Board the device shows (handoff ViewSwitch): the Columns or
// the Week Plan. One choice per device for all Boards, kept in localStorage
// as "malkochen:view" ("columns" or "week"); where that is unavailable (a
// private window), for as long as the page stays open.
export type BoardViewChoice = 'columns' | 'week'

const KEY = 'malkochen:view'

function stored(): BoardViewChoice {
  try {
    return localStorage.getItem(KEY) === 'week' ? 'week' : 'columns'
  }
  catch {
    return 'columns'
  }
}

// The view shown, shared by every Board of the app. The server renders the
// Columns (it can't know the device's choice) under the splash; once
// mounted, the choice is read, so what hydrates is what was rendered. A Board
// opened by navigating, with nothing to hydrate, reads it at once.
export function useBoardView() {
  const view = useState<BoardViewChoice>('board-view', () => 'columns')
  if (import.meta.client && !useNuxtApp().isHydrating) view.value = stored()
  onMounted(() => {
    if (view.value === 'columns') view.value = stored()
  })

  function show(choice: BoardViewChoice) {
    view.value = choice
    try {
      localStorage.setItem(KEY, choice)
    }
    catch {
      // Not kept: it holds while the page stays open.
    }
  }

  return { view: readonly(view), show }
}
