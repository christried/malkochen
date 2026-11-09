import { computed, effectScope, ref, shallowRef, watch } from 'vue'

// The Klassiker celebrations (milestone-10x, #452): the Cooking that makes
// a Dish a Klassiker (its 10th) celebrates once it is recorded and a
// moment has passed, so the Gekocht pill is in first. A batch of Cookings
// (the selection's "Gekocht ✓") can make several Dishes a Klassiker: they
// celebrate one after the other, a moment apart. Plain Vue reactivity, so
// it runs in Node (the "client" Vitest project); BoardScreen shows
// `current` in a CelebrationDialog and closes it with `close`. The Dishes
// it is given are reactive (the Board's), so an undone Cooking ends its
// celebration.
//
// From the Cooking on (while the server records it, and the moment after),
// while one shows and while another waits its turn, `toastPaused`: the
// toast's countdown waits, so "Rückgängig" outlasts them all (#229). So
// it is told only of Cookings that look like a Klassiker (the 10th).

export interface KlassikerCooking { id: string }
export interface KlassikerDish { id: string, cookings: KlassikerCooking[] }
export interface Klassiker<D extends KlassikerDish> { dish: D, cooking: KlassikerCooking }

export function createKlassikerQueue<D extends KlassikerDish>(options: {
  // The moment before each one shows (milestone-delay).
  moment: () => Promise<void>
  // True the first time it is asked for a Dish (claimMilestone), as it is
  // about to show: one undone before its turn can still celebrate later.
  claim: (dishId: string) => boolean
}) {
  const scope = effectScope(true)
  const current = shallowRef<Klassiker<D> | null>(null)
  const waiting = shallowRef<Klassiker<D>[]>([])
  // Cookings still being recorded, or in the moment after.
  const coming = ref(0)
  // Between one closing and the next showing.
  const pausing = ref(false)

  // The Dishes the Cooking (or batch) `recorded` made a Klassiker, in
  // order, once recorded; none if it failed.
  async function celebrate(recorded: Promise<Klassiker<D>[]>) {
    coming.value++
    try {
      const [found] = await Promise.all([recorded, options.moment()])
      waiting.value = [...waiting.value, ...found]
    }
    finally {
      coming.value--
    }
    if (!current.value && !pausing.value) next()
  }

  // The next one still recorded (not undone meanwhile) and not
  // celebrated before.
  function next() {
    while (waiting.value.length > 0) {
      const [up, ...rest] = waiting.value
      waiting.value = rest
      if (stillRecorded(up!) && options.claim(up!.dish.id)) {
        current.value = up!
        return
      }
    }
  }

  function stillRecorded({ dish, cooking }: Klassiker<D>) {
    return dish.cookings.some(c => c.id === cooking.id)
  }

  // Its Cooking undone (or deleted) while it shows, it ends.
  scope.run(() => {
    watch(() => current.value && !stillRecorded(current.value), (undone) => {
      if (undone) void close()
    })
  })

  async function close() {
    current.value = null
    if (waiting.value.length === 0) return
    pausing.value = true
    await options.moment()
    pausing.value = false
    next()
  }

  return {
    current: computed(() => current.value),
    toastPaused: computed(() => coming.value > 0 || !!current.value || waiting.value.length > 0),
    celebrate,
    close,
    stop: () => scope.stop(),
  }
}
