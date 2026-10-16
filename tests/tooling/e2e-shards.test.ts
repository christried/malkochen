import { expect, test } from 'vitest'
import { planShard } from '../e2e/shards'

// CI's browser shards (#287): whole spec files, spread by how long each
// took, so no shard waits on a cluster of slow files.

const DURATIONS = { 'a.spec.ts': 100, 'b.spec.ts': 60, 'c.spec.ts': 50, 'd.spec.ts': 40, 'e.spec.ts': 10 }
const FILES = Object.keys(DURATIONS)

test('every file runs in exactly one shard', () => {
  const shards = [1, 2, 3].map(i => planShard(FILES, DURATIONS, i, 3))
  expect(shards.flat().toSorted()).toEqual(FILES)
})

test('slowest first, each file goes to the shard with the least time so far', () => {
  expect([1, 2].map(i => planShard(FILES, DURATIONS, i, 2))).toEqual([
    ['a.spec.ts', 'd.spec.ts'],
    ['b.spec.ts', 'c.spec.ts', 'e.spec.ts'],
  ])
})

test('a file without a measured time counts as the median file', () => {
  // The median of 100, 60, 50 and 10 is 55: f goes after b, with it.
  const files = [...FILES.filter(f => f !== 'd.spec.ts'), 'f.spec.ts']
  const { 'd.spec.ts': _, ...known } = DURATIONS
  expect(planShard(files, known, 2, 2)).toEqual(['b.spec.ts', 'e.spec.ts', 'f.spec.ts'])
})

test('more shards than files leaves the extra shards empty', () => {
  expect(planShard(['a.spec.ts'], DURATIONS, 2, 3)).toEqual([])
})
