import type { ClipMotion } from '~/utils/motion'

// The one Placeholder loop the Board plays at a time (PRD story 83; handoff
// illustrations.json "rules"). Most important first:
//
// - the lifted card (long-press or mouse drag) loops while it is held,
// - the Placeholder card under the mouse loops, on `pointer: fine` devices,
// - when the Board first shows, and whenever it comes to rest (scrolling
//   stops, or on phones a Column swipe settles: the phone's way of scrolling
//   across the lanes), the Placeholder card nearest the middle of the screen
//   plays its loop once.
//
// Nothing plays while the Board is `covered` (by the Dish detail, which loops
// the Dish itself, or a sheet). Cards with a stored image never play;
// MotionClip keeps off-screen ones paused and reduced motion still.

const REST_MS = 200

const PLACEHOLDER_CARD = '[data-dish-id]:has([data-placeholder-clip])'

export function useBoardLoop(
  surface: Readonly<Ref<HTMLElement | null>>,
  options: {
    liftedDishId: () => string | null
    covered: () => boolean
  },
) {
  const hoveredDishId = ref<string | null>(null)
  const restingDishId = ref<string | null>(null)

  const current = computed<{ dishId: string, motion: ClipMotion } | null>(() => {
    if (options.covered()) return null
    const lifted = options.liftedDishId()
    if (lifted) return { dishId: lifted, motion: 'loop' }
    if (hoveredDishId.value) return { dishId: hoveredDishId.value, motion: 'loop' }
    if (restingDishId.value) return { dishId: restingDishId.value, motion: 'once' }
    return null
  })

  function motionOf(dishId: string): ClipMotion {
    return current.value?.dishId === dishId ? current.value.motion : null
  }

  // A card's loop played through (or couldn't play): the Board is still.
  function ended(dishId: string) {
    if (restingDishId.value === dishId) restingDishId.value = null
  }

  // The Placeholder card nearest the middle of the screen, among those on it.
  function playNearest() {
    const middleX = innerWidth / 2
    const middleY = innerHeight / 2
    let nearest: { dishId: string, distance: number } | null = null
    for (const card of surface.value?.querySelectorAll<HTMLElement>(PLACEHOLDER_CARD) ?? []) {
      const box = card.getBoundingClientRect()
      if (!box.width || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) continue
      const distance = Math.hypot(box.left + box.width / 2 - middleX, box.top + box.height / 2 - middleY)
      if (!nearest || distance < nearest.distance) nearest = { dishId: card.dataset.dishId!, distance }
    }
    restingDishId.value = nearest?.dishId ?? null
  }

  let restTimer: ReturnType<typeof setTimeout> | undefined
  function playWhenAtRest(afterMs = 0) {
    restingDishId.value = null
    clearTimeout(restTimer)
    restTimer = setTimeout(playNearest, REST_MS + afterMs)
  }

  // Hover: a mouse over a Placeholder card. Touch has long-press instead.
  const finePointer = useMediaQuery(FINE_POINTER)
  function onPointerOver(event: PointerEvent) {
    if (!finePointer.value || event.pointerType !== 'mouse') return
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
