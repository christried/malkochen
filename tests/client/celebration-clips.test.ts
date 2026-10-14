import { expect, test } from 'vitest'
import { backgrounds, drawing, keyframes, layer, layerTag, loops, THEMES } from './drawing'

// The two celebrations (#215), drawn in code (SvgLoop) where they were 30 fps
// videos on a baked-in square: the 10th Cooking's "10×" pebble
// (milestone-10x) and a new Board's pebble (board-created), as their briefs
// (REMOTION.md) and the Remotion clips that rendered them before tell. Each
// plays once: every layer goes through the clip's whole length, from its
// first frame to its last, and the drawing as it stands is that last frame,
// the still. The labels on the pebbles ("10×", the Board's emoji) are Vue's.

const SURFACE = { light: '#FFFFFF', dark: '#1E1C1A' }
const ACCENTS = ['#F7B94A', '#A5C7AE', '#F08A5D', '#DE8CF2', '#A8BEE3']

test.each(THEMES)('the 10th Cooking, %s: a ring, a burst and the pebble, and nothing behind them', (theme) => {
  const svg = drawing('milestone-10x', theme)
  expect(backgrounds(svg)).toEqual([])
  expect([...svg.matchAll(/data-layer="([^"]+)"/g)].map(([, name]) => name)).toEqual(['ring', 'burst', 'pebble'])
  // Pebble and ring in the theme's surface colour.
  expect(layer(svg, 'pebble')).toContain(`fill="${SURFACE[theme]}"`)
  expect(layer(svg, 'ring')).toContain(`stroke="${SURFACE[theme]}"`)
})

test.each(THEMES)('the 10th Cooking, %s: every layer plays once through its 1.8s (54 frames)', (theme) => {
  expect(Object.fromEntries(loops('milestone-10x', theme))).toEqual({
    ring: 'm10-ring 1.8s linear 0s',
    burst: 'm10-burst 1.8s linear 0s',
    pebble: 'm10-pebble 1.8s linear 0s',
  })
})

test('the "10×" pebble pops from nothing at f4, overshoots at f18 and rests from f26', () => {
  const pebble = keyframes('m10-pebble')
  expect(pebble).toMatch(/^0%,7\.4074%\{transform:rotate\(-20deg\)scale\(0\);animation-timing-function:cubic-bezier\(0,0,\.58,1\)\}/)
  expect(pebble).toContain('33.3333%{transform:rotate(-3deg)scale(1.12);animation-timing-function:cubic-bezier(.42,0,.58,1)}')
  expect(pebble).toMatch(/48\.1481%,100%\{transform:rotate\(0deg\)scale\(1\)\}$/)
})

test('pebbles burst out from f8 and are gone by f35; the ring pulses out from f15 to f42', () => {
  const burst = keyframes('m10-burst')
  expect(burst).toMatch(/^0%,14\.8148%\{opacity:0;transform:scale\(0\)/)
  expect(burst).toContain('16.6667%{opacity:1;transform:scale(.3);animation-timing-function:cubic-bezier(0,0,.58,1)}')
  expect(burst).toMatch(/64\.8148%,100%\{opacity:0;transform:scale\(1\.5\)\}$/)
  const ring = keyframes('m10-ring')
  expect(ring).toMatch(/^0%,27\.7778%\{opacity:0;transform:scale\(\.9\)/)
  expect(ring).toContain('33.3333%{opacity:.7;transform:scale(1);animation-timing-function:cubic-bezier(0,0,.58,1)}')
  expect(ring).toMatch(/77\.7778%,100%\{opacity:0;transform:scale\(1\.9\)\}$/)
})

test.each(THEMES)('the 10th Cooking, %s: the still is the last frame, the pebble resting alone', (theme) => {
  const svg = drawing('milestone-10x', theme)
  expect(layerTag(svg, 'ring')).toContain('opacity="0"')
  expect(layerTag(svg, 'burst')).toContain('opacity="0"')
  expect(layerTag(svg, 'pebble')).not.toContain('opacity=')
})

test.each(THEMES)('a new Board, %s: ten pebbles of confetti and the Board\'s pebble, and nothing behind them', (theme) => {
  const svg = drawing('board-created', theme)
  expect(backgrounds(svg)).toEqual([])
  const names = [...svg.matchAll(/data-layer="([^"]+)"/g)].map(([, name]) => name)
  expect(names).toEqual([...Array.from({ length: 10 }, (_, i) => `confetti_${i + 1}`), 'pebble'])
  expect(layer(svg, 'pebble')).toContain(`fill="${SURFACE[theme]}"`)
  // The confetti in the Column accents, round and round, the same in both themes.
  const colours = names.slice(0, 10).map(name => layer(svg, name).match(/fill="(#[0-9A-F]{6})"/i)?.[1])
  expect(colours).toEqual(Array.from({ length: 10 }, (_, i) => ACCENTS[i % 5]))
})

test.each(THEMES)('a new Board, %s: every layer plays once through its 1.2s (36 frames), the confetti spinning alternately', (theme) => {
  const layers = loops('board-created', theme)
  expect(layers.get('pebble')).toBe('bc-pebble 1.2s linear 0s')
  expect(Array.from({ length: 10 }, (_, i) => layers.get(`confetti_${i + 1}`)))
    .toEqual(Array.from({ length: 10 }, (_, i) => `bc-confetti-${i % 2 ? 'cw' : 'ccw'} 1.2s linear 0s`))
})

test.each(THEMES)('a new Board, %s: the confetti fly out evenly round from the top', (theme) => {
  const svg = drawing('board-created', theme)
  const turns = Array.from({ length: 10 }, (_, i) => svg.match(new RegExp(`<g transform="rotate\\((-?[\\d.]+) 130 130\\)">\\s*<g data-layer="confetti_${i + 1}"`))?.[1])
  expect(turns.map(Number)).toEqual(Array.from({ length: 10 }, (_, i) => 36 * i - 90))
})

test('the Board\'s pebble pops with a twist from f3 (−30°), to +8° at f9, and rests at f13', () => {
  const pebble = keyframes('bc-pebble')
  expect(pebble).toMatch(/^0%,8\.3333%\{transform:rotate\(-30deg\)scale\(0\);animation-timing-function:cubic-bezier\(0,0,\.58,1\)\}/)
  expect(pebble).toContain('25%{transform:rotate(8deg)scale(1.08);animation-timing-function:cubic-bezier(.42,0,.58,1)}')
  expect(pebble).toMatch(/36\.1111%,100%\{transform:rotate\(0deg\)scale\(1\)\}$/)
})

test('the confetti burst from the pebble\'s edge at f3 and have spun 120° out of sight by f18', () => {
  for (const [name, turn] of [['bc-confetti-ccw', '-120deg'], ['bc-confetti-cw', '120deg']] as const) {
    const confetti = keyframes(name)
    expect(confetti).toMatch(/^0%,8\.3333%\{opacity:0;transform:translateX\(0px\)rotate\(0deg\)scale\(\.4\)/)
    expect(confetti).toContain('13.8889%{opacity:1;transform:translateX(10.4px)rotate(0deg)scale(1);animation-timing-function:cubic-bezier(.42,0,.58,1)}')
    expect(confetti).toMatch(new RegExp(`50%,100%\\{opacity:0;transform:translateX\\(76\\.96px\\)rotate\\(${turn}\\)scale\\(\\.7\\)\\}$`))
  }
})

test.each(THEMES)('a new Board, %s: the still is the last frame, the pebble resting alone', (theme) => {
  const svg = drawing('board-created', theme)
  for (let i = 1; i <= 10; i++) expect(layerTag(svg, `confetti_${i}`)).toContain('opacity="0"')
  expect(layerTag(svg, 'pebble')).not.toContain('opacity=')
})
