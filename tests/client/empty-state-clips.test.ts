import { expect, test } from 'vitest'
import { backgrounds, drawing, keyframes, layer, loops, THEMES } from './drawing'

// The empty Board's and the empty search's clips, drawn in code (SvgLoop)
// from the handoff's layers, as their briefs (REMOTION.md "empty-board",
// "search-empty") and the Remotion clips that rendered them before tell. No
// background of their own: they sit on whatever is behind them.

test.each(THEMES)('the empty Board, %s: Topfbert on his butter blob, and nothing behind it', (theme) => {
  const svg = drawing('empty-board', theme)
  expect(backgrounds(svg)).toEqual([])
  // The blob comes first: the empty Column's butter blob in this theme.
  const blob = svg.match(/<g data-layer="blob">\s*<path [^>]*fill="(#[0-9A-F]{6})"/i)?.[1]
  expect(blob).toBe(theme === 'light' ? '#FDE4BD' : '#6C5631')
})

test.each(THEMES)('the empty Board, %s: four veggies hop out of the pot in turn, 18 of 72 frames apart', (theme) => {
  const layers = loops('empty-board', theme)
  expect(['veggie_1', 'veggie_2', 'veggie_3', 'veggie_4'].map(name => layers.get(name))).toEqual([
    'eb-hop 2.4s linear 0s',
    'eb-hop 2.4s linear .6s',
    'eb-hop 2.4s linear 1.2s',
    'eb-hop 2.4s linear 1.8s',
  ])
})

test('a veggie is up and flipped 150° at its apex (f9), lands a full turn later (f16) and rests', () => {
  const hop = keyframes('eb-hop')
  expect(hop).toContain('12.5%{transform:translateY(-32px)rotate(150deg)')
  expect(hop).toContain('22.2222%,100%{transform:translateY(0)rotate(360deg)}')
  expect(hop).toMatch(/^0%\{transform:translateY\(0\)rotate\(0deg\)/)
})

test.each(THEMES)('the empty Board, %s: Topfbert bobs, sways his hat, steams and blinks on the 2.4s loop', (theme) => {
  const layers = loops('empty-board', theme)
  expect(layers.get('whole')).toBe('tb-bob 2.4s ease-in-out 0s')
  expect(layers.get('hat')).toBe('tb-hat 2.4s ease-in-out 0s')
  expect(layers.get('steam_1')).toBe('tb-steam 2.4s ease-out 0s')
  // 30 frames behind: at frame 0 it is 42 of its 72 frames in.
  expect(layers.get('steam_2')).toBe('tb-steam 2.4s ease-out -1.4s')
  expect(layers.get('eyes')).toBe('eb-blink 2.4s ease-in-out 0s')
})

test('Topfbert blinks at f66–70 of 72, eyes open at frame 0', () => {
  const blink = keyframes('eb-blink')
  expect(blink).toMatch(/^0%,91\.6667%,97\.2222%,100%\{transform:scaleY\(1\)\}/)
  expect(blink).toContain('94.4444%{transform:scaleY(.1)}')
})

test('the empty Board\'s steam takes the theme\'s ink, his outline stays his own', () => {
  const steam = (theme: string) => drawing('empty-board', theme).match(/data-layer="steam_1"[^>]*>\s*<rect [^>]*fill="(#[0-9A-F]{6})"/i)?.[1]
  expect(steam('light')).toBe('#1F1E1C')
  expect(steam('dark')).toBe('#F3EFE8')
  expect(drawing('empty-board', 'dark')).toMatch(/data-layer="body">\s*<path [^>]*stroke="#1F1E1C"/)
})

test.each(THEMES)('the empty search, %s: magnifier, plate and pea, and nothing behind them', (theme) => {
  const svg = drawing('search-empty', theme)
  expect(backgrounds(svg)).toEqual([])
  expect([...svg.matchAll(/data-layer="([^"]+)"/g)].map(([, name]) => name)).toEqual(['pea', 'plate', 'magnifier'])
})

test.each(THEMES)('the empty search, %s: the magnifier sweeps and the pea peeks on the 3.6s loop', (theme) => {
  const layers = loops('search-empty', theme)
  expect(layers.get('magnifier')).toBe('se-sweep 3.6s linear 0s')
  expect(layers.get('pea')).toBe('se-peek 3.6s linear 0s')
})

test('the magnifier swings from −10° on the left to +10° on the right at f54 and back', () => {
  // Drawn at −10°: its frame 0 is at rest.
  expect(drawing('search-empty', 'light')).toMatch(/data-layer="magnifier"[^>]*>\s*<g transform="rotate\(-10 54 38\)"/)
  const sweep = keyframes('se-sweep')
  expect(sweep).toMatch(/^0%,100%\{transform:translateX\(0\)rotate\(0deg\)/)
  expect(sweep).toContain('50%{transform:translateX(24px)rotate(20deg)')
})

test('the pea peeks out from behind the plate at f54–80 and has ducked by f90', () => {
  const peek = keyframes('se-peek')
  expect(peek).toMatch(/^0%,50%\{transform:translateY\(0\);animation-timing-function:ease-out\}/)
  expect(peek).toContain('57.4074%,74.0741%{transform:translateY(-20px);animation-timing-function:ease-in}')
  expect(peek).toContain('83.3333%,100%{transform:translateY(0)}')
})

test('in dark, the plate and the magnifier take the theme\'s ink and surface; the pea keeps its own', () => {
  const dark = drawing('search-empty', 'dark')
  expect(layer(dark, 'plate')).toContain('#F3EFE8')
  expect(layer(dark, 'plate')).toContain('#1E1C1A')
  expect(layer(dark, 'plate')).not.toMatch(/#1F1E1C|#FFFFFF/i)
  expect(layer(dark, 'magnifier')).toContain('#F3EFE8')
  expect(layer(dark, 'magnifier')).not.toMatch(/#1F1E1C|#FFFFFF/i)
  expect(layer(dark, 'pea')).toContain('#1F1E1C')
})
