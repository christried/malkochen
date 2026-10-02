import type { BoardView } from '~~/server/utils/boards'
import { dishOnBoard } from '~~/shared/board'
import { recordsCooking } from '~~/shared/placement'

// "Gekocht ✓" on a card, as the handoff times it ("Gekocht celebration +
// toast"):
// - at once, the button springs (CookButton) and the confetti bursts from it;
// - 300ms on, the card swooshes out of its Column (unless it is in the
//   Gekocht Column already), the Gekocht tab, or the Gekocht Column's title
//   on wider screens, bumps as its count rolls, and the Gekocht toast follows
//   (+500ms, AppToast);
// - from another Column, a pebble flies from the button to that tab or
//   title (640ms) and bursts there, with a CLOCK_TICK.
// `cookDish` records the Cooking and shows its result: the Gekocht toast,
// and focus on what took the card's place. Reduced motion: no wait, no
// flight; the toast and the count change.
export function useGekochtCelebration(
  board: Ref<BoardView | undefined>,
  options: {
    cookDish: (dishId: string) => void
    // Where the Gekocht Column shows its count: its tab, or its title.
    target: (columnId: string) => HTMLElement | null
    // Makes that tab or title react.
    cue: (cue: ColumnCue) => void
  },
) {
  const confetti = useConfetti()
  // Dishes whose button has sprung, waiting to leave (a second tap waits
  // with them), and those cooked from a card, leaving now.
  const waitingIds = new Set<string>()
  const cookedLeavingIds = new Set<string>()

  async function cookFromCard(dishId: string, origin: Point) {
    if (waitingIds.has(dishId)) return
    confetti.fire(origin)
    waitingIds.add(dishId)
    await wait(motionMs('cook-hold'))
    waitingIds.delete(dishId)
    const gekocht = board.value?.columns.find(c => c.isGekocht)
    const from = board.value && dishOnBoard(board.value, dishId)?.column
    // Cooked from another Column, it comes into the Gekocht Column as a move
    // there would; already in it, "Gekocht ✓" alone records the Cooking.
    const leaves = from && gekocht && recordsCooking(from, gekocht)
    cookedLeavingIds.add(dishId)
    options.cookDish(dishId)
    if (gekocht) {
      options.cue({ columnId: gekocht.id, kind: 'bump' })
      if (leaves) fly(origin, gekocht.id)
    }
    await nextTick()
    cookedLeavingIds.delete(dishId)
  }

  // A card leaving its Column swooshes if it was cooked, else it shrinks. It
  // is taken out of the flow (so the list closes up at once) where it was:
  // in a flex list, `position: absolute` alone would put it at the top.
  function onCardLeave(el: Element) {
    if (!(el instanceof HTMLElement)) return
    el.style.top = `${el.offsetTop}px`
    if (cookedLeavingIds.has(el.dataset.dishId ?? '')) el.classList.add('cooked')
  }

  // The pebble on its way (FlyToTab).
  const { shot: flight, fire, clear } = useOneShot<{ from: Point, to: Point, columnId: string, accent: string }>()
  function fly(from: Point, columnId: string) {
    const index = board.value?.columns.findIndex(c => c.id === columnId) ?? -1
    const target = options.target(columnId)
    if (index === -1 || !target || prefersReducedMotion()) return
    fire({ from, to: centreOf(target.getBoundingClientRect()), columnId, accent: columnAccent(index) })
  }
  function onFlightLanded() {
    const columnId = flight.value?.value.columnId
    clear()
    if (!columnId) return
    hapticClockTick()
    options.cue({ columnId, kind: 'pebble' })
  }

  return { cookFromCard, onCardLeave, flight, onFlightLanded }
}
