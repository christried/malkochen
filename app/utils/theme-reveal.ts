// The Theme reveal (handoff motion.json "Theme reveal"): changing Darstellung
// spreads the new theme over the old one as a circle growing from the tapped
// option, in 600ms (swoosh), with the View Transitions API. Without it, the
// theme cross-fades (fade). Reduced motion: it switches at once with a 200ms
// cross-fade. Nothing runs if the theme shown doesn't change ("System" on a
// device already showing that theme).
// `<html data-theme-reveal>` says which is running meanwhile (main.css).

// The reveal running now; an older one doesn't end a newer one's.
let current: object | null = null

function supportsViewTransitions(): boolean {
  return typeof document.startViewTransition === 'function'
}

// Shows the theme `apply` sets (it must change the page at once), revealed
// from `origin` if `changes`.
export async function revealTheme(origin: HTMLElement, changes: boolean, apply: () => void): Promise<void> {
  if (!changes) {
    apply()
    return
  }
  const run = {}
  current = run
  const html = document.documentElement
  if (prefersReducedMotion() || !supportsViewTransitions()) {
    html.dataset.themeReveal = 'fade'
    // The cross-fade's transitions in place before the colours change.
    void getComputedStyle(html).backgroundColor
    apply()
    await wait(motionMs('fade'))
  }
  else {
    const { left, top, width, height } = origin.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    // Far enough to cover the farthest corner.
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    html.dataset.themeReveal = 'spread'
    const transition = document.startViewTransition(apply)
    await transition.ready.then(() => html.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: motionMs('swoosh'), easing: motionEase('swoosh'), pseudoElement: '::view-transition-new(root)' },
    ).finished).catch(() => {})
    await transition.finished.catch(() => {})
  }
  if (current === run) {
    current = null
    delete html.dataset.themeReveal
  }
}
