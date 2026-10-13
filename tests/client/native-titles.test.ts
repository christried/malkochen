import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { expect, test } from 'vitest'

// #206: the app's own Tooltip (AppTooltip, `data-tooltip`) is the only
// tooltip. A native element with a `title` attribute would bring the
// browser's back, so no template has one; a component's `title` prop (a
// sheet's heading) is not one.
const APP = join(import.meta.dirname, '../../app')

function vueFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? vueFiles(join(dir, entry.name)) : entry.name.endsWith('.vue') ? [join(dir, entry.name)] : [])
}

// The native elements (lower-case tags) in a template that carry `title`,
// bound or not, and the SVG `<title>` elements, as `tag:line`.
function nativeTitles(source: string): string[] {
  const start = source.search(/^<template/m)
  if (start === -1) return []
  const template = source.slice(start, source.lastIndexOf('</template>'))
  const found: string[] = []
  for (const match of template.matchAll(/\s:?title=|<title[\s>]/g)) {
    const line = source.slice(0, start + match.index).split('\n').length
    if (match[0].startsWith('<')) {
      found.push(`title:${line}`)
      continue
    }
    // The tag this attribute belongs to: the last one opened before it.
    const tag = [...template.slice(0, match.index).matchAll(/<([A-Za-z][\w-]*)/g)].at(-1)?.[1]
    if (tag && tag === tag.toLowerCase() && !tag.includes('-')) found.push(`${tag}:${line}`)
  }
  return found
}

test('finds a native title, and leaves a component’s title prop alone', () => {
  const source = `<template>
  <AppSheet :title="t.heading">
    <span
      class="truncate"
      :title="dish.creator"
    >{{ dish.creator }}</span>
    <button title="Suchen" />
    <svg><title>Lupe</title></svg>
  </AppSheet>
</template>`
  expect(nativeTitles(source)).toEqual(['span:5', 'button:7', 'title:8'])
})

test('no template in the app gives a native element a title', () => {
  const files = vueFiles(APP)
  expect(files.length).toBeGreaterThan(50)
  const titled = files.flatMap(file => nativeTitles(readFileSync(file, 'utf8')).map(at => `${relative(APP, file).replaceAll('\\', '/')} ${at}`))
  expect(titled).toEqual([])
})
