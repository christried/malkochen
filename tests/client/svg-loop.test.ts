import { readdirSync, readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { loopStyle } from '../../app/utils/svg-loop'

// Seam 4: what an animated layer of a layered SVG (its `data-loop` and
// `data-pivot`, handoff README §7) asks of CSS. The keyframes are named in
// full; whether the loop runs on, once or not at all is SvgLoop's.

test('a loop names its keyframes, duration, easing and delay', () => {
  expect(loopStyle('ph-twirl 3s ease-in-out infinite', null)).toMatchObject({ '--loop': 'ph-twirl 3s ease-in-out 0s' })
  expect(loopStyle('ph-steam 2.7s ease-out .9s infinite', null)).toMatchObject({ '--loop': 'ph-steam 2.7s ease-out .9s' })
  expect(loopStyle('r11-sprout 4.4s linear -4.1s infinite', null)).toMatchObject({ '--loop': 'r11-sprout 4.4s linear -4.1s' })
  expect(loopStyle('ph-toss 2.4s cubic-bezier(.3,.6,.4,1) .08s infinite', null))
    .toMatchObject({ '--loop': 'ph-toss 2.4s cubic-bezier(.3,.6,.4,1) .08s' })
})

test('a pivot in viewBox units turns about that point of the drawing', () => {
  expect(loopStyle('r11-roll 4.4s linear infinite', '95 51'))
    .toMatchObject({ 'transform-box': 'view-box', 'transform-origin': '95px 51px' })
})

test('a pivot in percent or words turns about that point of the layer itself', () => {
  expect(loopStyle('ph-twirl 3s ease-in-out infinite', '50% 100%'))
    .toMatchObject({ 'transform-box': 'fill-box', 'transform-origin': '50% 100%' })
  expect(loopStyle('ph-bub 2.4s ease-out infinite', 'center'))
    .toMatchObject({ 'transform-box': 'fill-box', 'transform-origin': 'center' })
})

test('without a pivot, a layer turns about its own centre', () => {
  expect(loopStyle('ph-steam 2.7s ease-out infinite', null))
    .toMatchObject({ 'transform-box': 'fill-box', 'transform-origin': 'center' })
})

test('an unreadable loop leaves the layer still', () => {
  expect(loopStyle('wobble', null)).toBeNull()
  expect(loopStyle('ph-roll fast linear infinite', '95 51')).toBeNull()
})

test('every loop the app draws has its keyframes', () => {
  const css = readFileSync('app/assets/css/loops.css', 'utf8')
  const keyframes = new Set([...css.matchAll(/@keyframes ([\w-]+)/g)].map(m => m[1]))
  const files = ['public/placeholders', 'public/clips'].flatMap(dir => readdirSync(dir)
    .filter(name => name.endsWith('.svg'))
    .map(name => `${dir}/${name}`))
  const loops = files.flatMap(file => [...readFileSync(file, 'utf8').matchAll(/data-loop="([^"]*)"/g)]
    .map(([, loop]) => ({ file, loop: loopStyle(loop!, null)?.['--loop'] ?? loop! })))

  expect(loops.length).toBeGreaterThan(50)
  expect(loops.filter(({ loop }) => !keyframes.has(loop.split(' ')[0]))).toEqual([])
})
