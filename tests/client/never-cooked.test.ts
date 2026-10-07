import { expect, test } from 'vitest'
import { NEVER_COOKED_SCENES, neverCookedScene } from '../../app/utils/never-cooked'

// Seam 4: which "never cooked" scene a Dish's detail shows (Round 11's three:
// Topfbert tipping his hat to the pea, Schoti leaping over the pea, Knobi
// riding Topfbert's steam): one per Dish, picked by its id.
const dishIds = Array.from({ length: 60 }, (_, i) => `3d1f${i.toString(16).padStart(4, '0')}-8a2b-4c6d-9e0f-${(i * 7919).toString(16).padStart(12, '0')}`)

test('the three scenes are the handoff\'s, in its order', () => {
  expect(NEVER_COOKED_SCENES).toEqual(['never-cooked-hut', 'never-cooked-sprung', 'never-cooked-dampf'])
})

test('a Dish always shows the same scene', () => {
  for (const dishId of dishIds) {
    expect(neverCookedScene(dishId)).toBe(neverCookedScene(dishId))
  }
})

test('Dishes differ in their scene, and every scene comes up', () => {
  const counts = new Map<string, number>()
  for (const dishId of dishIds) {
    const scene = neverCookedScene(dishId)
    counts.set(scene, (counts.get(scene) ?? 0) + 1)
  }
  expect([...counts.keys()].sort()).toEqual([...NEVER_COOKED_SCENES].sort())
  // Roughly a third each, not all but one on the same scene.
  for (const count of counts.values()) expect(count).toBeGreaterThan(dishIds.length / 6)
})
