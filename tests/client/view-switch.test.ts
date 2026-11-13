import { expect, test } from 'vitest'
import { iconsFit } from '../../app/utils/view-switch'

// The view switch (R15 ViewSwitch): its icons hide first when a label does
// not fit its segment, so a long word keeps its room. Each segment has the
// room of a third of the track; its content is the label with its icon.

test('the icons stay when every label, with its icon, fits its segment', () => {
  expect(iconsFit([
    { content: 90, room: 107 },
    { content: 60, room: 107 },
    { content: 100, room: 107 },
  ])).toBe(true)
})

test('the icons go as soon as one label with its icon is wider than its segment', () => {
  expect(iconsFit([
    { content: 90, room: 107 },
    { content: 108, room: 107 },
    { content: 60, room: 107 },
  ])).toBe(false)
})

test('a label exactly as wide as its segment still fits', () => {
  expect(iconsFit([{ content: 107, room: 107 }])).toBe(true)
})

test('no segments fit trivially', () => {
  expect(iconsFit([])).toBe(true)
})
