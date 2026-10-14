import { readdirSync } from 'node:fs'
import { expect, test } from 'vitest'
import { backgrounds, drawing, keyframes, layerTag, loops } from './drawing'

// The link lookup's two clips (#216), drawn in code (SvgLoop) where they were
// 30 fps videos on a baked-in square: Topfbert stirring while a link is
// looked up (lookup-stir), and his oops when the lookup fails
// (lookup-failed), as their briefs (REMOTION.md) and the Remotion clips that
// rendered them before tell. Topfbert keeps his ink in both themes, so each
// is one drawing for both.

const veggieTags = (svg: string) => [...svg.matchAll(/data-layer="(veggie_\d_(?:near|far))"/g)].map(([, name]) => name)

test.each(['lookup-stir', 'lookup-failed'])('%s: one drawing for both themes, with nothing behind Topfbert', (clip) => {
  expect(backgrounds(drawing(clip))).toEqual([])
  const files = readdirSync('public/clips').filter(name => name.startsWith(`${clip}-`) || name.startsWith(`${clip}.`))
  expect(files).toEqual([`${clip}.svg`])
})

test('stirring: he bobs and sways his hat every 1.2s, his spoon swings, the veggies go round in 2.4s', () => {
  const stir = Object.fromEntries(loops('lookup-stir'))
  expect(stir).toMatchObject({
    whole: 'tb-bob 1.2s ease-in-out 0s',
    hat: 'tb-hat 1.2s ease-in-out 0s',
    spoon: 'ls-spoon 1.2s linear 0s',
  })
  // A third of a lap apart: carrot, pea, pepper.
  for (const [i, delay] of [[1, '0s'], [2, '-0.8s'], [3, '-1.6s']] as const) {
    for (const side of ['near', 'far']) {
      expect(stir[`veggie_${i}_${side}`]).toBe(`ls-${side} 2.4s linear ${delay}`)
      expect(stir[`veggie_${i}_${side}_x`]).toBe(`ls-orbit-x 2.4s linear ${delay}`)
      expect(stir[`veggie_${i}_${side}_y`]).toBe(`ls-orbit-y 2.4s linear ${delay}`)
    }
  }
  expect(Object.values(stir).every(loop => !loop.startsWith('unreadable'))).toBe(true)
})

test('stirring: the spoon rests at −20° and swings to +20° at half its round', () => {
  const svg = drawing('lookup-stir')
  expect(svg).toContain('<g transform="rotate(-20 71.5 54.4)"><g data-layer="spoon"')
  expect(keyframes('ls-spoon')).toContain('50%{transform:rotate(40deg)')
})

test('stirring: each veggie shows behind the rim for the far half of its lap and in front for the near half', () => {
  const svg = drawing('lookup-stir')
  const rim = svg.indexOf('data-layer="rim"')
  const tags = veggieTags(svg)
  expect(tags).toEqual(['veggie_1_far', 'veggie_2_far', 'veggie_3_far', 'veggie_1_near', 'veggie_2_near', 'veggie_3_near'])
  for (const i of [1, 2, 3]) {
    expect(svg.indexOf(`data-layer="veggie_${i}_far"`)).toBeLessThan(rim)
    expect(svg.indexOf(`data-layer="veggie_${i}_near"`)).toBeGreaterThan(svg.indexOf('data-layer="hat"'))
  }
  // At frame 0 the carrot is nearest; the pea and the pepper are a third of a
  // lap on either side, at the back.
  expect(layerTag(svg, 'veggie_1_near')).not.toContain('opacity="0"')
  expect(layerTag(svg, 'veggie_1_far')).toContain('opacity="0"')
  for (const i of [2, 3]) {
    expect(layerTag(svg, `veggie_${i}_near`)).toContain('opacity="0"')
    expect(layerTag(svg, `veggie_${i}_far`)).not.toContain('opacity="0"')
  }
  // The two swap at the ends of the ellipse, a quarter and three quarters on.
  expect(keyframes('ls-near')).toMatch(/^0%\{opacity:1;animation-timing-function:step-end\}25%\{opacity:0;animation-timing-function:step-end\}75%,100%\{opacity:1\}$/)
  expect(keyframes('ls-far')).toMatch(/^0%\{opacity:0;animation-timing-function:step-end\}25%\{opacity:1;animation-timing-function:step-end\}75%,100%\{opacity:0\}$/)
  // Out to ±40 of his units across, ±10 deep.
  expect(keyframes('ls-orbit-x')).toContain('25%{transform:translateX(40px)')
  expect(keyframes('ls-orbit-x')).toContain('75%{transform:translateX(-40px)')
  expect(keyframes('ls-orbit-y')).toContain('50%{transform:translateY(-10px)')
})

test('failed: he wobbles, sways his hat and sweats in 2.4s, standing at frame 30, drop showing', () => {
  expect(Object.fromEntries(loops('lookup-failed'))).toEqual({
    whole: 'lf-wobble 2.4s ease-in-out -1s',
    hat: 'tb-hat 2.4s ease-in-out -1s',
    drop: 'lf-drop 2.4s linear -1s',
  })
  const svg = drawing('lookup-failed')
  // Tilted, between −6° and −2°.
  const tilt = Number(layerTag(svg, 'whole').match(/rotate\((-?[\d.]+) 70 130\)/)![1])
  expect(tilt).toBeGreaterThan(-6)
  expect(tilt).toBeLessThan(-2)
  // The drop is out at frame 30 (it swells f14–22, slides off from f58).
  expect(layerTag(svg, 'drop')).not.toMatch(/opacity|transform/)
  expect(keyframes('lf-drop')).toMatch(/^0%,19\.4444%\{transform:scale\(0\)/)
  expect(keyframes('lf-drop')).toContain('30.5556%,80.5556%{transform:none')
  expect(keyframes('lf-drop')).toContain('100%{transform:translateY(10px);opacity:0}')
})
