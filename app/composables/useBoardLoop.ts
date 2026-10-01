// The one Placeholder loop the Board plays at a time (PRD story 83; handoff
// illustrations.json "rules"). Most important first:
//
// - the lifted card (long-press or mouse drag) loops while it is held,
// - the card under the mouse loops, on `pointer: fine` devices,
// - when the Board first shows, and whenever scrolling (or a Column switch)
//   comes to rest, the Placeholder card nearest the middle of the screen
//   plays its loop once.
//
// Nothing plays while `quiet` (the Dish detail is open over the Board: it
// loops the Dish itself). Cards with a stored image never play; MotionClip
// keeps off-screen ones paused and reduced motion still.

export type DishMotion = 'loop' | 'once' | null

const REST_MS = 200

export function useBoardLoop(
  surface: Readonly<Ref<HTMLElement | null>>,
  options: {
    lifted: () => string | null
    quiet: () => boolean
  },
) {
  const hovered = ref<string | null>(null)
  const once = ref<string | null>(null)

  const current = computed<{ dishId: string, motion: DishMotion } | null>(() => {
    if (options.quiet()) return null
    const lifted = options.lifted()
    if (lifted) return { dishId: lifted, motion: 'loop' }
    if (hovered.value) return { dishId: hovered.value, motion: 'loop' }
    if (once.value) return { dishId: once.value, motion: 'once' }
    return null
  })

  function motionOf(dishId: string): DishMotion {
    return current.value?.dishId === dishId ? current.value.motion : null
  }

  function ended(dishId: string) {
    if (once.value === dishId) once.value = null
  }

  // The Placeholder card nearest the middle of the screen, among those on it.
  function playNearest() {
    const middleX = innerWidth / 2
    const middleY = innerHeight / 2
    let nearest: { dishId: string, distance: number } | null = null
    for (const card of surface.value?.querySelectorAll<HTMLElement>('[data-dish-id]') ?? []) {
      if (!card.querySelector('[data-placeholder-clip]')) continue
      const box = card.getBoundingClientRect()
      if (!box.width || box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) continue
      const distance = Math.hypot(box.left + box.width / 2 - middleX, box.top + box.height / 2 - middleY)
      if (!nearest || distance < nearest.distance) nearest = { dishId: card.dataset.dishId!, distance }
    }
    once.value = nearest?.dishId ?? null
  }

  let restTimer: ReturnType<typeof setTimeout> | undefined
  function playWhenAtRest(afterMs = 0) {
    once.value = null
    clearTimeout(restTimer)
    restTimer = setTimeout(playNearest, REST_MS + afterMs)
  }

  // Hover: a mouse over a card. Touch has long-press instead.
  const hoverable = useMediaQuery('(hover: hover) and (pointer: fine)')
  function onPointerOver(event: PointerEvent) {
    if (!hoverable.value || event.pointerType !== 'mouse') return
    const card = (event.target as Element).closest<HTMLElement>('[data-dish-id]')
    hovered.value = card?.dataset.dishId ?? null
  }
  function onPointerLeave() {
    hovered.value = null
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
