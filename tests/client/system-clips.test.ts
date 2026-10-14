import { readdirSync } from 'node:fs'
import { expect, test } from 'vitest'
import { backgrounds, drawing, keyframes, layer, layerTag, loops, THEMES } from './drawing'

// The last clips that were videos (#217), drawn in code (SvgLoop) where they
// were 30 fps videos on a baked-in square: Offline, the error screen, Not
// unlocked and the invite landing's intro and loop, as their briefs
// (REMOTION.md) and the Remotion clips that rendered them before tell. Their
// blobs are the page's (ClipBlob), in the page's own colour. And the empty
// Column's pea, happier.

const THEMED = ['offline', 'error', 'invite-intro', 'invite-loop']
const CLIPS = [...THEMED, 'not-unlocked']
const layerNames = (svg: string) => [...svg.matchAll(/data-layer="([^"]+)"/g)].map(([, name]) => name)

test.each(THEMED.flatMap(clip => THEMES.map(theme => [clip, theme])))('%s, %s: drawn, with nothing behind it, not even its blob', (clip, theme) => {
  const svg = drawing(clip, theme)
  expect(svg).toContain(`data-clip="${clip}"`)
  expect(backgrounds(svg)).toEqual([])
  expect(svg).not.toMatch(/data-layer="blob"|id="blob"/)
  // A still is the drawing as an image, which has no fonts: no text in it.
  expect(svg).not.toContain('<text')
})

test('not-unlocked: one drawing for both themes, with nothing behind Topfbert and no text', () => {
  const svg = drawing('not-unlocked')
  expect(backgrounds(svg)).toEqual([])
  expect(svg).not.toContain('<text')
})

test('no video, poster or Remotion render of these clips is left', () => {
  const files = readdirSync('public/clips').filter(name => CLIPS.some(clip => name.startsWith(`${clip}-`) || name.startsWith(`${clip}.`)))
  expect(files.filter(name => !name.endsWith('.svg'))).toEqual([])
  expect(files.sort()).toEqual([
    ...THEMED.flatMap(clip => THEMES.map(theme => `${clip}-${theme}.svg`)),
    'not-unlocked.svg',
  ].sort())
  // Nothing is on video any more.
  expect(readdirSync('public/clips').filter(name => /\.(mp4|webm|png)$/.test(name))).toEqual([])
})

test.each(THEMES)('offline, %s: he sleeps and bobs, two z\'s drift half a loop apart, the arcs fade; standing at f40', (theme) => {
  expect(Object.fromEntries(loops('offline', theme))).toEqual({
    whole: 'tb-bob 2.4s ease-in-out -1.3333s',
    hat: 'tb-hat 2.4s ease-in-out -1.3333s',
    z_1: 'of-z 2.4s ease-out -1.3333s',
    // 36 frames behind: 4 frames in at f40.
    z_2: 'of-z 2.4s ease-out -0.1333s',
    arc_outer: 'of-arc-outer 2.4s ease-in-out -1.3333s',
    arc_inner: 'of-arc-inner 2.4s ease-in-out -1.3333s',
  })
  const svg = drawing('offline', theme)
  // At f40 both arcs are down to 12%: no connection.
  expect(layerTag(svg, 'arc_outer')).toContain('opacity="0.12"')
  expect(layerTag(svg, 'arc_inner')).toContain('opacity="0.12"')
  expect(layerTag(svg, 'arc_1')).not.toContain('opacity')
})

test('offline: the arcs fade at f20–29 and f31–40 and are back by f72', () => {
  expect(keyframes('of-arc-outer')).toBe('0%,27.7778%{opacity:1}40.2778%,86.1111%{opacity:.12}100%{opacity:1}')
  expect(keyframes('of-arc-inner')).toBe('0%,43.0556%{opacity:1}55.5556%,86.1111%{opacity:.12}100%{opacity:1}')
})

test('offline: the Wi-Fi sign takes the theme\'s ink, Topfbert keeps his own, desaturated', () => {
  const arc = (theme: string) => layer(drawing('offline', theme), 'arc_1').match(/stroke="(#[0-9A-F]{6})"/i)?.[1]
  expect(arc('light')).toBe('#1F1E1C')
  expect(arc('dark')).toBe('#F3EFE8')
  for (const theme of THEMES) {
    // His sage body, 60% greyer.
    expect(layer(drawing('offline', theme), 'body')).not.toContain('#A5C7AE')
  }
  expect(layer(drawing('offline', 'light'), 'body')).toBe(layer(drawing('offline', 'dark'), 'body'))
})

test.each(THEMES)('error, %s: he wobbles and sweats over a swelling spill, three puffs rise 24 frames apart', (theme) => {
  expect(Object.fromEntries(loops('error', theme))).toEqual({
    spill: 'er-spill 2.4s linear 0s',
    puff_1: 'er-puff 2.4s ease-out 0s',
    puff_2: 'er-puff 2.4s ease-out -1.6s',
    puff_3: 'er-puff 2.4s ease-out -0.8s',
    whole: 'lf-wobble 2.4s ease-in-out 0s',
    hat: 'tb-hat 2.4s ease-in-out 0s',
    drop: 'lf-drop 2.4s linear 0s',
  })
  const svg = drawing('error', theme)
  // Frame 0 is the still: tilted −6°, no drop yet, the first puff not out.
  expect(layerTag(svg, 'whole')).toContain('rotate(-6)')
  expect(layerTag(svg, 'drop')).toContain('scale(0)')
  expect(layerTag(svg, 'puff_1')).toContain('opacity="0"')
  expect(layerTag(svg, 'puff_2')).not.toContain('opacity="0"')
  // Spill, puffs, then Topfbert over them.
  expect(layerNames(svg).slice(0, 4)).toEqual(['spill', 'puff_1', 'puff_2', 'puff_3'])
})

test('error: a puff rises 30 (of the 220-wide drawing) as it grows to 1.5 and fades; the spill is 1.12 wide at f36', () => {
  expect(keyframes('er-puff')).toMatch(/^0%\{transform:translateY\(0px\)scale\(\.4\);opacity:0\}/)
  expect(keyframes('er-puff')).toContain('100%{transform:translateY(-30px)scale(1.5);opacity:0}')
  expect(keyframes('er-spill')).toContain('50%{transform:scale(1.12,1)')
})

test('not-unlocked: Topfbert holds his sign up in his right handle; it sways about his grip', () => {
  const svg = drawing('not-unlocked')
  expect(Object.fromEntries(loops('not-unlocked'))).toEqual({
    whole: 'tb-bob 2.8s ease-in-out 0s',
    steam_1: 'tb-steam 2.8s ease-out 0s',
    steam_2: 'tb-steam 2.8s ease-out -1.6667s',
    sign: 'nu-sign 2.8s linear 0s',
    eyes: 'eb-blink 2.8s ease-in-out 0s',
    hat: 'tb-hat 2.8s ease-in-out 0s',
  })
  // Inside him, so it bobs with him, and behind his handle, which holds it.
  const names = layerNames(svg)
  expect(names.indexOf('sign')).toBeGreaterThan(names.indexOf('whole'))
  expect(names.indexOf('sign')).toBe(names.indexOf('handles') - 1)
  // Its grip is on his right handle (x 111–131, y 59–70 of his units).
  const [x, y] = layerTag(svg, 'sign').match(/data-pivot="([\d.]+) ([\d.]+)"/)!.slice(1).map(Number)
  expect(x).toBeGreaterThan(111)
  expect(x).toBeLessThan(131)
  expect(y).toBeGreaterThan(59)
  expect(y).toBeLessThan(70)
  // Still: the sign straight.
  expect(layerTag(svg, 'sign')).not.toContain('transform')
  expect(keyframes('nu-sign')).toMatch(/^0%\{transform:rotate\(0deg\).*25%\{transform:rotate\(8deg\).*75%\{transform:rotate\(-8deg\).*100%\{transform:rotate\(0deg\)\}$/)
})

test('not-unlocked: the sign reads "Bald!", centred on its board (x 10–110, y 8–48)', () => {
  const word = layer(drawing('not-unlocked'), 'sign').match(/<path d="([^"]+)"/)![1]!
  const points = word.match(/-?[\d.]+ -?[\d.]+/g)!.map(pair => pair.split(' ').map(Number) as [number, number])
  const [left, right] = [Math.min(...points.map(([x]) => x)), Math.max(...points.map(([x]) => x))]
  const [top, bottom] = [Math.min(...points.map(([, y]) => y)), Math.max(...points.map(([, y]) => y))]
  expect((left + right) / 2).toBeCloseTo(60, 0)
  expect((top + bottom) / 2).toBeCloseTo(28, 0)
  // "Bald!" in Figtree 700 at 19 is 40.8 wide; "Gleich!" was 59.3.
  expect(right - left).toBeCloseTo(40.8, 0)
})

test('not-unlocked: Topfbert and his sign sit inside the circle (centre 110 105, r 100), even swung', () => {
  const svg = drawing('not-unlocked')
  const [x, y, w, h] = svg.match(/<svg x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" viewBox="0 -20 140 150"/)!.slice(1).map(Number) as [number, number, number, number]
  const scale = w / 140
  const canvas = ([u, v]: [number, number]) => [x + u * scale, y + (v + 20) * scale] as const
  const inside = ([cx, cy]: readonly [number, number]) => Math.hypot(cx - 110, cy - 105) < 100
  expect(h).toBeCloseTo((w * 150) / 140)
  // His hat, handles and foot.
  for (const point of [[11, -12], [9, 65], [131, 65], [70, 130]] as [number, number][]) expect(inside(canvas(point))).toBe(true)
  // The sign's far corners, swung ±8° about the grip.
  const [gx, gy] = layerTag(svg, 'sign').match(/data-pivot="([\d.]+) ([\d.]+)"/)!.slice(1).map(Number)
  const sign = layer(svg, 'sign').match(/<svg x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)"/)!.slice(1).map(Number)
  const [sx, sy, sw] = sign as [number, number, number]
  for (const turn of [-8, 0, 8]) {
    for (const [u, v] of [[sx + sw, sy], [sx, sy]]) {
      const a = (turn * Math.PI) / 180
      const [dx, dy] = [u! - gx!, v! - gy!]
      expect(inside(canvas([gx! + dx * Math.cos(a) - dy * Math.sin(a), gy! + dx * Math.sin(a) + dy * Math.cos(a)]))).toBe(true)
    }
  }
})

test.each(THEMES)('invite loop, %s: six veggies go round the pebble in 14s, a sixth apart; the pebble and Topfbert bob every 2.8s', (theme) => {
  const layers = Object.fromEntries(loops('invite-loop', theme))
  expect(layers.pebble).toBe('iv-bob 2.8s linear 0s')
  expect(layers.whole).toBe('tb-bob 2.8s ease-in-out 0s')
  expect(layers.eyes).toBe('eb-blink 2.8s ease-in-out 0s')
  for (let i = 1; i <= 6; i++) {
    const delay = i === 1 ? '0s' : `${-Number((((i - 1) / 6) * 14).toFixed(4))}s`
    expect(layers[`veggie_${i}_x`]).toBe(`iv-orbit-x 14s linear ${delay}`)
    expect(layers[`veggie_${i}_y`]).toBe(`iv-orbit-y 14s linear ${delay}`)
  }
  // Veggie 1 starts at the top of its lap.
  expect(layerTag(drawing('invite-loop', theme), 'veggie_1_y')).toContain('translate(0 -70.3)')
})

test.each(THEMES)('invite intro, %s: everything pops or rises in once in 1.5s, standing at its end, the loop\'s frame 0', (theme) => {
  const layers = Object.fromEntries(loops('invite-intro', theme))
  expect(layers.pebble).toBe('iv-pebble-pop 1.5s linear 0s')
  expect(layers.whole).toBe('iv-rise 1.5s linear 0s')
  for (let i = 1; i <= 6; i++) expect(layers[`veggie_${i}_pop`]).toBe(`iv-veggie-${i} 1.5s linear 0s`)
  const intro = drawing('invite-intro', theme)
  for (const name of ['pebble', 'whole', 'veggie_1_pop']) expect(layerTag(intro, name)).not.toMatch(/transform=|opacity=/)
  // Where the loop starts: each veggie on its lap, the same art.
  const loop = drawing('invite-loop', theme)
  for (let i = 1; i <= 6; i++) {
    const at = (svg: string, name: string) => layerTag(svg, name).match(/transform="translate\(([-\d.]+) ([-\d.]+)\)"/)?.slice(1).map(Number) ?? [0, 0]
    const [lx, ly] = [at(loop, `veggie_${i}_x`)[0], at(loop, `veggie_${i}_y`)[1]]
    expect(at(intro, `veggie_${i}`)).toEqual([lx, ly])
  }
})

test('invite: the pebble bobs ±8 of the 750 canvas\'s height, as a share of the clip, so the emoji over it moves the same', () => {
  expect(keyframes('iv-bob')).toContain('25%{transform:translateY(-1.0667%)')
  expect(keyframes('iv-bob')).toContain('75%{transform:translateY(1.0667%)')
})

test('invite intro: the pebble pops at f6–27, Topfbert rises at f21–39, the avatars pop 3 frames apart from f28, all by f45', () => {
  expect(keyframes('iv-pebble-pop')).toMatch(/^0%,13\.3333%\{transform:rotate\(-12deg\)scale\(0\)/)
  expect(keyframes('iv-pebble-pop')).toContain('60%,100%{transform:rotate(0deg)scale(1)}')
  expect(keyframes('iv-rise')).toMatch(/^0%,46\.6667%\{transform:translate\(-20px,160px\);opacity:0/)
  expect(keyframes('iv-rise')).toContain('86.6667%,100%{transform:translate(0px,0px);opacity:1}')
  expect(keyframes('iv-avatar-1')).toMatch(/^0%,62\.2222%\{transform:scale\(0\)/)
  expect(keyframes('iv-avatar-4')).toMatch(/100%\{transform:scale\(1\)\}$/)
})

test.each(THEMES)('the empty Column\'s pea, %s: a wide open smile, smiling eyes and rosy cheeks, to read as happy when small', (theme) => {
  const pea = drawing('empty-column', theme).match(/<g id="pea"[\s\S]*<\/g><\/svg><\/g>/)![0]
  // Smiling eyes: arcs bowed up, not dots.
  const eyes = pea.match(/<g id="pea_eyes">([\s\S]*?)<\/g>/)![1]!
  expect(eyes).not.toContain('<circle')
  expect(eyes.match(/<path /g)).toHaveLength(2)
  // An open smile, filled, a good third of his 32-unit width.
  const mouth = pea.match(/<g id="pea_mouth">([\s\S]*?)<\/g>/)![1]!
  const [, from, to] = mouth.match(/M([\d.]+) [\d.]+H([\d.]+)/)!.map(Number)
  expect(to! - from!).toBeGreaterThanOrEqual(11)
  expect(mouth).toMatch(/fill="#1F1E1C"/)
  expect(pea).toContain('id="pea_cheeks"')
})
