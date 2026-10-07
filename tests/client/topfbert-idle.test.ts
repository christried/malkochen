import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { loopStyle } from '../../app/utils/svg-loop'

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

test.each(MOODS)('%s sways his hat over the 6s loop', (mood) => {
  expect(loops(mood).get('hat')).toBe('r11-ihat 6s ease-in-out 0s')
})

test.each(['happy', 'wow'])('%s steams, the second puff half a round behind', (mood) => {
  const layers = loops(mood)
  expect(layers.get('steam_1')).toBe('r11-steam 3s ease-out 0s')
  expect(layers.get('steam_2')).toBe('r11-steam 3s ease-out -1.5s')
})

test('oops has no steam, and his drop keeps its own loop', () => {
  const layers = loops('oops')
  expect([...layers.keys()].filter(name => name.startsWith('steam'))).toEqual([])
  expect(layers.get('drop')).toBe('tb-drop 2.4s ease-in 0s')
})

test('wow\'s sparks keep their own loop', () => {
  const layers = loops('wow')
  expect(layers.get('spark_1')).toBe('tb-spark 1.4s linear 0s')
  expect(layers.get('spark_2')).toBe('tb-spark 1.4s linear .5s')
  expect(layers.get('spark_3')).toBe('tb-spark 1.4s linear .9s')
})
