// A saved Dish flies onto the Board (handoff "Saved → card flies to
// Board"): once the sheet has moved out (and on phones the Board has slid to
// its Column), a copy of its card flies from where its image showed in the
// sheet into its place (900ms, swoosh), and lands with CONFIRM; the card
// itself is hidden till then (`arrivingId`). A copy, fixed to the screen, as
// the Columns side by side would clip the card. Reduced motion: the card
// just fades in (the list's own enter).
export function useSavedDishFlight(surface: Readonly<Ref<HTMLElement | null>>) {
  const arrivingId = ref<string | null>(null)

  // `slides`: the Board is sliding to the Dish's Column first (phones).
  async function flyIn(dishId: string, from: DOMRect, { slides = false } = {}) {
    if (prefersReducedMotion()) return
    arrivingId.value = dishId
    await wait(Math.max(motionMs('sheet-out'), slides ? motionMs('settle') : 0))
    const card = surface.value?.querySelector<HTMLElement>(`[data-dish-id="${CSS.escape(dishId)}"] article`)
    if (!card) {
      arrivingId.value = null
      return
    }
    const to = card.getBoundingClientRect()
    const copy = card.cloneNode(true) as HTMLElement
    copy.setAttribute('aria-hidden', 'true')
    copy.classList.add('z-drag', 'pointer-events-none')
    Object.assign(copy.style, { position: 'fixed', left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px`, margin: '0' })
    document.body.append(copy)
    // From the image's size and place, uniformly scaled so it isn't squashed.
    const scale = Math.min(from.width / to.width, from.height / to.height)
    const start = centreOf(from)
    const end = centreOf(to)
    const flight = copy.animate([
      { transform: `translate(${start.x - end.x}px, ${start.y - end.y}px) scale(${scale})`, opacity: .4 },
      { opacity: 1, offset: .3 },
      { transform: 'none', opacity: 1 },
    ], { duration: motionMs('saved-flight'), easing: motionEase('swoosh') })
    await flight.finished.catch(() => {})
    copy.remove()
    if (arrivingId.value === dishId) arrivingId.value = null
    hapticConfirm()
  }

  return { arrivingId, flyIn }
}
