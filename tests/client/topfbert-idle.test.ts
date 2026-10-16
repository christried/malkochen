import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { loopStyle } from '../../app/utils/svg-loop'
import { drawing, keyframes, layer, layerTag } from './drawing'

// Topfbert's idle (handoff topfbert/layers.json → idle): the drawings
// TopfbertIdle plays, one per mood the app shows him in. Each animated layer
// names its loop in `data-loop` (SvgLoop runs it); these are the handoff's
// per-mood rules.

const MOODS = ['happy', 'wow', 'oops'] as const

// Each layer's loop, by its `data-layer` name: "keyframes duration".
function loops(mood: string) {
  const svg = readFileSync(`public/clips/topfbert-idle-${mood}.svg`, 'utf8')
  const layers = new Map<string, string>()
  for (const [tag] of svg.matchAll(/<g\b[^>]*>/g)) {
    const name = tag.match(/data-layer="([^"]+)"/)?.[1]
    const loop = tag.match(/data-loop="([^"]+)"/)?.[1]
    if (name && loop) layers.set(name, loopStyle(loop, null)?.['--loop'] ?? `unreadable: ${loop}`)
  }
  return layers
}

test.each(MOODS)('%s breathes all over, twice in his 6s loop', (mood) => {
  expect(loops(mood).get('whole')).toBe('r11-breathe 3s ease-in-out 0s')
})

test.each(MOODS)('%s blinks, eyes and closed eyes swapping on the 6s clock', (mood) => {
  const layers = loops(mood)
  expect(layers.get('eyes')).toBe('r11-ieo 6s linear 0s')
  expect(layers.get('eyes_closed')).toBe('r11-iec 6s linear 0s')
})

test.each(['happy', 'wow'])('%s sways his hat over the 6s loop', (mood) => {
  expect(loops(mood).get('hat')).toBe('r11-ihat 6s ease-in-out 0s')
})

test.each(['happy', 'wow'])('%s steams, the second puff half a round behind', (mood) => {
  const layers = loops(mood)
  expect(layers.get('steam_1')).toBe('r11-steam 3s ease-out 0s')
  expect(layers.get('steam_2')).toBe('r11-steam 3s ease-out -1.5s')
})

test('oops only breathes and blinks: no steam, no hat sway; his drop keeps its own loop', () => {
  const layers = loops('oops')
  expect([...layers.keys()].filter(name => name.startsWith('steam'))).toEqual([])
  expect(layers.has('hat')).toBe(false)
  expect(layers.get('drop')).toBe('tb-drop 2.4s ease-in 0s')
})

test('wow\'s sparks keep their own loop', () => {
  const layers = loops('wow')
  expect(layers.get('spark_1')).toBe('tb-spark 1.4s linear 0s')
  expect(layers.get('spark_2')).toBe('tb-spark 1.4s linear .5s')
  expect(layers.get('spark_3')).toBe('tb-spark 1.4s linear .9s')
})

// The Tour's poses (handoff topfbert/layers.json → tour.poses): the R11 idle
// on the same 6s clock, plus each pose's own loop (r12-keyframes.css).

const POSES = ['waving', 'pointing', 'wink'] as const

test.each(POSES)('%s breathes all over, twice in his 6s loop, and blinks on the 6s clock', (pose) => {
  const layers = loops(pose)
  expect(layers.get('whole')).toBe('r11-breathe 3s ease-in-out 0s')
  expect(layers.get('eyes')).toBe('r11-ieo 6s linear 0s')
  expect(layers.get('eyes_closed')).toBe('r11-iec 6s linear 0s')
})

test('waving waves his arm about his shoulder, sways his hat and steams', () => {
  const svg = drawing('topfbert-idle-waving')
  const layers = loops('waving')
  expect(layers.get('arm')).toBe('r12-wave 6s ease-in-out 0s')
  expect(pivot(svg, 'arm')).toBe('111 63')
  expect(layers.get('hat')).toBe('r11-ihat 6s ease-in-out 0s')
  expect(layers.get('steam_1')).toBe('r11-steam 3s ease-out 0s')
  expect(layers.get('steam_2')).toBe('r11-steam 3s ease-out -1.5s')
})

test('pointing nudges his arm towards the target and sways his hat; no steam, so he mirrors cleanly', () => {
  const svg = drawing('topfbert-idle-pointing')
  const layers = loops('pointing')
  expect(layers.get('arm')).toBe('r12-nudge 6s ease-in-out 0s')
  expect(layers.get('hat')).toBe('r11-ihat 6s ease-in-out 0s')
  expect(pivot(svg, 'hat')).toBe('38.7 44.9')
  expect(svg).not.toMatch(/data-layer="steam/)
})

test('wink tips his hat instead of swaying it, steams, and blinks only his left eye', () => {
  const svg = drawing('topfbert-idle-wink')
  const layers = loops('wink')
  expect(layers.get('hat')).toBe('r12-tip 6s ease-in-out 0s')
  expect(pivot(svg, 'hat')).toBe('18 36')
  expect(layers.get('steam_1')).toBe('r11-steam 3s ease-out 0s')
  expect(layers.get('steam_2')).toBe('r11-steam 3s ease-out -1.5s')
  // One eye open (the left), one lid; the winking right eye stays shut.
  expect(layer(svg, 'eyes').match(/<ellipse\b[^>]*>/g)).toEqual([expect.stringContaining('cx="50.5"')])
  expect(layer(svg, 'eyes_closed').match(/M/g)).toHaveLength(1)
  expect(layerTag(svg, 'wink')).not.toMatch(/data-loop/)
})

test.each(['r12-wave', 'r12-nudge', 'r12-tip'])('%s is the handoff\'s keyframes', (name) => {
  const handoff = readFileSync('docs/design handoff/assets/r12-keyframes.css', 'utf8')
  const block = handoff.match(new RegExp(`@keyframes ${name}{((?:[^{}]*{[^}]*})*)}`))![1]!
  expect(keyframes(name)).toBe(block.replace(/\s+/g, ''))
})

test.each([...MOODS, ...POSES])('%s\'s steam, if any, takes the text colour; the rest of him is the same in both themes', (mood) => {
  const svg = drawing(`topfbert-idle-${mood}`)
  for (const name of ['steam_1', 'steam_2']) {
    if (!svg.includes(`data-layer="${name}"`)) continue
    expect(layer(svg, name)).toMatch(/style="fill:var\(--color-text, ?#1F1E1C\)"/)
  }
  expect(svg).not.toMatch(/var\(--(?!color-text\b)/)
})

// Below 48px (handoff tour.small, idle.small): breathe and blink only.
test('below 48px he only breathes and blinks: no steam, and hat and arm stay as drawn', () => {
  const css = readFileSync('app/assets/css/loops.css', 'utf8').replace(/\s+/g, ' ')
  const small = css.match(/@container topfbert \(width < 48px\) \{(.*?\}) \}/)?.[1]
  expect(small).toBeDefined()
  expect(small).toContain('[data-topfbert-idle] [data-svg-loop][data-run] [data-loop]:not([data-layer="whole"], [data-layer="eyes"], [data-layer="eyes_closed"]) { animation: none; }')
  expect(small).toContain('[data-topfbert-idle] [data-layer^="steam"] { visibility: hidden; }')
})

function pivot(svg: string, name: string) {
  return layerTag(svg, name).match(/data-pivot="([^"]+)"/)?.[1]
}
