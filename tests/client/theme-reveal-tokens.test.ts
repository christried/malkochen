import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

// The Theme reveal's timings (handoff motion.json "Theme reveal",
// utils/theme-reveal.ts), read from the tokens it runs on. Moved down from
// user-settings.spec.ts (#287), which checks that the reveal uses them.
const TOKENS = readFileSync(join(import.meta.dirname, '../../app/assets/css/tokens.css'), 'utf8')

// The custom properties a `:root { … }` block sets, the first such block
// after `after`.
function rootBlock(after: string): Record<string, string> {
  const start = TOKENS.indexOf(after)
  expect(start).toBeGreaterThanOrEqual(0)
  const open = TOKENS.indexOf(':root {', start)
  const body = TOKENS.slice(open, TOKENS.indexOf('}', open))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1]!, m[2]!.trim()]))
}

test('a changed Darstellung spreads in 600ms with the swoosh easing, and cross-fades in 240ms without View Transitions', () => {
  const root = rootBlock('')
  expect(root['--dur-swoosh']).toBe('600ms')
  expect(root['--ease-swoosh']).toBe('cubic-bezier(.45,0,.2,1)')
  expect(root['--dur-fade']).toBe('240ms')
})

test('with reduced motion, nothing spreads, and the cross-fade takes 200ms', () => {
  const reduced = rootBlock('@media (prefers-reduced-motion: reduce)')
  expect(reduced['--dur-swoosh']).toBe('0ms')
  expect(reduced['--dur-fade']).toBe('200ms')
})
