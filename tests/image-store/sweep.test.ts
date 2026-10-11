import { mkdtemp, readdir, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { diskStorage } from '../../server/image-store'
import { sweepImages } from '../../server/image-store/sweep'

// Seam 3: the daily sweep deletes stored images nothing refers to any more
// (#195), here against disk storage in a temporary folder. An image newer
// than a day is kept even so: it may be a preview upload a Member is still
// deciding on.

const HOUR = 60 * 60 * 1000
const NOW = new Date('2026-10-11T03:00:00Z')

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'malkochen-sweep-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

// Stores an image `hoursAgo` hours before NOW; answers its URL.
async function stored(name: string, hoursAgo: number): Promise<string> {
  const url = await diskStorage(dir).save(name, new Uint8Array([0xFF, 0xD8, 0xFF]), 'image/jpeg')
  const at = new Date(NOW.getTime() - hoursAgo * HOUR)
  await utimes(join(dir, name), at, at)
  return url
}

const left = async (folder: string) => (await readdir(join(dir, folder)).catch(() => [])).sort()

const DISH = 'dishes/00000000-0000-4000-8000-000000000001.jpg'
const OTHER_DISH = 'dishes/00000000-0000-4000-8000-000000000002.jpg'
const PICTURE = 'pictures/00000000-0000-4000-8000-000000000003.jpg'
const OTHER_PICTURE = 'pictures/00000000-0000-4000-8000-000000000004.jpg'

test('an image nothing refers to, older than a day, is deleted; a referenced one is kept', async () => {
  const kept = await stored(DISH, 48)
  const removed = await stored(OTHER_DISH, 48)

  const swept = await sweepImages({ storage: diskStorage(dir), isReferenced: url => url === kept, now: NOW })

  expect(swept).toEqual([removed])
  expect(await left('dishes')).toEqual([DISH.slice('dishes/'.length)])
})

test('an image nothing refers to yet, stored less than a day ago, is kept', async () => {
  await stored(DISH, 23)

  const swept = await sweepImages({ storage: diskStorage(dir), isReferenced: () => false, now: NOW })

  expect(swept).toEqual([])
  expect(await left('dishes')).toHaveLength(1)
})

test('Profile Pictures are swept the same way', async () => {
  const kept = await stored(PICTURE, 48)
  await stored(OTHER_PICTURE, 48)

  await sweepImages({ storage: diskStorage(dir), isReferenced: url => url === kept, now: NOW })

  expect(await left('pictures')).toEqual([PICTURE.slice('pictures/'.length)])
})

test('nothing stored yet sweeps nothing', async () => {
  expect(await sweepImages({ storage: diskStorage(dir), isReferenced: () => false, now: NOW })).toEqual([])
})
