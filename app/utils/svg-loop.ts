// Loops drawn in code from layered SVGs (SvgLoop.vue; handoff README §7):
// each animated layer carries `data-loop`, its CSS animation without the
// iteration count ("r11-roll 4.4s linear infinite": keyframes, duration,
// easing, delay), and `data-pivot`, its transform origin. The keyframes are
// named in full and live in assets/css/loops.css. Played by CSS, a loop runs
// at the screen's own refresh rate and stays sharp at any size.
//
// A delay works as in CSS: a layer waits on its keyframes' 0% (at rest, by
// the handoff's rule that frame 0 is the still) and a negative one starts
// part way in, as its inline frame-0 style shows it.

const LOOP = /^([\w-]+)\s+([\d.]+m?s)\s+(cubic-bezier\([^)]*\)|[\w-]+)(?:\s+(-?[\d.]+m?s))?\s+infinite$/

// What a layer's loop asks of CSS: the animation as `--loop` (loops.css adds
// how often it runs, and pauses it), and the point it turns about. A pivot of
// two numbers is a point in the drawing's viewBox units; percentages or words
// are of the layer's own box, its centre without one. null: unreadable, the
// layer stays still.
export function loopStyle(loop: string, pivot: string | null | undefined): Record<string, string> | null {
  const match = loop.trim().match(LOOP)
  if (!match) return null
  const [, name, duration, easing, delay = '0s'] = match
  const point = pivot?.trim().match(/^(-?[\d.]+)\s+(-?[\d.]+)$/)
  return {
    '--loop': `${name} ${duration} ${easing} ${delay}`,
    'transform-box': point ? 'view-box' : 'fill-box',
    'transform-origin': point ? `${point[1]}px ${point[2]}px` : pivot?.trim() || 'center',
  }
}
