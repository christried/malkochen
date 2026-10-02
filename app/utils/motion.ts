// For motion driven from script; CSS gets the same from tokens.css (and the
// timings with no token there from main.css).

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Whether this browser has the View Transitions API.
export function supportsViewTransitions(): boolean {
  return typeof document.startViewTransition === 'function'
}

// The durations script may ask for: the handoff's motion tokens
// (tokens.css) and the timings of single interactions (main.css). Every one
// collapses to 0 with reduced motion, except `fade`.
export type DurationToken
  = | 'tap' | 'fade' | 'pop' | 'settle' | 'sheet' | 'swoosh' | 'lift' | 'stagger' | 'celebrate' | 'idle'
    | 'drop-settle' | 'drop-swallow' | 'drop-shrink' | 'drop-collapse' | 'drop-burst'
    | 'cooking-collapse' | 'cook-hold' | 'cook-leave' | 'toast-delay' | 'tab-bump'
    | 'fly-to-tab' | 'milestone-delay' | 'saved-flight' | 'sheet-out' | 'scrim-out'
    | 'badge-step' | 'milestone-stay' | 'board-created-columns' | 'board-created-column-gap'

// The easings, from tokens.css.
export type EasingToken = 'tap' | 'fade' | 'pop' | 'settle' | 'sheet' | 'swoosh' | 'lift' | 'idle'

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

// A duration in ms, e.g. 'settle' → 480 (0 with reduced motion).
export function motionMs(token: DurationToken): number {
  const value = cssVar(`--dur-${token}`)
  return value.endsWith('ms') ? Number.parseFloat(value) : Number.parseFloat(value) * 1000 || 0
}

// An easing for a Web Animation, e.g. 'swoosh' → 'cubic-bezier(.45,0,.2,1)'.
export function motionEase(token: EasingToken): string {
  return cssVar(`--ease-${token}`) || 'ease'
}

// Resolves after `ms`.
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// How a Placeholder Image plays its loop: on and on, once through, or not.
export type ClipMotion = 'loop' | 'once' | null

// "Wrong input" (handoff Dialog): the field shakes sideways once, ±5px over
// 500ms. Reduced motion: it doesn't.
export function shake(el: Element) {
  if (prefersReducedMotion()) return
  el.animate(
    [{ translate: '0' }, { translate: '-5px' }, { translate: '5px' }, { translate: '-5px' }, { translate: '5px' }, { translate: '0' }],
    { duration: 500, easing: motionEase('idle') },
  )
}
