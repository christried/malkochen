// For motion driven from script; CSS gets the same from tokens.css.

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

// A motion token's duration in ms, e.g. 'settle' → 480 (0 with reduced
// motion, as tokens.css collapses it).
export function motionMs(token: string): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--dur-${token}`).trim()
  return value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000 || 0
}

// How a Placeholder Image plays its loop: on and on, once through, or not.
export type ClipMotion = 'loop' | 'once' | null

// "Wrong input" (handoff Dialog): the field shakes sideways once, ±5px over
// 500ms. Reduced motion: it doesn't.
export function shake(el: Element) {
  if (prefersReducedMotion()) return
  el.animate(
    [{ translate: '0' }, { translate: '-5px' }, { translate: '5px' }, { translate: '-5px' }, { translate: '5px' }, { translate: '0' }],
    { duration: 500, easing: 'ease-in-out' },
  )
}
