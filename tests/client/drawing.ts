import { readFileSync } from 'node:fs'
import { loopStyle } from '../../app/utils/svg-loop'

// Reading the drawings the app animates in code (SvgLoop, public/clips/*.svg)
// and their keyframes (app/assets/css/loops.css), for the tests of what they
// draw.

export const THEMES = ['light', 'dark'] as const

// Without a theme: a drawing the same in both (public/clips/<clip>.svg).
export function drawing(clip: string, theme?: string) {
  return readFileSync(`public/clips/${clip}${theme ? `-${theme}` : ''}.svg`, 'utf8')
}

// Each animated layer's loop, by its `data-layer` name: "keyframes duration
// easing delay".
export function loops(clip: string, theme?: string) {
  const layers = new Map<string, string>()
  for (const [tag] of drawing(clip, theme).matchAll(/<g\b[^>]*>/g)) {
    const name = tag.match(/data-layer="([^"]+)"/)?.[1]
    const loop = tag.match(/data-loop="([^"]+)"/)?.[1]
    if (name && loop) layers.set(name, loopStyle(loop, null)?.['--loop'] ?? `unreadable: ${loop}`)
  }
  return layers
}

// One @keyframes block of loops.css, without its spaces.
export function keyframes(name: string) {
  const css = readFileSync('app/assets/css/loops.css', 'utf8')
  const block = css.match(new RegExp(`@keyframes ${name}\\s*\\{((?:[^{}]*\\{[^}]*\\})*)\\s*\\}`))?.[1]
  if (!block) throw new Error(`No @keyframes ${name}`)
  return block.replace(/\s+/g, '')
}

// A background, as the videos had baked in: a square-cornered rect from the
// drawing's corner, or a background style on the drawing itself.
export function backgrounds(svg: string) {
  const atZero = (rect: string, axis: string) =>
    (rect.match(new RegExp(`\\b${axis}="([^"]*)"`))?.[1] ?? '0').replace(/(px|%)$/, '') === '0'
  return [
    ...[...svg.matchAll(/<rect\b[^>]*>/g)].map(([rect]) => rect)
      .filter(rect => atZero(rect, 'x') && atZero(rect, 'y') && !/\brx="/.test(rect)),
    ...(svg.match(/<svg\b[^>]*style="[^"]*background[^"]*"/g) ?? []),
  ]
}

// One top-level layer's markup: from its `data-layer` to the next one's.
export function layer(svg: string, name: string) {
  const start = svg.indexOf(`<g data-layer="${name}"`)
  if (start === -1) throw new Error(`No layer ${name}`)
  const next = svg.indexOf('<g data-layer=', start + 1)
  return svg.slice(start, next === -1 ? undefined : next)
}

// A layer's opening tag.
export function layerTag(svg: string, name: string) {
  return layer(svg, name).match(/^<g\b[^>]*>/)![0]
}
