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
