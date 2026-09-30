import { expect, test } from 'vitest'
import { anonymous } from './client'

// Without a Vercel Blob token (as here) stored images are served from disk.
// Only names the Image Store writes are ever read.
test.each([
  ['a missing image', '/images/dishes/00000000-0000-4000-8000-000000000000.jpg'],
  ['a name the Image Store never writes', '/images/dishes/cover.jpg'],
  ['a path outside the image folder', '/images/..%2F..%2Fpackage.json'],
  ['an SVG', '/images/dishes/00000000-0000-4000-8000-000000000000.svg'],
])('%s is not found', async (_, path) => {
  expect((await anonymous().fetch(path)).status).toBe(404)
})
