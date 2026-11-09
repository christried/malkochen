import { computed, effectScope, shallowRef, watch, type Ref } from 'vue'

// The Snackbert Question (CONTEXT.md, #425): after a Member records a
// Cooking on this device, Snackbert's head comes up and asks whether
// they'd like to tell him about it. This module decides when: the Board
// tells it of each Cooking recorded singly (`cooked`; never a move of
// several Dishes, which can't cook), and it asks the screen what is going
// on. Plain Vue reactivity and timers, so it runs in Node (the "client"
// Vitest project); SnackbertQuestion draws what it says.
//
// A Cooking starts a pending Question, unless a Tour runs or it is the
// Tour's Dish. It shows once Snackbert turns out to be on, the server has
// recorded the Cooking, the Gekocht toast has gone (a paused toast stays,
// so he waits for it too) and nothing he waits for is open (a Klassiker
// celebration, the Changelog Popup, a Notification Prompt, a sheet), and
// no Tour runs; then a beat later, so the toast is out of the way. A newer
// Cooking replaces the pending one (and sends away one he is asking about);
// a Cooking undone, failed or deleted drops its own. He doesn't take the
// visit's one prompt (useVisit): the Tour, the Changelog Popup and the
// Notification Prompts go by their own rules.

export interface QuestionCooking { id: string, cookedAt: string }

// The Dish as the Board shows it: its Cooking History changes in place.
export interface QuestionDish {
  id: string
  title: string
  cookings: readonly { id: string }[]
}

export interface QuestionScreen {
  // Whether the user has Snackbert switched on; asked for each Cooking.
  snackbertOn: (dishId: string) => Promise<boolean>
  // A Toast shows (the Gekocht toast, or one after it).
  toastShowing: () => boolean
  // A Klassiker celebration, the Changelog Popup, a Notification Prompt or
  // a sheet is open.
  waiting: () => boolean
  // A Tour runs.
  touring: () => boolean
}

// What he is asking about. `said`: 'ask', the Question; 'bye', his last
// word after "Nein", before he goes.
export interface SnackbertAsking {
  dishId: string
  dish: string
  cookingId: string
  cookedAt: string
  said: 'ask' | 'bye'
}

// The beat after everything is clear, so the toast has left.
export const ASK_AFTER_MS = 400
// How long his last word after "Nein" stays.
export const BYE_MS = 1800

interface Pending {
  dish: QuestionDish
  // Null until known.
  on: Ref<boolean | null>
  cooking: Ref<QuestionCooking | null>
}

export function createSnackbertQuestion(screen: QuestionScreen) {
  const scope = effectScope(true)
  const pending = shallowRef<Pending | null>(null)
  const asking = shallowRef<SnackbertAsking | null>(null)
  let askTimer: ReturnType<typeof setTimeout> | undefined
  let byeTimer: ReturnType<typeof setTimeout> | undefined

  function cooked({ dish, recorded, tourDish = false }: { dish: QuestionDish, recorded: Promise<QuestionCooking | null>, tourDish?: boolean }) {
    // A new Cooking: the toast is back, so he goes.
    goAway()
    pending.value = null
    if (tourDish || screen.touring()) return
    const entry: Pending = { dish, on: shallowRef(null), cooking: shallowRef(null) }
    pending.value = entry
    const mine = () => pending.value === entry
    void screen.snackbertOn(dish.id).catch(() => false).then((on) => {
      if (mine()) entry.on.value = on
    })
    void recorded.catch(() => null).then((cooking) => {
      if (!mine()) return
      if (cooking) entry.cooking.value = cooking
      else pending.value = null
    })
  }

  scope.run(() => {
    // Dropped: Snackbert is off, or the Cooking is gone from its Dish's
    // history (undone, or deleted).
    watch(() => {
      const entry = pending.value
      if (!entry) return false
      const cooking = entry.cooking.value
      return entry.on.value === false || (!!cooking && !entry.dish.cookings.some(c => c.id === cooking.id))
    }, (dropped) => {
      if (dropped) pending.value = null
    }, { flush: 'sync' })

    const ready = computed(() => {
      const entry = pending.value
      return !!entry && entry.on.value === true && !!entry.cooking.value
        && !screen.toastShowing() && !screen.waiting() && !screen.touring()
    })
    watch(ready, (isReady) => {
      clearTimeout(askTimer)
      if (isReady) askTimer = setTimeout(ask, ASK_AFTER_MS)
    }, { flush: 'sync' })
  })

  function ask() {
    const entry = pending.value
    const cooking = entry?.cooking.value
    if (!entry || !cooking) return
    pending.value = null
    asking.value = { dishId: entry.dish.id, dish: entry.dish.title, cookingId: cooking.id, cookedAt: cooking.cookedAt, said: 'ask' }
  }

  function goAway() {
    clearTimeout(byeTimer)
    asking.value = null
  }

  // "Ja": he goes, and the Cooking to report is answered. "Nein": his last
  // word, then he goes.
  function answer(yes: true): SnackbertAsking | null
  function answer(yes: false): void
  function answer(yes: boolean): SnackbertAsking | null | void {
    const now = asking.value
    if (!now || now.said !== 'ask') return yes ? null : undefined
    if (yes) {
      goAway()
      return now
    }
    asking.value = { ...now, said: 'bye' }
    byeTimer = setTimeout(goAway, BYE_MS)
  }

  function stop() {
    clearTimeout(askTimer)
    clearTimeout(byeTimer)
    scope.stop()
  }

  return { asking: computed(() => asking.value), cooked, answer, stop }
}
