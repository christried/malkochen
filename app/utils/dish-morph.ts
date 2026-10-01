// The card → detail morph (handoff interactions.json "Card → detail morph"):
// a card's thumbnail grows into the Dish detail's header image (600ms,
// swoosh) and shrinks back into the card when the detail closes. With the
// View Transitions API the browser morphs the two (the detail's image is
// always named `dish-image`; the card's thumbnail only for the moment it is
// the other end). Without it, the detail's image is FLIPped from the card's
// place. Either way the detail doesn't move in itself (it is "morphed").
// Reduced motion: no morph; the detail just shows.

const NAME = 'dish-image'
// The detail must show within this, or the morph is given up.
const ARRIVAL_MS = 1500

type Arrival = { kind: 'view-transition' } | { kind: 'flip', from: DOMRect }

// The morph waiting for the detail that is opening, and its arrival.
let pending: { arrival: Arrival, arrived: () => void } | null = null

function canMorph(): boolean {
  return !prefersReducedMotion()
}

function supportsViewTransitions(): boolean {
  return typeof document.startViewTransition === 'function'
}

// The card's thumbnail of Dish `dishId` on the Board.
export function cardThumb(dishId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#dish-${CSS.escape(dishId)} [data-thumb]`)
}

// Opens the detail from `thumb`: `go` navigates to it, at `path`, and the
// morph lasts until the detail has said it arrived (`morphArrival`,
// `morphArrived`).
export async function morphOpen(thumb: HTMLElement | null, path: string, go: () => Promise<unknown>): Promise<void> {
  if (!thumb || !canMorph()) {
    await go()
    return
  }
  let arrived!: () => void
  const arrival = new Promise<void>((resolve) => {
    arrived = resolve
    setTimeout(resolve, ARRIVAL_MS)
  })
  if (supportsViewTransitions()) {
    pending = { arrival: { kind: 'view-transition' }, arrived }
    await navigateInTransition(path, 'open', go, {
      start: () => (thumb.style.viewTransitionName = NAME),
      update: async () => {
        thumb.style.viewTransitionName = ''
        return arrival
      },
    })
  }
  else {
    pending = { arrival: { kind: 'flip', from: thumb.getBoundingClientRect() }, arrived }
    await go()
    await arrival
  }
  pending = null
}

// For the detail as it is set up: whether it is arriving by a morph (then
// it doesn't move in itself).
export function morphArrival(): Arrival | null {
  return pending?.arrival ?? null
}

// The detail is showing, with its header image `image`: a FLIP morph runs
// now, and the morph is over once the image is in place.
export function morphArrived(image: HTMLElement | null) {
  const current = pending
  if (!current) return
  if (current.arrival.kind === 'flip' && image) {
    flip(image, current.arrival.from, image.getBoundingClientRect()).finished.then(current.arrived, current.arrived)
  }
  else {
    current.arrived()
  }
}

// Closes the detail into its card: `go` navigates back to the Board and
// resolves once the detail is gone. Without the card (gone meanwhile), it
// just goes.
export async function morphClose(image: HTMLElement | null, dishId: string, path: string, go: () => Promise<unknown>): Promise<void> {
  if (!image || !cardThumb(dishId) || !canMorph()) {
    await go()
    return
  }
  if (supportsViewTransitions()) {
    let gone!: () => void
    const left = new Promise<void>(resolve => (gone = resolve))
    await navigateInTransition(path, 'close', () => go().finally(gone), {
      update: async () => {
        await left
        const thumb = cardThumb(dishId)
        if (thumb) thumb.style.viewTransitionName = NAME
      },
    })
    const thumb = cardThumb(dishId)
    if (thumb) thumb.style.viewTransitionName = ''
    return
  }
  const to = cardThumb(dishId)!.getBoundingClientRect()
  // The rest of the detail fades out meanwhile.
  image.closest('dialog')?.setAttribute('data-morph-closing', '')
  await flip(image, image.getBoundingClientRect(), to, { back: true }).finished.catch(() => {})
  await go()
}

// Runs `go`, a navigation to `path`, in a View Transition that starts only
// once the navigation is about to change the page (route middleware done,
// as Nuxt's own view transitions do), so the page never freezes on its old
// look while waiting for the network. `start` runs just before the old look
// is captured, `update` once it is; the transition plays when `update`
// resolves. A navigation that ends elsewhere (a redirect) has none.
// `<html data-morph>` says which way it goes meanwhile (main.css).
async function navigateInTransition(path: string, way: 'open' | 'close', go: () => Promise<unknown>, { start, update }: { start?: () => void, update: () => Promise<void> }) {
  let transition: ViewTransition | undefined
  const stop = useRouter().beforeResolve((to) => {
    if (to.path !== path) return
    stop()
    return new Promise<void>((captured) => {
      start?.()
      document.documentElement.dataset.morph = way
      transition = document.startViewTransition(() => {
        captured()
        return update()
      })
    })
  })
  try {
    await go()
  }
  finally {
    stop()
  }
  await transition?.finished.catch(() => {})
  delete document.documentElement.dataset.morph
}

// Moves `el` (at `at`) as if it came from `from`, or, going back, to it:
// translate and scale from the top-left corner, the corners rounding to the
// card's (radius.card, 20px) the closer it is to the card.
// Its dialog is `data-morphing` meanwhile.
function flip(el: HTMLElement, from: DOMRect, at: DOMRect, { back = false } = {}): Animation {
  const card = {
    transform: `translate(${from.left - at.left}px, ${from.top - at.top}px) scale(${from.width / at.width}, ${from.height / at.height})`,
    transformOrigin: '0 0',
    borderRadius: '20px',
  }
  const own = { transform: 'none', transformOrigin: '0 0', borderRadius: '0px' }
  const dialog = el.closest('dialog')
  dialog?.setAttribute('data-morphing', '')
  const animation = el.animate(back ? [own, card] : [card, own], {
    duration: motionMs('swoosh'),
    easing: motionEase('swoosh'),
    fill: back ? 'forwards' : 'none',
  })
  const done = () => dialog?.removeAttribute('data-morphing')
  animation.finished.then(done, done)
  return animation
}
