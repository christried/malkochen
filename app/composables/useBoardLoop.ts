import type { ClipMotion } from '~/utils/motion'

// What the Board plays (PRD story 83; handoff illustrations.json "rules";
// REMOTION.md): one card's Placeholder at a time, most important first,
//
// - the lifted card (long-press or mouse drag) loops while it is held,
// - the Placeholder card under the mouse loops, on `pointer: fine` devices,
// - when the Board first shows, and whenever it comes to rest (scrolling
//   stops, or on phones a Column swipe settles: the phone's way of scrolling
//   across the lanes), the Placeholder card nearest the middle of the screen
//   plays its loop once,
//
// and beside it one empty state's clip, looping (found as the Board comes to
// rest): the empty Board's when it is on screen, else one empty Column's on
// screen, picked at random and kept while it stays on screen, so only one of
// them ever moves. Whatever the cards do never stops it.
//
// Nothing plays while the Board is `covered` (by the Dish detail, which loops
// the Dish itself, or a sheet). Cards with a stored image never play;
// SvgLoop keeps off-screen ones paused and reduced motion still.

const REST_MS = 200

const PLACEHOLDER_CARD = '[data-dish-id]:has([data-placeholder-clip])'
// An empty state's clip, by its id: `empty:<column id>`.
const EMPTY_CLIP = '[data-empty-clip]'
const EMPTY_BOARD_CLIP = '[data-empty-clip][data-empty="board"]'

export function useBoardLoop(
  surface: Readonly<Ref<HTMLElement | null>>,
  options: {
    liftedDishId: () => string | null
    covered: () => boolean
  },
) {
  const hoveredDishId = ref<string | null>(null)
  const restingDishId = ref<string | null>(null)
  const restingEmptyId = ref<string | null>(null)

  // The card playing, by its Dish's id.
  const playingCard = computed<{ id: string, motion: ClipMotion } | null>(() => {
    if (options.covered()) return null
    const lifted = options.liftedDishId()
    if (lifted) return { id: lifted, motion: 'loop' }
    if (hoveredDishId.value) return { id: hoveredDishId.value, motion: 'loop' }
    if (restingDishId.value) return { id: restingDishId.value, motion: 'once' }
    return null
  })
  const emptyId = computed(() => options.covered() ? null : restingEmptyId.value)

  // How a Dish's Placeholder, or an empty state's clip, plays.
  function motionOf(id: string): ClipMotion {
    if (playingCard.value?.id === id) return playingCard.value.motion
    return emptyId.value === id ? 'loop' : null
  }

  // A card's loop played through (or couldn't play): the Board is still.
  function ended(dishId: string) {
    if (restingDishId.value === dishId) restingDishId.value = null
  }

  // The elements matching `selector` on screen.
  function onScreen(selector: string): HTMLElement[] {
    return [...surface.value?.querySelectorAll<HTMLElement>(selector) ?? []].filter((el) => {
      const box = el.getBoundingClientRect()
      return box.width > 0 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth
    })
  }

  // Of the elements matching `selector` on screen, the one nearest its middle.
  function nearest(selector: string): HTMLElement | null {
    const middleX = innerWidth / 2
    const middleY = innerHeight / 2
    let found: { el: HTMLElement, distance: number } | null = null
    for (const el of onScreen(selector)) {
      const box = el.getBoundingClientRect()
      const distance = Math.hypot(box.left + box.width / 2 - middleX, box.top + box.height / 2 - middleY)
      if (!found || distance < found.distance) found = { el, distance }
    }
    return found?.el ?? null
  }

  // The empty Column last picked, picked again while it is on screen.
  let pickedEmptyId: string | null = null
  function pickEmpty(): string | null {
    const emptyBoard = nearest(EMPTY_BOARD_CLIP)?.dataset.emptyClip
    if (emptyBoard) return emptyBoard
    const ids = onScreen(EMPTY_CLIP).map(el => el.dataset.emptyClip!)
    if (!pickedEmptyId || !ids.includes(pickedEmptyId)) pickedEmptyId = ids[Math.floor(Math.random() * ids.length)] ?? null
    return pickedEmptyId
  }

  function playNearest() {
    restingDishId.value = nearest(PLACEHOLDER_CARD)?.dataset.dishId ?? null
    restingEmptyId.value = pickEmpty()
  }

  let restTimer: ReturnType<typeof setTimeout> | undefined
  function playWhenAtRest(afterMs = 0) {
    restingDishId.value = null
    restingEmptyId.value = null
    clearTimeout(restTimer)
    restTimer = setTimeout(playNearest, REST_MS + afterMs)
  }

  // Hover: a mouse over a Placeholder card. Touch has long-press instead.
  // Not while a card is lifted: it loops anyway, and the Board re-rendering
  // as the cards pass under it would restart the others making room.
  const finePointer = useMediaQuery(FINE_POINTER)
  function onPointerOver(event: PointerEvent) {
    if (!finePointer.value || event.pointerType !== 'mouse' || options.liftedDishId()) return
    const card = (event.target as Element).closest<HTMLElement>(PLACEHOLDER_CARD)
    hoveredDishId.value = card?.dataset.dishId ?? null
  }
  function onPointerLeave() {
    hoveredDishId.value = null
  }

  // Scrolling the page or the lanes; captured, as element scrolls don't bubble.
  const onScroll = () => playWhenAtRest()
  onMounted(() => {
    addEventListener('scroll', onScroll, { capture: true, passive: true })
    surface.value?.addEventListener('pointerover', onPointerOver)
    surface.value?.addEventListener('pointerleave', onPointerLeave)
    playWhenAtRest()
  })
  onBeforeUnmount(() => {
    clearTimeout(restTimer)
    removeEventListener('scroll', onScroll, { capture: true })
    surface.value?.removeEventListener('pointerover', onPointerOver)
    surface.value?.removeEventListener('pointerleave', onPointerLeave)
  })

  return { motionOf, ended, playWhenAtRest }
}
