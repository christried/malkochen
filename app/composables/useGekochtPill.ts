// The Gekocht celebration's pill at the top of the screen (#105, variant B):
// Topfbert in it with one of his cheers, "Gekocht ✓" and, for a Dish moved
// into another Board's Gekocht Column, that Board (`board`). The actions
// stay at the bottom, in the Gekocht toast. Shared, like the confetti, as it
// shows wherever GekochtPill is: over the Board, in the Dish detail, over a
// celebration. It goes by itself (--dur-gekocht-pill), whichever of those
// shows it then, or none.
export interface ShownGekochtPill {
  cheer: string
  board?: string
  // A new one each time it is shown, so Topfbert pops up again.
  key: number
}

// Its one timer, as the pill is shared; only ever set in the browser.
let hiding: ReturnType<typeof setTimeout> | undefined

export function useGekochtPill() {
  const pill = useState<ShownGekochtPill | null>('gekocht-pill', () => null)
  return {
    pill,
    show: (shown: Omit<ShownGekochtPill, 'key'>) => {
      const next = { ...shown, key: (pill.value?.key ?? 0) + 1 }
      pill.value = next
      clearTimeout(hiding)
      hiding = setTimeout(() => {
        if (pill.value?.key === next.key) pill.value = null
      }, motionMs('gekocht-pill'))
    },
    // Where the pill shows, for the confetti to burst from when nothing
    // else on the screen started the Cooking: the middle of its place at
    // the top (GekochtPill), which is there even while no pill shows.
    origin: (): Point => {
      const place = document.querySelector('[data-gekocht-pill-place]')
      return place ? centreOf(place.getBoundingClientRect()) : { x: innerWidth / 2, y: 0 }
    },
  }
}
