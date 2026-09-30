// Swiping between Columns on phones (handoff interactions.json "Swipe
// between Columns"). A horizontal pan past 8px, clearly more sideways than
// down, is captured and the Board follows the finger 1:1 (0.3× past either
// end). Letting go past 18% of the width, or flicking faster than 0.5px/ms,
// goes to the next Column; anything less springs back. Vertical pans stay
// the page's scroll. Touch and pen only: a mouse will drag Dishes instead.
// From 768px the Columns sit side by side and a sideways pan just scrolls.
//
// Reduced motion: the Board doesn't follow the finger, the swipe only pages.
export function useColumnSwipe(
  surface: Readonly<Ref<HTMLElement | null>>,
  options: { count: () => number, active: () => number, go: (index: number) => void },
) {
  // How far the finger has taken the Board, in px; 0 when not swiping.
  const dx = ref(0)
  const following = ref(false)
  const width = ref(1)

  let start: { x: number, y: number, pointerId: number } | null = null
  let captured = false
  let samples: { x: number, t: number }[] = []
  // A swipe that ends on a card must not open it.
  let swallowClick = false

  const atEdge = (move: number) => (options.active() === 0 && move > 0) || (options.active() === options.count() - 1 && move < 0)

  function onDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' || !event.isPrimary || !isPhoneLayout()) return
    start = { x: event.clientX, y: event.clientY, pointerId: event.pointerId }
    captured = false
    swallowClick = false
    samples = [{ x: event.clientX, t: event.timeStamp }]
    width.value = surface.value?.clientWidth || 1
  }

  function onMove(event: PointerEvent) {
    if (!start || event.pointerId !== start.pointerId) return
    const moveX = event.clientX - start.x
    const moveY = event.clientY - start.y
    if (!captured) {
      if (Math.hypot(moveX, moveY) < 8) return
      if (Math.abs(moveX) <= 1.2 * Math.abs(moveY)) {
        start = null
        return
      }
      captured = true
      following.value = !prefersReducedMotion()
    }
    samples.push({ x: event.clientX, t: event.timeStamp })
    samples = samples.filter(s => event.timeStamp - s.t <= 100)
    if (following.value) dx.value = atEdge(moveX) ? moveX * 0.3 : moveX
  }

  function onUp(event: PointerEvent) {
    if (!start || event.pointerId !== start.pointerId) return
    const moveX = event.clientX - start.x
    start = null
    if (!captured) return
    swallowClick = true
    setTimeout(() => (swallowClick = false), 400)

    const first = samples.find(s => event.timeStamp - s.t <= 100) ?? samples[0]!
    const elapsed = event.timeStamp - first.t
    const velocity = elapsed > 0 ? (event.clientX - first.x) / elapsed : 0
    let next = options.active()
    if (moveX < -0.18 * width.value || velocity < -0.5) next++
    else if (moveX > 0.18 * width.value || velocity > 0.5) next--
    next = Math.max(0, Math.min(next, options.count() - 1))

    following.value = false
    dx.value = 0
    if (next !== options.active()) options.go(next)
  }

  function onCancel(event: PointerEvent) {
    if (!start || event.pointerId !== start.pointerId) return
    start = null
    following.value = false
    dx.value = 0
  }

  function onClick(event: MouseEvent) {
    if (!swallowClick) return
    swallowClick = false
    event.preventDefault()
    event.stopPropagation()
  }

  const onWindow = [['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onCancel]] as const
  let bound: HTMLElement | null = null
  onMounted(() => {
    bound = surface.value
    bound?.addEventListener('pointerdown', onDown)
    bound?.addEventListener('click', onClick, { capture: true })
    for (const [type, listener] of onWindow) window.addEventListener(type, listener)
  })
  onBeforeUnmount(() => {
    bound?.removeEventListener('pointerdown', onDown)
    bound?.removeEventListener('click', onClick, { capture: true })
    for (const [type, listener] of onWindow) window.removeEventListener(type, listener)
  })

  // Where the Board is between Columns: the active index, fractional mid-swipe.
  const progress = computed(() => options.active() - dx.value / width.value)

  return { dx, progress, following }
}
